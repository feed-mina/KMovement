"""
Celery app for RunPod container — embedded Redis broker.

This Celery instance runs *inside* the RunPod container alongside
redis-server and is managed by supervisord.  It handles TTS and
MusicGen tasks in parallel while the main handler orchestrates
the video pipeline.
"""
from __future__ import annotations

from celery import Celery

celery_media = Celery(
    "kride_media",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
)

celery_media.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=600,  # 10 min
    task_routes={
        "deploy.media_motion.media_tasks.task_tts_segment": {"queue": "media"},
        "deploy.media_motion.media_tasks.task_musicgen_bgm": {"queue": "media"},
    },
)

celery_media.autodiscover_tasks(["deploy.media_motion"])
