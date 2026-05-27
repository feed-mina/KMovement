from __future__ import annotations

from pathlib import Path

from .ffmpeg_utils import make_sine_bgm


BGM_PRESETS = {
    "bright_travel": ("440", "660"),
    "cute_character": ("523.25", "783.99"),
    "city_walk": ("330", "495"),
    "cinematic_memory": ("261.63", "392"),
}


def ensure_fallback_bgm(output_dir: Path, key: str, *, duration: int = 45) -> Path:
    """Create or reuse a deterministic lightweight BGM preset."""
    if key not in BGM_PRESETS:
        key = "bright_travel"

    output_dir.mkdir(parents=True, exist_ok=True)
    output_wav = output_dir / f"bgm_{key}.wav"
    if output_wav.exists():
        return output_wav

    frequency_a, frequency_b = BGM_PRESETS[key]
    return make_sine_bgm(output_wav, frequency_a=frequency_a, frequency_b=frequency_b, duration=duration)

