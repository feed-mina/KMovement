"""Tora CogVideoX I2V worker — trajectory-controlled image-to-video via subprocess.

Calls the official Tora ``sat/sample_video.py`` as a subprocess and
collects the generated MP4.  Falls back to ``cogvideox_real`` →
``3d_photo_light`` → ``zoompan`` on failure.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import traceback
from pathlib import Path

from .cogvideox_real import run_cogvideox_real_case
from .ffmpeg_utils import mix_video_tts_bgm
from .schemas import Artifact, GenerationResult, TravelCase
from .tora_trajectory import (
    resolve_preset,
    validate_trajectory,
    write_tora_point_file,
)
from .tts import synthesize_gtts
from .worker_config import WorkerConfig, load_worker_config


def create_tora_cogvideox_video(
    case: TravelCase,
    output_mp4: Path,
    cfg: WorkerConfig,
) -> Path:
    """Run official Tora I2V inference via subprocess.

    1. Resolve trajectory from ``trajectory_points`` or ``trajectory_preset``
    2. Write Tora point file
    3. Write prompt file
    4. ``torchrun sample_video.py`` subprocess
    5. Collect generated MP4
    """
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    if output_mp4.exists():
        return output_mp4

    if not case.image_path.exists():
        raise FileNotFoundError(f"missing input image: {case.image_path}")

    tora_dir = cfg.tora_dir
    if not tora_dir or not tora_dir.exists():
        raise RuntimeError(
            f"Tora directory not found: {tora_dir}. "
            "Set KRIDE_TORA_DIR to the cloned Tora repository."
        )

    checkpoint = cfg.tora_checkpoint_path
    if not checkpoint or not checkpoint.exists():
        raise RuntimeError(
            f"Tora checkpoint not found: {checkpoint}. "
            "Set KRIDE_TORA_CHECKPOINT_PATH."
        )

    # --- Resolve trajectory ---
    if case.trajectory_points:
        trajectories = validate_trajectory(case.trajectory_points)
    elif case.trajectory_preset:
        preset_pts = resolve_preset(case.trajectory_preset)
        trajectories = [preset_pts]
    else:
        raise ValueError(
            "tora_cogvideox_i2v requires trajectory_points or trajectory_preset"
        )

    # --- Prepare working directory ---
    work_dir = output_mp4.parent / f"{case.case_id}_tora_work"
    work_dir.mkdir(parents=True, exist_ok=True)

    # Point file
    point_file = write_tora_point_file(
        trajectories,
        work_dir / "points.json",
        num_frames=cfg.cogvideox_num_frames,
    )

    # Prompt file (Tora expects a text file with the prompt)
    prompt_text = case.prompt or f"A cinematic travel video from a real photo of {case.place}."
    prompt_file = work_dir / "prompt.txt"
    prompt_file.write_text(prompt_text, encoding="utf-8")

    # Image directory (Tora --img_dir expects a directory)
    image_dir = work_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    target_img = image_dir / case.image_path.name
    if not target_img.exists():
        shutil.copy2(case.image_path, target_img)

    # Output directory
    tora_output_dir = work_dir / "output"
    tora_output_dir.mkdir(parents=True, exist_ok=True)

    # --- Build subprocess command ---
    sat_dir = tora_dir / "sat"
    cmd = [
        "torchrun",
        "--standalone",
        "--nproc_per_node=1",
        str(sat_dir / "sample_video.py"),
        "--base",
        str(sat_dir / "configs" / "tora" / "model" / "cogvideox_5b_tora_i2v.yaml"),
        str(sat_dir / "configs" / "tora" / "inference_sparse.yaml"),
        "--load",
        str(checkpoint),
        "--point_path",
        str(point_file),
        "--input-file",
        str(prompt_file),
        "--img_dir",
        str(image_dir),
        "--image2video",
        "--output-dir",
        str(tora_output_dir),
    ]

    print(f"[tora] Running: {' '.join(cmd)}")

    result = subprocess.run(
        cmd,
        cwd=str(tora_dir),
        capture_output=True,
        text=True,
        timeout=cfg.timeout_seconds,
        check=False,
    )

    if result.returncode != 0:
        # Keep a generous tail: torchrun appends its own wrapper traceback after
        # the child's output, so the *child* traceback (which names the failing
        # HF repo / from_pretrained call) sits well above the last 2000 chars.
        stderr_tail = (result.stderr or "")[-8000:]
        stdout_tail = (result.stdout or "")[-3000:]
        raise RuntimeError(
            f"Tora subprocess failed (exit {result.returncode}):\n"
            f"stderr: {stderr_tail}\nstdout: {stdout_tail}"
        )

    # --- Collect output MP4 ---
    mp4_files = sorted(tora_output_dir.glob("*.mp4"))
    if not mp4_files:
        raise FileNotFoundError(
            f"Tora produced no MP4 files in {tora_output_dir}"
        )

    # Use the first (or only) generated video
    shutil.move(str(mp4_files[0]), str(output_mp4))
    return output_mp4


def run_tora_cogvideox_case(
    case: TravelCase,
    output_root: Path,
    bgm_wav: Path,
    *,
    cfg: WorkerConfig | None = None,
) -> GenerationResult:
    """Tora → cogvideox_real → 3d_photo_light fallback chain."""
    cfg = cfg or load_worker_config()
    branch_dir = output_root / "tora_cogvideox_i2v"
    raw_dir = branch_dir / "raw"
    tts_dir = branch_dir / "tts"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"
    raw_mp4 = raw_dir / f"{case.case_id}_tora_i2v.mp4"

    try:
        create_tora_cogvideox_video(case, raw_mp4, cfg)
        tts_wav = synthesize_gtts(case.tts_text, tts_dir / f"{case.case_id}.wav")
        final_mp4 = mix_video_tts_bgm(
            raw_mp4, tts_wav, bgm_wav,
            final_dir / f"{case.case_id}_tora_i2v_final.mp4",
        )

        metadata = {
            "route": "tora_cogvideox_i2v",
            "case_id": case.case_id,
            "place": case.place,
            "image": str(case.image_path),
            "prompt": case.prompt,
            "model_id": cfg.cogvideox_model_id,
            "seed": cfg.cogvideox_seed,
            "guidance_scale": cfg.cogvideox_guidance_scale,
            "trajectory_preset": case.trajectory_preset,
            "trajectory_points_count": (
                len(case.trajectory_points) if case.trajectory_points else 0
            ),
            "actual_model_executed": True,
            "status": "success",
        }
        meta_dir.mkdir(parents=True, exist_ok=True)
        meta_path = meta_dir / f"{case.case_id}_tora_i2v.json"
        meta_path.write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8",
        )

        return GenerationResult(
            route="tora_cogvideox_i2v",
            status="success",
            case_id=case.case_id,
            artifacts=[
                Artifact.from_path("raw_model_video", raw_mp4),
                Artifact.from_path("tts", tts_wav),
                Artifact.from_path("final_video", final_mp4),
                Artifact.from_path("metadata", meta_path),
            ],
            metadata=metadata,
        )
    except Exception as exc:
        print(f"[tora] Tora failed for {case.case_id}: {exc}")
        traceback.print_exc()

        if not cfg.allow_fallback:
            raise

        # Fallback: cogvideox_real → 3d_photo_light → zoompan
        fallback = run_cogvideox_real_case(case, output_root, bgm_wav, cfg=cfg)
        fallback.metadata["tora_attempted"] = True
        fallback.metadata["tora_error"] = str(exc)[:2000]
        fallback.metadata["actual_model_executed"] = fallback.metadata.get(
            "actual_model_executed", False
        )
        fallback.status = "fallback_used"
        fallback.error = str(exc)[:2000]
        return fallback
