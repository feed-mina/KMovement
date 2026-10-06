"""Authenticated, budgeted CPU streaming endpoint. No automatic paid retries."""
import asyncio
import json
import logging
import os
import time
import uuid
import anyio
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask
from starlette.responses import StreamingResponse
from src.api import ai_runtime
from src.api.itinerary_budget import reserve_budget, record_usage

router = APIRouter()
log = logging.getLogger(__name__)
SYSTEM = '한국어 여행 도우미입니다. 확인하지 않은 장소, 영업시간, 가격, 아티스트 연관을 사실로 만들지 마세요. 최신 정보 확인이 필요한 항목은 그렇게 말하세요.'


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


def frame(value):
    return 'data: ' + json.dumps(value, ensure_ascii=False) + '\n\n'


@router.post('/api/public/chat/stream')
async def stream_chat(req: ChatRequest, x_kride_token: str = Header(default=''), x_kride_user: str = Header(default='')):
    ai_runtime.authenticate(x_kride_token, x_kride_user)
    if not req.message.strip():
        raise HTTPException(422, '질문을 입력해 주세요.')
    if not os.environ.get('GROQ_API_KEY'):
        raise HTTPException(503, '답변 공급자를 준비 중입니다.')
    await ai_runtime.acquire_slot()
    client = stream = None
    closed = False

    async def cleanup():
        nonlocal closed
        if closed:
            return
        closed = True
        # Starlette cancels the producer on disconnect; still close its HTTP socket.
        with anyio.CancelScope(shield=True):
            try:
                with anyio.move_on_after(5):
                    try:
                        if stream is not None:
                            await stream.close()
                    finally:
                        if client is not None:
                            await client.close()
            finally:
                ai_runtime.slots.release()

    started = time.monotonic()
    request_id = uuid.uuid4().hex
    try:
        model, max_output = ai_runtime.model_settings()
        reservation = reserve_budget(x_kride_user, len((SYSTEM + req.message).encode()) + 1024, max_output)
        from groq import AsyncGroq
        client = AsyncGroq(api_key=os.environ['GROQ_API_KEY'], timeout=60, max_retries=0)
        stream = await asyncio.wait_for(client.chat.completions.create(
            model=model, messages=[{'role':'system','content':SYSTEM},{'role':'user','content':req.message}],
            max_completion_tokens=max_output, temperature=0, stream=True), timeout=65)
    except BaseException as error:
        await cleanup()
        if not isinstance(error, Exception):
            raise
        if isinstance(error, RuntimeError):
            raise HTTPException(429 if str(error) == 'budget_exhausted' else 503, 'AI 한도 또는 모델 설정을 확인해 주세요.')
        raise HTTPException(502, '답변 공급자에 연결하지 못했습니다.')

    async def events():
        usage = None
        first = True
        try:
            async with asyncio.timeout(max(.1, 105 - (time.monotonic() - started))):
                async for chunk in stream:
                    chunk_usage = getattr(getattr(chunk, 'x_groq', None), 'usage', None) or getattr(chunk, 'usage', None)
                    if chunk_usage is not None:
                        usage = chunk_usage
                    for choice in chunk.choices:
                        content = getattr(choice.delta, 'content', None)
                        if content:
                            if first:
                                log.info('F13 first_content request=%s ms=%d', request_id, (time.monotonic()-started)*1000)
                                first = False
                            yield frame({'content':content, 'requestId':request_id})
                if usage is None:
                    raise RuntimeError('usage_missing')
                record_usage(reservation, usage)
                yield 'data: [DONE]\n\n'
        except asyncio.CancelledError:
            raise
        except Exception:
            yield frame({'error':'generation_failed','requestId':request_id})
        finally:
            await cleanup()

    return StreamingResponse(events(), media_type='text/event-stream', background=BackgroundTask(cleanup),
        headers={'Cache-Control':'no-store','X-Accel-Buffering':'no','X-Request-ID':request_id})
