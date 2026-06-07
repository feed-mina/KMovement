"""
BLIP-2 auto-captioning + English→Korean translation.

Used by batch_video_worker when tts_text is empty:
  1. BLIP-2 generates an English caption from the image
  2. MarianMT translates it to Korean
  3. The Korean text is returned for gTTS synthesis
"""
from __future__ import annotations

from pathlib import Path

from .worker_config import WorkerConfig


def generate_caption(image_path: Path, cfg: WorkerConfig) -> str:
    """Generate a Korean caption for *image_path* using BLIP-2 + MarianMT.

    Heavy models are loaded on demand and freed immediately after inference
    to avoid VRAM conflicts with CogVideoX.
    """
    import torch
    from PIL import Image
    from transformers import (
        AutoModelForSeq2SeqLM,
        AutoTokenizer,
        BlipForConditionalGeneration,
        BlipProcessor,
    )

    # ── Step 1: BLIP-2 English caption ──────────────────────────────────────
    try:
        processor = BlipProcessor.from_pretrained(cfg.blip2_model_id)
        model = BlipForConditionalGeneration.from_pretrained(
            cfg.blip2_model_id,
            torch_dtype=torch.float16,
        ).to("cuda")

        raw_image = Image.open(image_path).convert("RGB")
        inputs = processor(raw_image, return_tensors="pt").to("cuda", torch.float16)

        with torch.no_grad():
            out_ids = model.generate(**inputs, max_new_tokens=50)

        en_caption: str = processor.decode(out_ids[0], skip_special_tokens=True).strip()
        print(f"[blip2] EN caption: {en_caption}")

        del model, processor, inputs, out_ids
        torch.cuda.empty_cache()
    except Exception as exc:
        print(f"[blip2] Caption generation failed: {exc}")
        torch.cuda.empty_cache()
        return _fallback_caption(image_path)

    if not en_caption:
        return _fallback_caption(image_path)

    # ── Step 2: English → Korean translation ────────────────────────────────
    try:
        tokenizer = AutoTokenizer.from_pretrained(cfg.blip2_translation_model_id)
        trans_model = AutoModelForSeq2SeqLM.from_pretrained(
            cfg.blip2_translation_model_id,
        ).to("cuda")

        batch = tokenizer([en_caption], return_tensors="pt", padding=True).to("cuda")

        with torch.no_grad():
            translated = trans_model.generate(**batch, max_new_tokens=100)

        ko_caption: str = tokenizer.decode(translated[0], skip_special_tokens=True).strip()
        print(f"[blip2] KO caption: {ko_caption}")

        del trans_model, tokenizer, batch, translated
        torch.cuda.empty_cache()
    except Exception as exc:
        print(f"[blip2] Translation failed: {exc}")
        torch.cuda.empty_cache()
        # Fall back to the English caption (gTTS can still read it with lang='ko')
        return en_caption

    return ko_caption or en_caption


def _fallback_caption(image_path: Path) -> str:
    """Return a simple Korean fallback based on the filename."""
    stem = image_path.stem.replace("_", " ").replace("-", " ")
    return f"여행 사진: {stem}"
