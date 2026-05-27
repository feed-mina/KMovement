from __future__ import annotations

from pathlib import Path

from .ffmpeg_utils import mp3_to_wav


def synthesize_gtts(text: str, output_wav: Path, *, lang: str = "ko") -> Path:
    """Generate Korean narration with gTTS.

    This is the stable cloud fallback TTS. GPT-SoVITS is intentionally not
    imported here because it requires a heavy, isolated runtime.
    """
    from gtts import gTTS

    output_wav.parent.mkdir(parents=True, exist_ok=True)
    mp3_path = output_wav.with_suffix(".mp3")
    gTTS(text, lang=lang).save(str(mp3_path))
    return mp3_to_wav(mp3_path, output_wav)

