"""Celery 작업 제출·상태 조회·SSE 스트림.

fastapi_server.py 에서 떼어 낸 라우터. 주소와 동작은 그대로다.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import re
import logging
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from src.api import internal_auth
from src.api.internal_auth import _require_internal_api_key

router = APIRouter()
logger = logging.getLogger("kride.itinerary")

class CeleryEmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100)


class CeleryRerankRequest(BaseModel):
    query: str = Field(..., min_length=1)
    documents: list[str] = Field(..., min_length=1, max_length=100)


class CeleryWeatherRequest(BaseModel):
    sequence: list = Field(..., min_length=1)


class CeleryEventRequest(BaseModel):
    text: str = Field(..., min_length=1)


class CeleryTtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000)
    voice_id: str = Field(default="default", min_length=1, max_length=64)
    lang: str = Field(default="ko", min_length=2, max_length=16)


class CeleryVideoRequest(BaseModel):
    image_url: str = Field(..., min_length=8, max_length=2048, pattern=r"^https://")
    route: Literal[
        "cogvideox_real",
        "3d_photo_inpainting_real",
        "3d_photo_light",
    ] = "cogvideox_real"
    tts_text: str = Field(default="", max_length=5000)
    case_id: str = Field(
        default="celery_video",
        min_length=1,
        max_length=100,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    bgm_key: str = Field(default="bright_travel", min_length=1, max_length=100)
    motion: str = Field(default="slow_zoom_in", min_length=1, max_length=100)
    prompt: str = Field(default="", max_length=4000)
    allow_fallback: bool = True


class CeleryKpopOutfitRequest(BaseModel):
    itemCategory: Literal["top", "bag", "shoes", "accessory"] | None = None
    artistId: int | None = Field(default=None, gt=0, strict=True)
    sourceKey: str = Field(
        ...,
        min_length=24,
        max_length=512,
        pattern=r"^kpop-analysis/[1-9][0-9]*/[A-Za-z0-9][A-Za-z0-9._-]*$",
    )
    contentType: Literal["image/jpeg", "image/png", "image/webp"]
    consentScope: str = Field(
        ...,
        min_length=1,
        max_length=120,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9:_-]*$",
    )


class CeleryCleanupRequest(BaseModel):
    max_age_hours: float = Field(default=6.0, ge=0.01, le=720.0)


_CELERY_TASK_ID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_CELERY_ML_TASKS_ENABLED_VALUES = {"1", "true", "yes", "on"}


def _celery_job_token(task_id: str) -> str:
    if not internal_auth.FASTAPI_INTERNAL_API_KEY:
        raise RuntimeError("internal_auth.FASTAPI_INTERNAL_API_KEY is not configured.")
    return hmac.new(
        internal_auth.FASTAPI_INTERNAL_API_KEY.encode("utf-8"),
        task_id.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _require_celery_job_token(
    task_id: str,
    x_celery_job_token: str = Header(default="", alias="X-Celery-Job-Token"),
) -> None:
    if not _CELERY_TASK_ID_PATTERN.fullmatch(task_id):
        raise HTTPException(status_code=400, detail="Invalid Celery task ID.")
    if not internal_auth.FASTAPI_INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid Celery job token.")
    expected = _celery_job_token(task_id)
    if not hmac.compare_digest(x_celery_job_token, expected):
        raise HTTPException(status_code=401, detail="Invalid Celery job token.")


def _require_ml_tasks_enabled() -> None:
    enabled = os.environ.get("CELERY_ML_TASKS_ENABLED", "").strip().lower()
    if enabled not in _CELERY_ML_TASKS_ENABLED_VALUES:
        raise HTTPException(
            status_code=503,
            detail="Celery ML tasks are disabled because no ML worker is configured.",
        )


def _celery_submit_response(result) -> JSONResponse:
    return JSONResponse(content={
        "ok": True,
        "task_id": result.id,
        "status": "QUEUED",
        "status_url": f"/jobs/celery/{result.id}",
        "stream_url": f"/jobs/celery/{result.id}/stream",
    })


def _submit_celery_task(task, *args) -> JSONResponse:
    try:
        result = task.apply_async(args=args)
    except Exception as exc:
        return JSONResponse(
            status_code=503,
            content={
                "ok": False,
                "message": "Celery broker에 작업을 제출하지 못했습니다.",
                "error": str(exc)[:2000],
            },
        )
    return _celery_submit_response(result)


@router.post("/jobs/celery/embed")
def celery_embed(
    request: CeleryEmbedRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """배치 임베딩 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_embed_texts
    return _submit_celery_task(task_embed_texts, request.texts)


@router.post("/jobs/celery/rerank")
def celery_rerank(
    request: CeleryRerankRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """리랭킹 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_rerank
    return _submit_celery_task(task_rerank, request.query, request.documents)


@router.post("/jobs/celery/weather")
def celery_weather(
    request: CeleryWeatherRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """날씨 예측 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_predict_weather
    return _submit_celery_task(task_predict_weather, request.sequence)


@router.post("/jobs/celery/event")
def celery_event(
    request: CeleryEventRequest,
    _: None = Depends(_require_internal_api_key),
    _ml_enabled: None = Depends(_require_ml_tasks_enabled),
):
    """이벤트 분류 작업을 Celery 큐에 제출"""
    from src.api.tasks import task_classify_event
    return _submit_celery_task(task_classify_event, request.text)


@router.post("/jobs/celery/tts")
def celery_tts(
    request: CeleryTtsRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Submit a validated text-to-speech job to the media queue."""
    from src.api.tasks import task_generate_tts
    return _submit_celery_task(
        task_generate_tts,
        request.text,
        request.voice_id,
        request.lang,
    )


@router.post("/jobs/celery/video")
def celery_video(
    request: CeleryVideoRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Submit a validated media-generation job to the media queue."""
    from src.api.tasks import task_generate_video
    return _submit_celery_task(
        task_generate_video,
        request.image_url,
        request.route,
        request.tts_text,
        request.case_id,
        request.bgm_key,
        request.motion,
        request.prompt,
        request.allow_fallback,
    )


@router.post("/jobs/celery/kpop-outfit-analysis")
def celery_kpop_outfit_analysis(
    request: CeleryKpopOutfitRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Submit a consent-checked K-POP outfit image for asynchronous analysis."""
    from src.api.tasks import task_analyze_kpop_outfit
    return _submit_celery_task(
        task_analyze_kpop_outfit,
        request.sourceKey,
        request.contentType,
        request.consentScope,
        request.itemCategory,
        request.artistId,
    )


@router.post("/jobs/celery/cleanup")
def celery_cleanup(
    request: CeleryCleanupRequest | None = None,
    _: None = Depends(_require_internal_api_key),
):
    """Submit an internal cleanup job used by deployment/runtime smoke checks."""
    from src.api.tasks import task_cleanup_temp
    return _submit_celery_task(
        task_cleanup_temp,
        request.max_age_hours if request is not None else None,
    )


def _celery_status_payload(task_id: str, result) -> dict:
    """AsyncResult를 polling/SSE가 공유하는 공개 응답으로 변환한다."""
    celery_status_value = result.status
    public_status = {
        "PENDING": "QUEUED",
        "STARTED": "RUNNING",
        "RETRY": "RETRYING",
    }.get(celery_status_value, celery_status_value)

    response: dict = {
        "ok": True,
        "task_id": task_id,
        "status": public_status,
        "celery_status": celery_status_value,
    }

    if celery_status_value == "SUCCESS":
        response["result"] = jsonable_encoder(result.result)
        response["meta"] = {"step": "complete", "progress": 100}
    elif celery_status_value == "FAILURE":
        response["error"] = str(result.result)[:2000] if result.result else "Unknown error"
    elif celery_status_value == "REVOKED":
        response["error"] = "Task was revoked."
    else:
        info = result.info
        if isinstance(info, dict):
            # custom update_state meta (진행률 등)
            response["meta"] = jsonable_encoder(info)

    return response


def _positive_float_env(name: str, default: float, minimum: float) -> float:
    try:
        value = float(os.environ.get(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(value, minimum)


CELERY_SSE_POLL_INTERVAL_SECONDS = _positive_float_env(
    "CELERY_SSE_POLL_INTERVAL_SECONDS", 1.0, 0.1,
)
CELERY_SSE_HEARTBEAT_SECONDS = _positive_float_env(
    "CELERY_SSE_HEARTBEAT_SECONDS", 15.0, 1.0,
)
CELERY_SSE_MAX_DURATION_SECONDS = _positive_float_env(
    "CELERY_SSE_MAX_DURATION_SECONDS", 2100.0, 60.0,
)
_CELERY_TERMINAL_STATES = {"SUCCESS", "FAILURE", "REVOKED"}


@router.get("/jobs/celery/{task_id}")
def celery_status(
    task_id: str,
    _internal: None = Depends(_require_internal_api_key),
    _job: None = Depends(_require_celery_job_token),
):
    """Celery 작업 상태를 단발 조회한다(SSE 미지원 환경의 폴백)."""
    from celery.result import AsyncResult
    from src.api.celery_app import celery as celery_app

    result = AsyncResult(task_id, app=celery_app)
    response = _celery_status_payload(task_id, result)
    return JSONResponse(content=response)


@router.get("/jobs/celery/{task_id}/stream")
async def celery_status_stream(
    task_id: str,
    request: Request,
    _internal: None = Depends(_require_internal_api_key),
    _job: None = Depends(_require_celery_job_token),
):
    """Celery 상태가 바뀔 때만 push하고 완료 후 종료하는 SSE 스트림."""
    from celery.result import AsyncResult
    from src.api.celery_app import celery as celery_app

    async def _events():
        result = AsyncResult(task_id, app=celery_app)
        loop = asyncio.get_running_loop()
        started_at = loop.time()
        last_emit_at = started_at
        last_payload_fingerprint = ""

        while True:
            if await request.is_disconnected():
                return

            try:
                # Celery Redis backend is synchronous; keep its I/O off the ASGI event loop.
                payload = await asyncio.to_thread(_celery_status_payload, task_id, result)
            except Exception as exc:
                logger.warning("Celery SSE backend read failed for %s: %s", task_id, exc)
                error_payload = {
                    "ok": False,
                    "task_id": task_id,
                    "status": "STREAM_ERROR",
                    "error": str(exc)[:2000],
                }
                yield f"data: {json.dumps(error_payload, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            fingerprint = json.dumps(payload, ensure_ascii=False, sort_keys=True)
            now = loop.time()
            if fingerprint != last_payload_fingerprint:
                yield f"data: {fingerprint}\n\n"
                last_payload_fingerprint = fingerprint
                last_emit_at = now
            elif now - last_emit_at >= CELERY_SSE_HEARTBEAT_SECONDS:
                yield ": heartbeat\n\n"
                last_emit_at = now

            if payload["celery_status"] in _CELERY_TERMINAL_STATES:
                yield "data: [DONE]\n\n"
                return

            if now - started_at >= CELERY_SSE_MAX_DURATION_SECONDS:
                timeout_payload = {
                    "ok": False,
                    "task_id": task_id,
                    "status": "STREAM_TIMEOUT",
                    "celery_status": payload["celery_status"],
                    "error": "SSE connection timed out; continue with the status endpoint.",
                }
                yield f"data: {json.dumps(timeout_payload, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            await asyncio.sleep(CELERY_SSE_POLL_INTERVAL_SECONDS)

    return StreamingResponse(
        _events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
