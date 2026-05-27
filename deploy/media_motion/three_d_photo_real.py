from __future__ import annotations

import json
import shutil
from pathlib import Path

from .external_command import command_from_json_template, command_from_template, run_external_command
from .ffmpeg_utils import mix_video_tts_bgm
from .schemas import Artifact, GenerationResult, TravelCase
from .three_d_photo_light import run_3d_photo_light_case
from .tts import synthesize_gtts
from .worker_config import WorkerConfig, load_worker_config


def _find_external_output(expected_output: Path, work_dir: Path) -> Path:
    if expected_output.exists():
        return expected_output
    candidates = sorted(work_dir.rglob("*.mp4"), key=lambda item: item.stat().st_mtime, reverse=True)
    if candidates:
        shutil.copy2(candidates[0], expected_output)
        return expected_output
    raise FileNotFoundError(f"3D Photo Inpainting command did not produce an mp4 in {work_dir}")


def create_3d_photo_inpainting_real_video(case: TravelCase, output_mp4: Path, cfg: WorkerConfig) -> Path:
    """Run an externally configured real 3D Photo Inpainting depth/mesh command."""
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    work_dir = output_mp4.parent / f"{case.case_id}_work"
    work_dir.mkdir(parents=True, exist_ok=True)

    values = {
        "case_id": case.case_id,
        "place": case.place,
        "image": case.image_path.resolve(),
        "output_dir": work_dir.resolve(),
        "output_mp4": output_mp4.resolve(),
        "prompt": case.prompt,
    }

    if cfg.three_d_photo_command_json:
        command = command_from_json_template(cfg.three_d_photo_command_json, values)
    elif cfg.three_d_photo_command:
        command = command_from_template(cfg.three_d_photo_command, values)
    else:
        raise RuntimeError(
            "KRIDE_3D_PHOTO_COMMAND_JSON or KRIDE_3D_PHOTO_COMMAND is required for real 3D Photo Inpainting."
        )

    command_result = run_external_command(command, cwd=work_dir, timeout_seconds=cfg.timeout_seconds)
    log_path = work_dir / "command_result.json"
    log_path.write_text(
        json.dumps(
            {
                "command": command_result.command,
                "return_code": command_result.return_code,
                "stdout_tail": command_result.stdout_tail,
                "stderr_tail": command_result.stderr_tail,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    if command_result.return_code != 0:
        raise RuntimeError(command_result.stderr_tail or command_result.stdout_tail)

    return _find_external_output(output_mp4, work_dir)


def run_3d_photo_inpainting_real_case(
    case: TravelCase,
    output_root: Path,
    bgm_wav: Path,
    *,
    cfg: WorkerConfig | None = None,
) -> GenerationResult:
    """Run a real 3D Photo Inpainting command, with light fallback when allowed."""
    cfg = cfg or load_worker_config()
    branch_dir = output_root / "3d_photo_inpainting_real"
    raw_dir = branch_dir / "raw"
    tts_dir = branch_dir / "tts"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"
    raw_mp4 = raw_dir / f"{case.case_id}_3d_photo_inpainting_real.mp4"

    try:
        create_3d_photo_inpainting_real_video(case, raw_mp4, cfg)
        tts_wav = synthesize_gtts(case.tts_text, tts_dir / f"{case.case_id}.wav")
        final_mp4 = mix_video_tts_bgm(raw_mp4, tts_wav, bgm_wav, final_dir / f"{case.case_id}_3d_photo_inpainting_real_final.mp4")

        metadata = {
            "route": "3d_photo_inpainting",
            "case_id": case.case_id,
            "place": case.place,
            "image": str(case.image_path),
            "actual_model_executed": True,
            "status": "success",
        }
        meta_dir.mkdir(parents=True, exist_ok=True)
        meta_path = meta_dir / f"{case.case_id}_3d_photo_inpainting_real.json"
        meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

        return GenerationResult(
            route="3d_photo_inpainting",
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
        if not cfg.allow_fallback:
            raise
        fallback = run_3d_photo_light_case(case, output_root, bgm_wav)
        fallback.metadata["real_model_attempted"] = True
        fallback.metadata["real_model_error"] = str(exc)[:2000]
        fallback.metadata["actual_model_executed"] = False
        fallback.status = "fallback_used"
        fallback.error = str(exc)[:2000]
        return fallback
