"""
RunPod Serverless Handler for K-Ride Media Motion
==================================================
Supported routes:
  - cogvideox_real      (GPU: CogVideoX image-to-video)
  - 3d_photo_light      (CPU: ffmpeg zoompan)
  - cogvideo_fallback   (CPU: ffmpeg photo-motion)
  - gpt_sovits_tts      (CPU/GPU: GPT-SoVITS or gTTS fallback)
  - musicgen            (GPU: MusicGen BGM)

Input schema (RunPod job input):
{
  "route": "cogvideox_real",
  "case_id": "gangneung_beach",
  "place": "Gangneung Beach",
  "image_base64": "<base64-encoded image>",
  "tts_text": "강릉 해변의 아름다운 풍경입니다.",
  "bgm_key": "bright_travel",
  "motion": "slow_zoom_in",
  "prompt": "A cinematic travel video ...",
  "allow_fallback": true,
  "musicgen_description": "calm Korean ambient music",
  "musicgen_duration": 15
}

Output: GenerationResult dict with base64-encoded artifacts.
"""
from __future__ import annotations

import base64
import json
import os
import tempfile
import traceback
from pathlib import Path

import runpod

from .bgm import ensure_fallback_bgm
from .cogvideo_fallback import run_cogvideo_fallback_case
from .cogvideox_real import run_cogvideox_real_case
from .gpt_sovits_worker import run_gpt_sovits_tts_case
from .schemas import TravelCase
from .three_d_photo_light import run_3d_photo_light_case
from .worker_config import load_worker_config

SUPPORTED_ROUTES = {
    "cogvideox_real",
    "3d_photo_light",
    "cogvideo_fallback",
    "gpt_sovits_tts",
    "musicgen",
}

OUTPUT_DIR = Path(os.environ.get("KRIDE_WORKER_OUTPUT_DIR", "/tmp/kride_outputs"))


def _decode_image(image_base64: str, case_id: str, work_dir: Path) -> Path:
    """Decode base64 image to a temporary file."""
    img_bytes = base64.b64decode(image_base64)
    ext = ".jpg"
    if img_bytes[:8].startswith(b"\x89PNG"):
        ext = ".png"
    img_path = work_dir / f"{case_id}{ext}"
    img_path.write_bytes(img_bytes)
    return img_path


def _encode_artifacts(result_dict: dict) -> dict:
    """Encode artifact file contents as base64 for RunPod response."""
    for artifact in result_dict.get("artifacts", []):
        fpath = Path(artifact["path"])
        if fpath.exists() and fpath.stat().st_size < 200 * 1024 * 1024:  # <200MB
            artifact["data_base64"] = base64.b64encode(fpath.read_bytes()).decode()
        else:
            artifact["data_base64"] = None
    # RunPod treats non-empty "error" as FAILED — clear it for fallback_used
    if result_dict.get("status") == "fallback_used":
        result_dict["fallback_reason"] = result_dict.pop("error", "")
    return result_dict


def _run_musicgen(job_input: dict, work_dir: Path) -> dict:
    """Run MusicGen BGM generation, with sine-wave fallback if audiocraft is unavailable."""
    description = job_input.get("musicgen_description", "calm Korean ambient music")
    duration = min(job_input.get("musicgen_duration", 15), 30)
    case_id = job_input.get("case_id", "bgm")
    allow_fallback = job_input.get("allow_fallback", True)

    try:
        import torch
        from audiocraft.models import MusicGen

        model_name = os.environ.get("MUSICGEN_MODEL", "facebook/musicgen-small")
        model = MusicGen.get_pretrained(model_name)
        model.set_generation_params(duration=duration, use_sampling=True, top_k=250)

        wav = model.generate([description])

        import soundfile as sf

        output_path = work_dir / f"{case_id}_musicgen.wav"
        audio_data = wav[0].cpu().numpy()
        if audio_data.ndim > 1:
            audio_data = audio_data.squeeze()
        sf.write(str(output_path), audio_data, samplerate=32000)

        del model
        torch.cuda.empty_cache()

        return {
            "route": "musicgen",
            "status": "success",
            "case_id": case_id,
            "artifacts": [
                {
                    "kind": "bgm",
                    "path": str(output_path),
                    "exists": True,
                    "size_mb": round(output_path.stat().st_size / 1024 / 1024, 3),
                    "data_base64": base64.b64encode(output_path.read_bytes()).decode(),
                }
            ],
            "metadata": {
                "model": model_name,
                "description": description,
                "duration": duration,
            },
        }
    except (ImportError, RuntimeError, Exception) as exc:
        if not allow_fallback:
            raise

        from .bgm import ensure_fallback_bgm

        bgm_key = "bright_travel"
        if "cinematic" in description.lower() or "dramatic" in description.lower():
            bgm_key = "cinematic_memory"
        elif "cute" in description.lower() or "character" in description.lower():
            bgm_key = "cute_character"
        elif "city" in description.lower() or "urban" in description.lower():
            bgm_key = "city_walk"

        output_path = ensure_fallback_bgm(work_dir / "bgm", bgm_key, duration=duration)

        return {
            "route": "musicgen",
            "status": "fallback_used",
            "case_id": case_id,
            "artifacts": [
                {
                    "kind": "bgm",
                    "path": str(output_path),
                    "exists": output_path.exists(),
                    "size_mb": round(output_path.stat().st_size / 1024 / 1024, 3) if output_path.exists() else 0,
                    "data_base64": base64.b64encode(output_path.read_bytes()).decode() if output_path.exists() else None,
                }
            ],
            "metadata": {
                "description": description,
                "duration": duration,
                "fallback_type": "sine_wave_bgm",
                "bgm_key": bgm_key,
            },
            "fallback_reason": str(exc)[:500],
        }


def handler(job: dict) -> dict:
    """RunPod serverless handler entry point."""
    job_input = job.get("input", {})
    route = job_input.get("route", "")

    if route not in SUPPORTED_ROUTES:
        return {"error": f"Unsupported route: {route}. Use one of {sorted(SUPPORTED_ROUTES)}"}

    work_dir = OUTPUT_DIR / job_input.get("case_id", "default")
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        # MusicGen has its own path (no TravelCase needed)
        if route == "musicgen":
            return _run_musicgen(job_input, work_dir)

        cfg = load_worker_config(
            allow_fallback=job_input.get("allow_fallback", True),
        )

        # TTS-only route
        if route == "gpt_sovits_tts":
            result = run_gpt_sovits_tts_case(
                case_id=job_input.get("case_id", "tts"),
                text=job_input.get("tts_text", "테스트 음성입니다."),
                output_root=work_dir,
                cfg=cfg,
            )
            return _encode_artifacts(result.to_dict())

        # Video routes need an image
        image_base64 = job_input.get("image_base64", "")
        if not image_base64:
            return {"error": "image_base64 is required for video routes"}

        image_path = _decode_image(image_base64, job_input.get("case_id", "img"), work_dir)

        case = TravelCase(
            case_id=job_input.get("case_id", "default"),
            place=job_input.get("place", "Unknown"),
            image_path=image_path,
            tts_text=job_input.get("tts_text", "여행 영상입니다."),
            bgm_key=job_input.get("bgm_key", "bright_travel"),
            prompt=job_input.get("prompt", ""),
            motion=job_input.get("motion", "slow_zoom_in"),
        )

        bgm_wav = ensure_fallback_bgm(work_dir / "bgm", case.bgm_key)

        if route == "cogvideox_real":
            result = run_cogvideox_real_case(case, work_dir, bgm_wav, cfg=cfg)
        elif route == "3d_photo_light":
            result = run_3d_photo_light_case(case, work_dir, bgm_wav)
        elif route == "cogvideo_fallback":
            result = run_cogvideo_fallback_case(case, work_dir, bgm_wav)
        else:
            return {"error": f"Unhandled route: {route}"}

        return _encode_artifacts(result.to_dict())

    except Exception as exc:
        traceback.print_exc()
        return {
            "error": str(exc)[:2000],
            "route": route,
            "status": "failed",
            "case_id": job_input.get("case_id", ""),
        }


runpod.serverless.start({"handler": handler})
