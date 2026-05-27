from __future__ import annotations

import json
from pathlib import Path

from .cogvideo_fallback import run_cogvideo_fallback_case
from .ffmpeg_utils import mix_video_tts_bgm
from .schemas import Artifact, GenerationResult, TravelCase
from .tts import synthesize_gtts
from .worker_config import WorkerConfig, load_worker_config


def create_cogvideox_real_video(case: TravelCase, output_mp4: Path, cfg: WorkerConfig) -> Path:
    """Run real CogVideoX image-to-video inference when dependencies are installed."""
    output_mp4.parent.mkdir(parents=True, exist_ok=True)
    if output_mp4.exists():
        return output_mp4
    if not case.image_path.exists():
        raise FileNotFoundError(f"missing input image: {case.image_path}")

    # Heavy imports stay inside this function so the gateway can import safely.
    import torch
    from diffusers import CogVideoXImageToVideoPipeline
    from diffusers.utils import export_to_video
    from PIL import Image

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if device == "cuda" and torch.cuda.is_bf16_supported() else torch.float16

    pipe = CogVideoXImageToVideoPipeline.from_pretrained(cfg.cogvideox_model_id, torch_dtype=dtype)
    if device == "cuda" and cfg.cogvideox_cpu_offload:
        pipe.enable_model_cpu_offload()
    else:
        pipe.to(device)

    image = Image.open(case.image_path).convert("RGB")
    prompt = case.prompt or f"A cinematic travel video from a real photo of {case.place}."

    result = pipe(
        prompt=prompt,
        image=image,
        num_videos_per_prompt=1,
        num_inference_steps=cfg.cogvideox_num_inference_steps,
        num_frames=cfg.cogvideox_num_frames,
        guidance_scale=6.0,
    )
    frames = result.frames[0]
    export_to_video(frames, str(output_mp4), fps=cfg.cogvideox_fps)
    return output_mp4


def run_cogvideox_real_case(
    case: TravelCase,
    output_root: Path,
    bgm_wav: Path,
    *,
    cfg: WorkerConfig | None = None,
) -> GenerationResult:
    """Run real CogVideoX, with explicit fallback when allowed."""
    cfg = cfg or load_worker_config()
    branch_dir = output_root / "cogvideox_real"
    raw_dir = branch_dir / "raw"
    tts_dir = branch_dir / "tts"
    final_dir = branch_dir / "final"
    meta_dir = branch_dir / "metadata"
    raw_mp4 = raw_dir / f"{case.case_id}_cogvideox_real.mp4"

    try:
        create_cogvideox_real_video(case, raw_mp4, cfg)
        tts_wav = synthesize_gtts(case.tts_text, tts_dir / f"{case.case_id}.wav")
        final_mp4 = mix_video_tts_bgm(raw_mp4, tts_wav, bgm_wav, final_dir / f"{case.case_id}_cogvideox_real_final.mp4")

        metadata = {
            "route": "cogvideox",
            "case_id": case.case_id,
            "place": case.place,
            "image": str(case.image_path),
            "prompt": case.prompt,
            "model_id": cfg.cogvideox_model_id,
            "actual_model_executed": True,
            "status": "success",
        }
        meta_dir.mkdir(parents=True, exist_ok=True)
        meta_path = meta_dir / f"{case.case_id}_cogvideox_real.json"
        meta_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")

        return GenerationResult(
            route="cogvideox",
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
        fallback = run_cogvideo_fallback_case(case, output_root, bgm_wav)
        fallback.metadata["real_model_attempted"] = True
        fallback.metadata["real_model_error"] = str(exc)[:2000]
        fallback.metadata["actual_model_executed"] = False
        fallback.status = "fallback_used"
        fallback.error = str(exc)[:2000]
        return fallback
