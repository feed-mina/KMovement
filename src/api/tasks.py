"""
tasks.py — Celery 비동기 태스크 정의
====================================
Phase 2: ML 모델 (TorchServe 경유)
Phase 3: 미디어 파이프라인 (gTTS/GPT-SoVITS, CogVideoX)

진행률 상태 (self.update_state):
  QUEUED → STARTED → (task-specific states) → SUCCESS / FAILURE
"""
from __future__ import annotations

import os
import traceback

import httpx

from src.api.celery_app import celery

TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8085")


# ── Phase 2: ML 태스크 (TorchServe 경유) ─────────────────────────────────────


@celery.task(bind=True, max_retries=3, default_retry_delay=5)
def task_embed_texts(self, texts: list[str]) -> list:
    """배치 임베딩 (TorchServe 경유, 비동기)"""
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/embedder",
            json={"text": texts},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=5)
def task_rerank(self, query: str, documents: list[str]) -> list:
    """리랭킹 (TorchServe 경유, 비동기)"""
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/reranker",
            json={"query": query, "documents": documents},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=5)
def task_predict_weather(self, sequence: list) -> dict:
    """날씨 예측 (TorchServe 경유, 비동기)"""
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/weather_lstm",
            json={"sequence": sequence},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=3, default_retry_delay=5)
def task_classify_event(self, text: str) -> dict:
    """이벤트 분류 (TorchServe 경유, 비동기)"""
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/event_ner",
            json={"text": text},
            timeout=15.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as exc:
        raise self.retry(exc=exc)


# ── Phase 3: 미디어 파이프라인 태스크 ─────────────────────────────────────────


@celery.task(bind=True, max_retries=2, default_retry_delay=10)
def task_generate_tts(self, text: str, voice_id: str = "default", lang: str = "ko") -> dict:
    """gTTS 음성 합성 → Cloudinary 업로드 → URL 반환

    진행 상태: STARTED → TTS_RUNNING → UPLOADING → SUCCESS
    """
    from pathlib import Path
    import tempfile

    self.update_state(state="TTS_RUNNING", meta={"step": "tts", "progress": 20})

    try:
        work_dir = Path(tempfile.mkdtemp(prefix="celery_tts_"))

        # gTTS 생성
        from deploy.media_motion.tts import synthesize_gtts
        wav_path = synthesize_gtts(text, work_dir / "tts_output.wav", lang=lang)

        self.update_state(state="UPLOADING", meta={"step": "uploading", "progress": 70})

        # Cloudinary 업로드
        from deploy.media_motion.cloudinary_upload import upload_to_cloudinary
        upload_result = upload_to_cloudinary(
            wav_path,
            folder="kride/celery/tts",
            resource_type="auto",
        )

        if upload_result["ok"]:
            return {
                "status": "success",
                "url": upload_result["url"],
                "source": upload_result["source"],
                "text_length": len(text),
            }
        else:
            if os.environ.get("KRIDE_RESULT_URL_REQUIRED", "false").lower() in {"1", "true", "yes", "on"}:
                raise RuntimeError(upload_result.get("error", "TTS upload failed"))
            return {
                "status": "success",
                "url": str(wav_path),
                "source": "local",
                "text_length": len(text),
                "upload_error": upload_result.get("error", ""),
            }
    except Exception as exc:
        traceback.print_exc()
        raise self.retry(exc=exc)


@celery.task(bind=True, max_retries=1, default_retry_delay=30, time_limit=1800)
def task_generate_video(
    self,
    image_url: str,
    route: str = "cogvideox_real",
    tts_text: str = "",
    case_id: str = "celery_video",
    bgm_key: str = "bright_travel",
    motion: str = "slow_zoom_in",
    prompt: str = "",
    allow_fallback: bool = True,
) -> dict:
    """영상 생성 파이프라인 → Cloudinary 업로드 → URL 반환

    진행 상태: STARTED → DOWNLOADING → VIDEO_RUNNING → TTS_RUNNING → MIXING → UPLOADING → SUCCESS

    지원 route: cogvideox_real, 3d_photo_light, 3d_photo_inpainting_real
    """
    from pathlib import Path
    import tempfile

    work_dir = Path(tempfile.mkdtemp(prefix="celery_video_"))

    try:
        # 1. 이미지 다운로드
        self.update_state(state="DOWNLOADING", meta={"step": "downloading", "progress": 5})

        from deploy.media_motion.runpod_handler import _download_image
        img_path = _download_image(image_url, case_id, work_dir)

        # 2. BGM 준비
        from deploy.media_motion.bgm import ensure_fallback_bgm
        bgm_wav = ensure_fallback_bgm(work_dir / "bgm", bgm_key)

        # 3. Worker config
        from deploy.media_motion.worker_config import load_worker_config
        cfg = load_worker_config(allow_fallback=allow_fallback)

        # 4. TravelCase 생성
        from deploy.media_motion.schemas import TravelCase
        case = TravelCase(
            case_id=case_id,
            place="Celery Job",
            image_path=img_path,
            tts_text=tts_text or "영상입니다.",
            bgm_key=bgm_key,
            prompt=prompt,
            motion=motion,
        )

        # 5. 영상 생성
        self.update_state(state="VIDEO_RUNNING", meta={"step": "video", "progress": 20})

        if route == "cogvideox_real":
            from deploy.media_motion.cogvideox_real import run_cogvideox_real_case
            result = run_cogvideox_real_case(case, work_dir, bgm_wav, cfg=cfg)
        elif route == "3d_photo_inpainting_real":
            from deploy.media_motion.three_d_photo_real import run_3d_photo_inpainting_real_case
            result = run_3d_photo_inpainting_real_case(case, work_dir, bgm_wav, cfg=cfg)
        elif route == "3d_photo_light":
            from deploy.media_motion.three_d_photo_light import run_3d_photo_light_case
            result = run_3d_photo_light_case(case, work_dir, bgm_wav)
        else:
            raise ValueError(f"Unsupported route: {route}")

        # 6. Cloudinary 업로드
        self.update_state(state="UPLOADING", meta={"step": "uploading", "progress": 80})

        from deploy.media_motion.result_delivery import finalize_result
        final = finalize_result(result.to_dict())

        result_url = ""
        uploads = final.get("uploads", [])
        for u in uploads:
            if u.get("kind") == "final_video" and u.get("ok"):
                result_url = u["url"]
                break
        if not result_url:
            # 로컬 경로 fallback
            for art in result.artifacts:
                if art.kind == "final_video" and art.path and Path(art.path).exists():
                    result_url = str(art.path)
                    break

        return {
            "status": result.status,
            "route": result.route,
            "result_url": result_url,
            "actual_model_executed": result.metadata.get("actual_model_executed", False),
            "case_id": case_id,
        }

    except Exception as exc:
        traceback.print_exc()
        raise self.retry(exc=exc)
