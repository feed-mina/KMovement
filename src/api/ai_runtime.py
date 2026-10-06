"""Single-worker admission shared by F12 and F13; budget remains persistent."""
import asyncio
import hmac
import os
from fastapi import HTTPException

slots = asyncio.Semaphore(2)


def authenticate(token, identity):
    expected = os.environ.get('KRIDE_INTERNAL_TOKEN', '')
    if not expected or not hmac.compare_digest(expected, token) or not identity.isascii() or not identity.isdigit():
        raise HTTPException(401, '인증이 필요합니다.')
    allowed = {x.strip() for x in os.environ.get('KRIDE_AI_TEST_USERS', '').split(',') if x.strip()}
    if not allowed or identity not in allowed:
        raise HTTPException(403, '현재 테스트 계정에만 공개된 기능입니다.')


def model_settings():
    model = os.environ.get('KRIDE_AI_MODEL', '').strip()
    if not model:
        raise RuntimeError('model_unconfigured')
    return model, 2048


async def acquire_slot():
    try:
        await asyncio.wait_for(slots.acquire(), timeout=.1)
    except asyncio.TimeoutError:
        raise HTTPException(429, 'AI 요청이 많습니다. 잠시 후 다시 시도해 주세요.')
