from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from .external_command import run_external_command
from .ffmpeg_utils import mix_video_tts_bgm, run_ffmpeg
from .schemas import Artifact, GenerationResult, TravelCase
from .tts import synthesize_gtts
from .worker_config import WorkerConfig, load_worker_config


def gif_to_mp4(gif_path: Path, output_mp4: Path) -> Path:
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    run_ffmpeg(
        [
            "-i",
            str(gif_path),
            "-vf",
            "fps=12,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white,format=yuv420p",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            str(output_mp4),
        ]
    )
    return output_mp4


def run_animated_drawings_pipeline(case: TravelCase, output_dir: Path, cfg: WorkerConfig) -> Path:
    if not cfg.animated_drawings_dir:
        raise RuntimeError("KRIDE_ANIMATED_DRAWINGS_DIR is required.")
    if not cfg.animated_drawings_python:
        cfg.animated_drawings_python = sys.executable

    ad_dir = cfg.animated_drawings_dir.resolve()
    if not ad_dir.exists():
        raise FileNotFoundError(f"AnimatedDrawings directory missing: {ad_dir}")
    if not case.image_path.exists():
        raise FileNotFoundError(f"input drawing/photo missing: {case.image_path}")

    motion = cfg.animated_drawings_motion or ad_dir / "examples" / "config" / "motion" / "dab.yaml"
    retarget = cfg.animated_drawings_retarget or ad_dir / "examples" / "config" / "retarget" / "fair1_ppf.yaml"
    if not motion.exists():
        raise FileNotFoundError(f"motion yaml missing: {motion}")
    if not retarget.exists():
        raise FileNotFoundError(f"retarget yaml missing: {retarget}")

    work_dir = output_dir / f"{case.case_id}_animated_drawings_work"
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    env = {
        "PYOPENGL_PLATFORM": "osmesa",
        "MESA_GL_VERSION_OVERRIDE": "3.3",
        "MESA_GLSL_VERSION_OVERRIDE": "330",
        "LIBGL_ALWAYS_SOFTWARE": "1",
        "MPLBACKEND": "Agg",
        "PYTHONPATH": str(ad_dir),
    }
    annotate = run_external_command(
        [
            cfg.animated_drawings_python,
            str(ad_dir / "examples" / "image_to_animation.py"),
            str(case.image_path),
            str(work_dir),
        ],
        cwd=ad_dir,
        timeout_seconds=cfg.timeout_seconds,
        extra_env=env,
    )
    if annotate.return_code != 0:
        raise RuntimeError(annotate.stderr_tail or annotate.stdout_tail)

    render = run_external_command(
        [
            cfg.animated_drawings_python,
            str(ad_dir / "examples" / "annotations_to_animation.py"),
            str(work_dir),
            str(motion),
            str(retarget),
        ],
        cwd=ad_dir,
        timeout_seconds=cfg.timeout_seconds,
        extra_env=env,
    )
    if render.return_code != 0:
        raise RuntimeError(render.stderr_tail or render.stdout_tail)

    gif_path = work_dir / "video.gif"
    if not gif_path.exists():
        raise FileNotFoundError(f"AnimatedDrawings did not produce {gif_path}")

    mp4_path = output_dir / f"{case.case_id}_animated_drawings.mp4"
    return gif_to_mp4(gif_path, mp4_path)


def run_animated_drawings_worker_case(
    case: TravelCase,
    output_root: Path,
    bgm_wav: Path,
    *,
    cfg: WorkerConfig | None = None,
) -> GenerationResult:
    cfg = cfg or load_worker_config()
    branch_dir = output_root / "animated_drawings_worker"
    raw_dir = branch_dir / "raw"
    tts_dir = branch_dir / "tts"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"

    raw_mp4 = run_animated_drawings_pipeline(case, raw_dir, cfg)
    tts_wav = synthesize_gtts(case.tts_text, tts_dir / f"{case.case_id}.wav")
    final_mp4 = mix_video_tts_bgm(raw_mp4, tts_wav, bgm_wav, final_dir / f"{case.case_id}_animated_drawings_final.mp4")

    metadata = {
        "route": "animated_drawings",
        "case_id": case.case_id,
        "image": str(case.image_path),
        "actual_model_executed": True,
        "status": "success",
        "animated_drawings_dir": str(cfg.animated_drawings_dir),
    }
    meta_dir.mkdir(parents=True, exist_ok=True)
    meta_path = meta_dir / f"{case.case_id}_animated_drawings_worker.json"
    meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

    return GenerationResult(
        route="animated_drawings",
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
