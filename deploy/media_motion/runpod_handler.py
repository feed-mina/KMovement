"""
RunPod Serverless Handler for K-Ride Media Motion
==================================================
Supported routes:
  - tora_cogvideox_i2v  (GPU: Tora trajectory-controlled CogVideoX I2V)
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
  "image_url": "https://project.supabase.co/storage/v1/object/public/...",
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
import ipaddress
import os
import socket
import traceback
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

import runpod

from .animated_drawings_worker import run_animated_drawings_worker_case
from .batch_video_worker import run_batch_video_case
from .bgm import ensure_fallback_bgm
from .cogvideo_fallback import run_cogvideo_fallback_case
from .cogvideox_real import run_cogvideox_real_case
from .gpt_sovits_worker import run_gpt_sovits_tts_case
from .result_delivery import finalize_result
from .schemas import BatchImageItem, BatchTravelCase, TravelCase
from .three_d_photo_light import run_3d_photo_light_case
from .three_d_photo_real import run_3d_photo_inpainting_real_case
from .tora_cogvideox_real import run_tora_cogvideox_case
from .worker_config import load_worker_config

SUPPORTED_ROUTES = {
    "cogvideox_real",
    "3d_photo_light",
    "3d_photo_inpainting_real",
    "cogvideo_fallback",
    "gpt_sovits_tts",
    "musicgen",
    "animated_drawings_worker",
    "batch_video",
    "tora_cogvideox_i2v",
}

OUTPUT_DIR = Path(os.environ.get("KRIDE_WORKER_OUTPUT_DIR", "/tmp/kride_outputs"))
MAX_IMAGE_BYTES = int(os.environ.get("KRIDE_MAX_INPUT_IMAGE_BYTES", str(10 * 1024 * 1024)))
IMAGE_DOWNLOAD_TIMEOUT = int(os.environ.get("KRIDE_IMAGE_DOWNLOAD_TIMEOUT_SECONDS", "30"))


def _allowed_image_hosts() -> list[str]:
    raw = os.environ.get("KRIDE_ALLOWED_IMAGE_HOSTS", ".supabase.co")
    return [item.strip().lower() for item in raw.split(",") if item.strip()]


def _validate_image_url(image_url: str) -> None:
    parsed = urlparse(image_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("image_url must use HTTPS")

    hostname = parsed.hostname.lower()
    allowed = _allowed_image_hosts()
    if allowed and not any(
        hostname == rule or (rule.startswith(".") and hostname.endswith(rule))
        for rule in allowed
    ):
        raise ValueError(f"image_url host is not allowed: {hostname}")

    for address in socket.getaddrinfo(hostname, 443, type=socket.SOCK_STREAM):
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("image_url resolved to a non-public address")


class _ValidatedRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        _validate_image_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _download_image(image_url: str, case_id: str, work_dir: Path) -> Path:
    """Download a validated public image without passing it through the API payload."""
    _validate_image_url(image_url)
    request = Request(image_url, headers={"User-Agent": "K-Ride-Media-Worker/1.0"})
    opener = build_opener(_ValidatedRedirectHandler())
    with opener.open(request, timeout=IMAGE_DOWNLOAD_TIMEOUT) as response:
        final_url = response.geturl()
        _validate_image_url(final_url)

        content_type = response.headers.get_content_type()
        if not content_type.startswith("image/"):
            raise ValueError(f"image_url returned unsupported content type: {content_type}")

        declared_size = response.headers.get("Content-Length")
        if declared_size and int(declared_size) > MAX_IMAGE_BYTES:
            raise ValueError("image_url content exceeds the 10MB limit")

        img_bytes = response.read(MAX_IMAGE_BYTES + 1)
        if len(img_bytes) > MAX_IMAGE_BYTES:
            raise ValueError("image_url content exceeds the 10MB limit")

    if img_bytes[:3] == b"\xff\xd8\xff":
        ext = ".jpg"
    elif img_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        ext = ".png"
    elif img_bytes[:6] in (b"GIF87a", b"GIF89a"):
        ext = ".gif"
    elif img_bytes[:4] == b"RIFF" and img_bytes[8:12] == b"WEBP":
        ext = ".webp"
    else:
        raise ValueError("image_url did not return a supported image file")
    img_path = work_dir / f"{case_id}{ext}"
    img_path.write_bytes(img_bytes)
    return img_path


def _encode_artifacts(result_dict: dict) -> dict:
    """Publish final media and prepare a payload-safe RunPod response."""
    return finalize_result(result_dict)


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

        # Batch video route — multiple images
        if route == "batch_video":
            images_raw = job_input.get("images", [])
            if not images_raw or not isinstance(images_raw, list):
                return {"error": "images[] array is required for batch_video route"}

            items: list[BatchImageItem] = []
            download_failed_indexes: list[int] = []
            for idx, img_data in enumerate(images_raw[:10]):
                image_url = img_data.get("image_url", "")
                if not image_url:
                    download_failed_indexes.append(idx)
                    continue
                try:
                    img_path = _download_image(
                        image_url,
                        f"{job_input.get('case_id', 'batch')}_img{idx}",
                        work_dir,
                    )
                except Exception as exc:
                    print(f"[runpod_handler] Image download failed for index {idx}: {exc}")
                    download_failed_indexes.append(idx)
                    continue
                items.append(BatchImageItem(
                    index=idx,
                    image_path=img_path,
                    tts_text=img_data.get("tts_text", ""),
                    image_type=img_data.get("image_type", "auto"),
                ))

            if not items:
                return {"error": "No valid images found in images[] array"}

            batch_case = BatchTravelCase(
                case_id=job_input.get("case_id", "batch"),
                place=job_input.get("place", "Community Post"),
                items=items,
                bgm_key=job_input.get("bgm_key", "bright_travel"),
                photo_route=job_input.get("photo_route", "auto"),
                bgm_description=job_input.get("bgm_description", ""),
                bgm_duration=min(job_input.get("bgm_duration", 15), 30),
            )
            result = run_batch_video_case(batch_case, work_dir, cfg)
            result_dict = result.to_dict()
            metadata = result_dict.setdefault("metadata", {})
            worker_failed = metadata.get("failed_image_indexes", [])
            if not isinstance(worker_failed, list):
                worker_failed = []
            metadata["total_images"] = min(len(images_raw), 10)
            metadata["failed_image_indexes"] = sorted(
                set(download_failed_indexes + worker_failed)
            )
            metadata["processed_images"] = (
                metadata["total_images"] - len(metadata["failed_image_indexes"])
            )
            return _encode_artifacts(result_dict)

        # Video routes need an image
        image_url = job_input.get("image_url", "")
        if not image_url:
            return {"error": "image_url is required for video routes"}

        image_path = _download_image(
            image_url,
            job_input.get("case_id", "img"),
            work_dir,
        )

        case = TravelCase(
            case_id=job_input.get("case_id", "default"),
            place=job_input.get("place", "Unknown"),
            image_path=image_path,
            tts_text=job_input.get("tts_text", "여행 영상입니다."),
            bgm_key=job_input.get("bgm_key", "bright_travel"),
            prompt=job_input.get("prompt", ""),
            motion=job_input.get("motion", "slow_zoom_in"),
            motion_intensity=float(job_input.get("motion_intensity", 0.03)),
            trajectory_points=job_input.get("trajectory_points"),
            trajectory_preset=job_input.get("trajectory_preset", ""),
        )

        bgm_wav = ensure_fallback_bgm(work_dir / "bgm", case.bgm_key)

        if route == "animated_drawings_worker":
            result = run_animated_drawings_worker_case(case, work_dir, bgm_wav, cfg=cfg)
            return _encode_artifacts(result.to_dict())

        if route == "tora_cogvideox_i2v":
            result = run_tora_cogvideox_case(case, work_dir, bgm_wav, cfg=cfg)
        elif route == "cogvideox_real":
            result = run_cogvideox_real_case(case, work_dir, bgm_wav, cfg=cfg)
        elif route == "3d_photo_inpainting_real":
            result = run_3d_photo_inpainting_real_case(case, work_dir, bgm_wav, cfg=cfg)
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
