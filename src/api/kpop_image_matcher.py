"""Image-only candidate ranking. Catalog identity/evidence is rechecked by Spring.

No internet model downloads, face recognition, scraped product metadata or
automatic approval. Operators supply a local model checkpoint and licensed
catalog reference images before this optional engine can run.
"""
from __future__ import annotations

from functools import lru_cache
from io import BytesIO
import json
import os
from pathlib import Path
import warnings

MAX_PIXELS = 25_000_000
MAX_BYTES = 10 * 1024 * 1024
CATEGORIES = {"top", "bag", "shoes", "accessory"}


def unconfigured_result() -> dict:
    return {"availability": "MODEL_NOT_CONFIGURED", "grade": "INSUFFICIENT_EVIDENCE", "confidence": 0.0,
            "evidence": [{"type": "metadata", "score": 0.0, "source": "analysis_model_not_connected"}], "candidates": []}


def read_image(data: bytes):
    from PIL import Image, ImageOps
    if not data or len(data) > MAX_BYTES:
        raise ValueError("Invalid product image size.")
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        image = Image.open(BytesIO(data))
        if image.format not in {"JPEG", "PNG", "WEBP"} or image.width * image.height > MAX_PIXELS:
            raise ValueError("Invalid product image format or resolution.")
        image.load()
        return ImageOps.exif_transpose(image).convert("RGB")


def load_catalog(manifest: Path) -> list[dict]:
    if manifest.stat().st_size > 1024 * 1024:
        raise ValueError("Product image manifest is too large.")
    rows = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or len(rows) > 500:
        raise ValueError("Product image manifest must contain at most 500 references.")
    root = manifest.parent.resolve()
    approved = []
    for row in rows:
        if not isinstance(row, dict) or row.get("rightsChecked") is not True:
            continue
        ref = str(row.get("productRef", ""))
        if not ref or len(ref) > 180 or row.get("itemCategory") not in CATEGORIES:
            continue
        image = (root / str(row.get("image", ""))).resolve()
        if not image.is_relative_to(root) or not image.is_file():
            raise ValueError("Reference image must stay inside the catalog directory.")
        approved.append({**row, "productRef": ref, "path": image})
    return approved


@lru_cache(maxsize=1)
def encoder(model_name: str, checkpoint: str, checkpoint_stamp: int):
    import open_clip
    import torch
    model, _, transform = open_clip.create_model_and_transforms(model_name, pretrained=checkpoint, device="cpu")
    model.eval()

    def encode(images):
        with torch.inference_mode():
            features = model.encode_image(torch.stack([transform(i) for i in images]))
            return features / features.norm(dim=-1, keepdim=True).clamp(min=1e-12)
    return encode


def rank_images(query, rows: list[dict], encode, threshold: float) -> list[dict]:
    """Cosine ranking is visual similarity, never a wearing/identity probability."""
    query_features = encode([query])
    best: dict[str, float] = {}
    for start in range(0, len(rows), 16):
        batch = rows[start:start + 16]
        images = []
        for row in batch:
            with row["path"].open("rb") as source:
                images.append(read_image(source.read(MAX_BYTES + 1)))
        scores = (query_features @ encode(images).T)[0].tolist()
        for row, score in zip(batch, scores):
            if score >= threshold:
                ref = row["productRef"]
                best[ref] = max(best.get(ref, -1), float(score))
    return [{"productRef": ref, "evidenceGrade": "SIMILAR", "confidence": 0,
             "evidence": [{"type": "visual_similarity", "score": round(score, 6), "source": "licensed_catalog_image_comparison"}]}
            for ref, score in sorted(best.items(), key=lambda item: (-item[1], item[0]))[:20]]


def analyze_product_image(source_key: str, item_category: str | None = None, artist_id: int | None = None) -> dict:
    manifest_value = os.environ.get("KPOP_PRODUCT_IMAGE_MANIFEST", "")
    checkpoint_value = os.environ.get("KPOP_IMAGE_MODEL_CHECKPOINT", "")
    bucket = os.environ.get("KPOP_IMAGE_SOURCE_BUCKET", "")
    if not manifest_value or not checkpoint_value or not bucket:
        return unconfigured_result()
    manifest, checkpoint = Path(manifest_value).resolve(), Path(checkpoint_value).resolve()
    if not manifest.is_file() or not checkpoint.is_file():
        raise RuntimeError("Configured image model/catalog is unavailable.")
    rows = load_catalog(manifest)
    if item_category:
        rows = [row for row in rows if row["itemCategory"] == item_category]
    # Artist is a user-selected hint only; no face/name inference is performed.
    if artist_id:
        rows = [row for row in rows if artist_id in row.get("artistIds", [])]
    if not rows:
        return {"availability": "CATALOG_EMPTY", "grade": "INSUFFICIENT_EVIDENCE", "confidence": 0, "evidence": [], "candidates": []}
    import boto3
    from botocore.config import Config
    client = boto3.client("s3", config=Config(connect_timeout=5, read_timeout=15, retries={"max_attempts": 1}))
    response = client.get_object(Bucket=bucket, Key=source_key)
    stream = response["Body"]
    try:
        query = read_image(stream.read(MAX_BYTES + 1))
    finally:
        stream.close()
    encode = encoder(os.environ.get("KPOP_IMAGE_MODEL_NAME", "ViT-B-32"), str(checkpoint), checkpoint.stat().st_mtime_ns)
    threshold = float(os.environ.get("KPOP_IMAGE_MIN_SIMILARITY", "0.25"))
    if not -1 <= threshold <= 1:
        raise ValueError("Invalid image similarity threshold.")
    candidates = rank_images(query, rows, encode, threshold)
    return {"availability": "READY", "grade": "SIMILAR" if candidates else "INSUFFICIENT_EVIDENCE",
            "confidence": 0, "evidence": [], "candidates": candidates}
