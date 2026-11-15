"""RunPod Serverless 프록시 (커뮤니티 영상 생성).

fastapi_server.py 에서 떼어 낸 라우터. 주소와 동작은 그대로다.
"""
from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from src.api.internal_auth import _require_internal_api_key

router = APIRouter()

RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY", "")
RUNPOD_ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "")
RUNPOD_MEDIA_ENDPOINT_ID = os.environ.get("RUNPOD_MEDIA_ENDPOINT_ID", "") or RUNPOD_ENDPOINT_ID
RUNPOD_TORA_ENDPOINT_ID = os.environ.get("RUNPOD_TORA_ENDPOINT_ID", "") or RUNPOD_ENDPOINT_ID

# Tora 전용 라우트 목록 — 이 라우트는 B타입 엔드포인트로 전송
_TORA_ROUTES = {"tora_cogvideox_i2v"}


def _resolve_endpoint_id(route: str) -> str:
    """라우트에 따라 적절한 RunPod 엔드포인트 ID를 반환한다."""
    if route in _TORA_ROUTES:
        return RUNPOD_TORA_ENDPOINT_ID
    return RUNPOD_MEDIA_ENDPOINT_ID


def _configured_runpod_endpoint_ids() -> list[str]:
    endpoint_ids: list[str] = []
    for endpoint_id in (RUNPOD_MEDIA_ENDPOINT_ID, RUNPOD_TORA_ENDPOINT_ID, RUNPOD_ENDPOINT_ID):
        if endpoint_id and endpoint_id not in endpoint_ids:
            endpoint_ids.append(endpoint_id)
    return endpoint_ids


class RunPodJobRequest(BaseModel):
    route: str = Field(..., description="animated_drawings_worker, cogvideox_real, 3d_photo_inpainting_real, tora_cogvideox_i2v 등")
    case_id: str = "travel_case"
    place: str = "Travel Place"
    image_url: str = Field(..., min_length=1)
    tts_text: str = "여행 영상입니다."
    bgm_key: str = "bright_travel"
    motion: str = "slow_zoom_in"
    motion_intensity: float = 0.03
    prompt: str = ""
    allow_fallback: bool = True
    musicgen_description: str = "calm Korean ambient music"
    musicgen_duration: int = 15
    trajectory_points: list | None = None  # [[x,y], ...] normalized 0.0~1.0
    trajectory_preset: str = ""  # "object_pan_right", "arc_up", etc.
    overlay_image_url: str = ""
    overlay_position: str = "main_w-overlay_w-10:main_h-overlay_h-10"
    overlay_alpha: float = Field(default=1.0, ge=0.1, le=1.0)
    overlay_speed: float = Field(default=1.0, ge=0.5, le=2.0)
    overlay_scale_ratio: float = Field(default=0.2, gt=0.0, le=1.0)


class BatchImageInput(BaseModel):
    image_url: str = Field(..., min_length=1)
    tts_text: str = ""
    image_type: str = "auto"


class RunPodBatchJobRequest(BaseModel):
    case_id: str = "batch_case"
    place: str = "Community Post"
    images: list[BatchImageInput] = Field(..., min_length=1, max_length=10)
    bgm_key: str = "bright_travel"
    photo_route: str = "auto"  # "auto", "cogvideox_real", "3d_photo_light"
    allow_fallback: bool = True
    bgm_description: str = ""  # MusicGen prompt (empty → sine-wave fallback)
    bgm_duration: int = 15  # MusicGen generation length in seconds
    default_tts_text: str = ""  # BLIP-2 실패 시 fallback TTS (게시글 제목)


@router.post("/jobs/runpod/batch")
def runpod_batch_proxy(
    request: RunPodBatchJobRequest,
    _: None = Depends(_require_internal_api_key),
):
    """Proxy batch video job to RunPod Serverless endpoint."""
    endpoint_id = RUNPOD_MEDIA_ENDPOINT_ID
    if not RUNPOD_API_KEY or not endpoint_id:
        return JSONResponse(
            status_code=501,
            content={"ok": False, "message": "RUNPOD_API_KEY and RUNPOD_MEDIA_ENDPOINT_ID are required."},
        )

    payload = {
        "input": {
            "route": "batch_video",
            "case_id": request.case_id,
            "place": request.place,
            "images": [img.model_dump() for img in request.images],
            "bgm_key": request.bgm_key,
            "photo_route": request.photo_route,
            "allow_fallback": request.allow_fallback,
            "bgm_description": request.bgm_description,
            "bgm_duration": request.bgm_duration,
            "default_tts_text": request.default_tts_text,
        }
    }
    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}
    url = f"https://api.runpod.ai/v2/{endpoint_id}/run"

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return JSONResponse(content={"ok": True, "endpoint": endpoint_id, "endpoint_id": endpoint_id, **resp.json()})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})


@router.post("/jobs/runpod")
def runpod_proxy(
    request: RunPodJobRequest,
    _: None = Depends(_require_internal_api_key),
):
    endpoint_id = _resolve_endpoint_id(request.route)
    if not RUNPOD_API_KEY or not endpoint_id:
        return JSONResponse(
            status_code=501,
            content={"ok": False, "message": "RUNPOD_API_KEY and endpoint ID are required."},
        )

    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}
    payload = {"input": request.model_dump()}
    url = f"https://api.runpod.ai/v2/{endpoint_id}/run"

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return JSONResponse(content={"ok": True, "endpoint": endpoint_id, "endpoint_id": endpoint_id, **resp.json()})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})


@router.get("/jobs/runpod/{job_id}")
def runpod_status(
    job_id: str,
    endpoint: str = "",
    _: None = Depends(_require_internal_api_key),
):
    """RunPod 작업 상태 조회.

    endpoint 파라미터로 조회할 엔드포인트를 지정할 수 있다.
    미지정 시 기본(Media) 엔드포인트를 먼저 조회하고, 404면 Tora 엔드포인트도 시도한다.
    """
    if not RUNPOD_API_KEY:
        return JSONResponse(status_code=501, content={"ok": False, "message": "RunPod not configured."})

    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}

    # 명시적 endpoint 지정 시 해당 엔드포인트만 조회
    if endpoint:
        url = f"https://api.runpod.ai/v2/{endpoint}/status/{job_id}"
        try:
            resp = httpx.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            return JSONResponse(content={"ok": True, "endpoint": endpoint, "endpoint_id": endpoint, **resp.json()})
        except Exception as exc:
            return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})

    # 미지정 시 Media → Tora 순서로 시도
    endpoints_to_try = _configured_runpod_endpoint_ids()
    if not endpoints_to_try:
        return JSONResponse(status_code=501, content={"ok": False, "message": "No RunPod endpoint configured."})

    last_exc = None
    for eid in endpoints_to_try:
        url = f"https://api.runpod.ai/v2/{eid}/status/{job_id}"
        try:
            resp = httpx.get(url, headers=headers, timeout=15)
            if resp.status_code == 404:
                continue
            resp.raise_for_status()
            return JSONResponse(content={"ok": True, "endpoint": eid, "endpoint_id": eid, **resp.json()})
        except Exception as exc:
            last_exc = exc

    return JSONResponse(
        status_code=502,
        content={"ok": False, "error": str(last_exc)[:2000] if last_exc else "Job not found on any endpoint."},
    )
