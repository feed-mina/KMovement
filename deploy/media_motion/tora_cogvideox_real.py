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

# Used when a Tora request arrives without any trajectory (e.g. the website's
# single-image Tora button). Keeps Tora actually running instead of falling back.
DEFAULT_TRAJECTORY_PRESET = "object_pan_right"


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

    # SAT's load_checkpoint joins 'mp_rank_00_model_states.pt' directly onto the
    # --load path, so --load must be the *directory* containing the checkpoint,
    # not the file itself. Accept either form for KRIDE_TORA_CHECKPOINT_PATH.
    load_path = checkpoint.parent if checkpoint.is_file() else checkpoint

    # --- Resolve trajectory ---
    if case.trajectory_points:
        trajectories = validate_trajectory(case.trajectory_points)
    elif case.trajectory_preset:
        preset_pts = resolve_preset(case.trajectory_preset)
        trajectories = [preset_pts]
    else:
        # No trajectory supplied (e.g. the website Tora button without a preset).
        # Default to a gentle pan so Tora actually runs, instead of hard-failing
        # into the cogvideox_real fallback. Record the effective preset so the
        # metadata reflects what was used.
        print(
            f"[tora] no trajectory provided; defaulting to preset "
            f"'{DEFAULT_TRAJECTORY_PRESET}'"
        )
        case.trajectory_preset = DEFAULT_TRAJECTORY_PRESET
        trajectories = [resolve_preset(DEFAULT_TRAJECTORY_PRESET)]

    # --- Prepare working directory ---
    work_dir = output_mp4.parent / f"{case.case_id}_tora_work"
    work_dir.mkdir(parents=True, exist_ok=True)

    # Point files — one text file per trajectory (Tora --point_path is nargs="+")
    point_files = write_tora_point_file(
        trajectories,
        work_dir / "points",
        num_frames=cfg.cogvideox_num_frames,
    )

    # Image directory (Tora --img_dir expects a directory)
    image_dir = work_dir / "images"
    image_dir.mkdir(parents=True, exist_ok=True)
    target_img = image_dir / case.image_path.name
    if not target_img.exists():
        shutil.copy2(case.image_path, target_img)

    # Prompt file. In image2video mode sample_video.py parses each line as
    # ``<prompt>@@<image_filename>`` and resolves the image via
    # ``os.path.join(args.img_dir, image_filename)`` — so the prompt and the
    # image basename must be joined with ``@@`` on a single line.
    prompt_text = case.prompt or f"A cinematic travel video from a real photo of {case.place}."
    prompt_file = work_dir / "prompt.txt"
    prompt_file.write_text(f"{prompt_text}@@{target_img.name}", encoding="utf-8")

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
        str(load_path),
        "--point_path",
        *[str(p) for p in point_files],
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
        # SAT's sample_video.py prints a huge args/config dump at startup, which
        # otherwise drowns out the real failure in a fixed-size tail. Extract the
        # diagnostically-relevant lines (tracebacks, exceptions, CUDA/OOM, the
        # torchrun ChildFailedError block with the child's real exitcode) so an
        # OOM-kill (no Python traceback) is distinguishable from a true exception.
        stderr = result.stderr or ""
        keywords = (
            "Traceback", "Error", "error", "Exception", "assert", "Assertion",
            "CUDA", "out of memory", "OutOfMemory", "OOM", "Killed", "killed",
            "SIGKILL", "ChildFailedError", "exitcode", "FAILED", "No module",
            "not found", "token", "permission", "raise", "RuntimeError",
        )
        diag = [ln for ln in stderr.splitlines() if any(k in ln for k in keywords)]
        diag_text = "\n".join(diag[-80:])
        raise RuntimeError(
            f"Tora subprocess failed (exit {result.returncode}):\n"
            f"--- diagnostic lines ---\n{diag_text}\n"
            f"--- stderr tail ---\n{stderr[-3000:]}\n"
            f"--- stdout tail ---\n{(result.stdout or '')[-1500:]}"
        )

    # --- Collect output MP4 ---
    # sample_video.py writes the generated video to <output_dir>/video/<name>.mp4
    # (and, when trajectories are supplied, a trajectory-overlay copy under
    # <output_dir>/traj_video/). Prefer the real video; never the overlay.
    mp4_files = sorted((tora_output_dir / "video").glob("*.mp4"))
    if not mp4_files:
        mp4_files = sorted(
            p for p in tora_output_dir.rglob("*.mp4")
            if "traj_video" not in p.parts
        )
    if not mp4_files:
        raise FileNotFoundError(
            f"Tora produced no MP4 files under {tora_output_dir}"
        )

    shutil.move(str(mp4_files[0]), str(output_mp4))
    return output_mp4


def _synthesize_narration(
    text: str, output_wav: Path, cfg: WorkerConfig,
) -> tuple[Path, str]:
    """Narration via GPT-SoVITS (production), falling back to gTTS.

    Returns ``(wav_path, engine)`` where engine is ``"gpt_sovits"`` or ``"gtts"``.
    GPT-SoVITS needs ``KRIDE_GPT_SOVITS_DIR`` + weights; until provisioned this
    cleanly degrades to gTTS.
    """
    if cfg.gpt_sovits_dir:
        try:
            from .gpt_sovits_worker import synthesize_gpt_sovits

            wav_path, _ = synthesize_gpt_sovits(text, output_wav, cfg=cfg)
            return wav_path, "gpt_sovits"
        except Exception as exc:  # noqa: BLE001 — degrade, don't fail the video
            print(f"[tora][tts] GPT-SoVITS failed ({exc}); falling back to gTTS")
    return synthesize_gtts(text, output_wav), "gtts"


def _resolve_bgm(
    case: TravelCase, sine_bgm: Path, bgm_dir: Path, cfg: WorkerConfig,
) -> tuple[Path, str]:
    """BGM via MusicGen, falling back to the provided sine-wave preset.

    Returns ``(bgm_path, engine)`` where engine is ``"musicgen"`` or ``"sine"``.
    MusicGen needs ``audiocraft``; if unavailable this degrades to the sine BGM.
    """
    description = (
        "gentle cinematic instrumental background music, calm and emotional, "
        f"for a travel memory video of {case.place}"
    )
    try:
        from .musicgen_bgm import synthesize_musicgen

        bgm_dir.mkdir(parents=True, exist_ok=True)
        bgm_path = synthesize_musicgen(
            description, bgm_dir / f"{case.case_id}_musicgen.wav", duration=15,
        )
        return bgm_path, "musicgen"
    except Exception as exc:  # noqa: BLE001 — degrade, don't fail the video
        print(f"[tora][bgm] MusicGen failed ({exc}); using sine-wave BGM")
        return sine_bgm, "sine"


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
        tts_wav, tts_engine = _synthesize_narration(
            case.tts_text, tts_dir / f"{case.case_id}.wav", cfg,
        )
        bgm_path, bgm_engine = _resolve_bgm(case, bgm_wav, branch_dir / "bgm", cfg)
        final_mp4 = mix_video_tts_bgm(
            raw_mp4, tts_wav, bgm_path,
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
            "tts_engine": tts_engine,
            "bgm_engine": bgm_engine,
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
