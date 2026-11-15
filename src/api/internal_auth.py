"""내부 호출(Spring → FastAPI) 인증 키 확인.

fastapi_server.py 에서 떼어 낸 라우터. 주소와 동작은 그대로다.
"""
from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException

FASTAPI_INTERNAL_API_KEY = (
    os.environ.get("FASTAPI_INTERNAL_API_KEY", "").strip()
)


def _require_internal_api_key(
    x_internal_api_key: str = Header(default="", alias="X-Internal-Api-Key"),
) -> None:
    if not FASTAPI_INTERNAL_API_KEY or not hmac.compare_digest(
        x_internal_api_key,
        FASTAPI_INTERNAL_API_KEY,
    ):
        raise HTTPException(status_code=401, detail="Invalid internal API key.")
