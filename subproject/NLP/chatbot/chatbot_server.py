"""
chatbot_server.py — K-Ride 챗봇 FastAPI 서버 (포트 8001)
========================================================
실행:
    cd subproject/NLP && python -m chatbot.chatbot_server
    또는
    cd subproject/NLP && uvicorn chatbot.chatbot_server:app --port 8001 --reload

엔드포인트:
    POST /chat        — 챗봇 대화
    POST /chat/reset  — 세션 초기화
    GET  /health      — 서버 상태
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from chatbot.chatbot_chain import chat, reset_session

app = FastAPI(
    title="K-Ride Chatbot API",
    description="멀티쿼리 + 리랭커 기반 한국 여행 챗봇",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── KST 타임존 ────────────────────────────────────────────────────────────────
KST = timezone(timedelta(hours=9))

# ── 세션 메타 (유저별 시작/종료 시간 추적) ─────────────────────────────────────
_session_meta: dict[str, dict] = {}


# ── 스키마 ────────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    user_id: str = "anonymous"
    context: dict | None = None


class ChatResponse(BaseModel):
    reply: str
    sources: list[str] = Field(default_factory=list)
    pois: list[dict] = Field(default_factory=list)
    user_id: str = "anonymous"
    timestamp: str = ""                # 응답 시각 (KST)
    session_started_at: str = ""       # 세션 시작 시각
    session_ended_at: str | None = None  # 세션 종료 시각 (reset 시 기록)


class ResetRequest(BaseModel):
    session_id: str = "default"
    user_id: str = "anonymous"


# ── 엔드포인트 ────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "kride-chatbot", "active_sessions": len(_session_meta)}


@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    """챗봇 대화"""
    now = datetime.now(KST).isoformat(timespec="seconds")

    # 세션 시작 시각 기록
    if req.session_id not in _session_meta:
        _session_meta[req.session_id] = {
            "user_id": req.user_id,
            "started_at": now,
            "ended_at": None,
        }

    result = chat(
        message=req.message,
        session_id=req.session_id,
        context=req.context,
    )
    return ChatResponse(
        **result,
        user_id=req.user_id,
        timestamp=now,
        session_started_at=_session_meta[req.session_id]["started_at"],
        session_ended_at=_session_meta[req.session_id]["ended_at"],
    )


@app.post("/chat/reset")
def reset_endpoint(req: ResetRequest):
    """세션 초기화 + 종료 시각 기록"""
    now = datetime.now(KST).isoformat(timespec="seconds")
    ended_at = None

    if req.session_id in _session_meta:
        _session_meta[req.session_id]["ended_at"] = now
        ended_at = now
        started_at = _session_meta[req.session_id]["started_at"]
    else:
        started_at = now

    reset_session(req.session_id)

    return {
        "status": "ok",
        "session_id": req.session_id,
        "user_id": req.user_id,
        "session_started_at": started_at,
        "session_ended_at": ended_at,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
