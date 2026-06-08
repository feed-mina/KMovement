"""
celery_app.py — Celery 비동기 작업 큐 설정
==========================================
브로커/백엔드: Redis (DB 1)

환경변수:
  CELERY_BROKER_URL    — Redis broker URL (기본: redis://localhost:6379/1)
  CELERY_RESULT_BACKEND — Redis result backend URL (기본: broker와 동일)

Redis DB 번호 규약:
  DB 0 — Spring Boot (cache, token, OAuth, location)
  DB 1 — FastAPI Celery broker / result backend
  RunPod 내부 — localhost:6379/0 (컨테이너 전용 embedded Redis)
"""
from __future__ import annotations

import os

from celery import Celery

BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")
RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", BROKER_URL)

celery = Celery("kride", broker=BROKER_URL, backend=RESULT_BACKEND)
celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,          # Spot VM 대비: 작업 완료 후 ACK
    task_track_started=True,      # 상태 API에서 STARTED 상태 노출
    worker_prefetch_multiplier=1, # 한 번에 1개만 프리페치
    result_expires=3600,          # 결과 1시간 후 만료 (Redis 메모리 보호)
    task_routes={
        "src.api.tasks.task_embed_texts":     {"queue": "ml"},
        "src.api.tasks.task_rerank":          {"queue": "ml"},
        "src.api.tasks.task_predict_weather": {"queue": "ml"},
        "src.api.tasks.task_classify_event":  {"queue": "ml"},
        "src.api.tasks.task_generate_tts":    {"queue": "media"},
        "src.api.tasks.task_generate_video":  {"queue": "media"},
    },
)

# 태스크 모듈 자동 탐색
celery.autodiscover_tasks(["src.api"])
