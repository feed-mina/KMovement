"""
MusicGen BGM synthesis — reusable helper.

Extracted from runpod_handler._run_musicgen() so that both the
direct RunPod route and the Celery task can share the same logic.
"""
from __future__ import annotations

import os
from pathlib import Path


def synthesize_musicgen(
    description: str,
    output_wav: Path,
    *,
    duration: int = 15,
    model_name: str | None = None,
) -> Path:
    """Generate a BGM WAV file using MusicGen.

    After inference the model is deleted and CUDA cache is cleared
    to free VRAM for subsequent CogVideoX runs.

    Raises on failure — the caller is responsible for fallback logic.
    """
    import soundfile as sf
    import torch
    from audiocraft.models import MusicGen

    model_name = model_name or os.environ.get("MUSICGEN_MODEL", "facebook/musicgen-small")
    output_wav = Path(output_wav)
    output_wav.parent.mkdir(parents=True, exist_ok=True)

    model = MusicGen.get_pretrained(model_name)
    model.set_generation_params(duration=min(duration, 30), use_sampling=True, top_k=250)

    wav = model.generate([description])

    audio_data = wav[0].cpu().numpy()
    if audio_data.ndim > 1:
        audio_data = audio_data.squeeze()
    sf.write(str(output_wav), audio_data, samplerate=32000)

    del model
    torch.cuda.empty_cache()

    return output_wav
