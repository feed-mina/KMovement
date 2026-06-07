"""
Celery tasks for parallel TTS and MusicGen BGM generation.

These tasks run inside the RunPod container's embedded Celery worker
and are dispatched as a ``group`` from batch_video_worker.
"""
from __future__ import annotations

import traceback
from pathlib import Path

from .celery_media import celery_media


@celery_media.task(bind=True, max_retries=1, default_retry_delay=5)
def task_tts_segment(
    self,
    tts_text: str,
    output_wav_path: str,
    use_gpt_sovits: bool = False,
    gpt_sovits_dir: str | None = None,
):
    """Per-image TTS generation (GPT-SoVITS preferred, gTTS fallback).

    Returns ``{"wav_path": str, "engine": "gpt_sovits"|"gtts"}``.
    """
    output_wav = Path(output_wav_path)
    output_wav.parent.mkdir(parents=True, exist_ok=True)

    # Try GPT-SoVITS first
    if use_gpt_sovits and gpt_sovits_dir:
        try:
            from .gpt_sovits_worker import synthesize_gpt_sovits
            from .worker_config import load_worker_config

            cfg = load_worker_config()
            wav_path, _meta = synthesize_gpt_sovits(tts_text, output_wav, cfg=cfg)
            return {"wav_path": str(wav_path), "engine": "gpt_sovits"}
        except Exception as exc:
            print(f"[media_tasks] GPT-SoVITS failed, falling back to gTTS: {exc}")
            traceback.print_exc()

    # gTTS fallback (always available)
    from .tts import synthesize_gtts

    wav_path = synthesize_gtts(tts_text, output_wav)
    return {"wav_path": str(wav_path), "engine": "gtts"}


@celery_media.task(bind=True, max_retries=1, default_retry_delay=5)
def task_musicgen_bgm(
    self,
    description: str,
    output_wav_path: str,
    duration: int = 15,
):
    """MusicGen BGM generation.

    Returns ``{"wav_path": str, "engine": "musicgen"}``.
    Raises on failure — caller handles sine-wave fallback.
    """
    from .musicgen_bgm import synthesize_musicgen

    wav_path = synthesize_musicgen(description, Path(output_wav_path), duration=duration)
    return {"wav_path": str(wav_path), "engine": "musicgen"}
