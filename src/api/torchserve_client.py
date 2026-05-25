"""TorchServe HTTP client with local CPU fallbacks.

Production can run without TorchServe by setting TORCHSERVE_ENABLED=false.
Embedding and reranking then run in-process with sentence-transformers.
"""
from __future__ import annotations

import os

import httpx

TORCHSERVE_URL = os.environ.get("TORCHSERVE_URL", "http://localhost:8085")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small")
RERANKER_MODEL = os.environ.get("RERANKER_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


TORCHSERVE_ENABLED = _env_bool("TORCHSERVE_ENABLED", True)
TORCHSERVE_FALLBACK = _env_bool("TORCHSERVE_FALLBACK", True)

_local_embedder = None
_local_reranker = None


def _get_local_embedder():
    global _local_embedder
    if _local_embedder is None:
        from sentence_transformers import SentenceTransformer

        _local_embedder = SentenceTransformer(EMBED_MODEL)
    return _local_embedder


def _get_local_reranker():
    global _local_reranker
    if _local_reranker is None:
        from sentence_transformers import CrossEncoder

        _local_reranker = CrossEncoder(RERANKER_MODEL)
    return _local_reranker


def _local_embed_texts(texts: list[str]) -> list[list[float]]:
    vectors = _get_local_embedder().encode(texts, normalize_embeddings=True)
    return vectors.tolist() if hasattr(vectors, "tolist") else list(vectors)


def _local_rerank(query: str, documents: list[str]) -> list[float]:
    if not documents:
        return []
    scores = _get_local_reranker().predict([(query, doc) for doc in documents])
    return scores.tolist() if hasattr(scores, "tolist") else list(scores)


def _local_event_classify(text: str) -> dict:
    lowered = text.lower()
    if any(word in lowered for word in ["concert", "festival", "show"]):
        event_type = "concert"
    elif any(word in lowered for word in ["strike", "accident", "delay"]):
        event_type = "disruption"
    else:
        event_type = "general"
    return {"event_type": event_type, "score": 0.5}


def _local_weather_default() -> dict:
    return {"class": 0, "label": "clear", "proba": [1.0], "safety_penalty": 0.0}


def embed_texts_sync(texts: list[str]) -> list[list[float]]:
    if not TORCHSERVE_ENABLED:
        return _local_embed_texts(texts)
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/embedder",
            json={"text": texts},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        if TORCHSERVE_FALLBACK:
            return _local_embed_texts(texts)
        raise


def rerank_sync(query: str, documents: list[str]) -> list[float]:
    if not TORCHSERVE_ENABLED:
        return _local_rerank(query, documents)
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/reranker",
            json={"query": query, "documents": documents},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        if TORCHSERVE_FALLBACK:
            return _local_rerank(query, documents)
        raise


def predict_weather_sync(sequence: list) -> dict:
    if not TORCHSERVE_ENABLED:
        return _local_weather_default()
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/weather_lstm",
            json={"sequence": sequence},
            timeout=5.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        if TORCHSERVE_FALLBACK:
            return _local_weather_default()
        raise


def classify_event_sync(text: str) -> dict:
    if not TORCHSERVE_ENABLED:
        return _local_event_classify(text)
    try:
        resp = httpx.post(
            f"{TORCHSERVE_URL}/predictions/event_ner",
            json={"text": text},
            timeout=10.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception:
        if TORCHSERVE_FALLBACK:
            return _local_event_classify(text)
        raise


async def embed_texts(texts: list[str]) -> list[list[float]]:
    if not TORCHSERVE_ENABLED:
        return _local_embed_texts(texts)
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{TORCHSERVE_URL}/predictions/embedder",
                json={"text": texts},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if TORCHSERVE_FALLBACK:
                return _local_embed_texts(texts)
            raise


async def rerank(query: str, documents: list[str]) -> list[float]:
    if not TORCHSERVE_ENABLED:
        return _local_rerank(query, documents)
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{TORCHSERVE_URL}/predictions/reranker",
                json={"query": query, "documents": documents},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if TORCHSERVE_FALLBACK:
                return _local_rerank(query, documents)
            raise


async def predict_weather(sequence: list) -> dict:
    if not TORCHSERVE_ENABLED:
        return _local_weather_default()
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.post(
                f"{TORCHSERVE_URL}/predictions/weather_lstm",
                json={"sequence": sequence},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if TORCHSERVE_FALLBACK:
                return _local_weather_default()
            raise


async def classify_event(text: str) -> dict:
    if not TORCHSERVE_ENABLED:
        return _local_event_classify(text)
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                f"{TORCHSERVE_URL}/predictions/event_ner",
                json={"text": text},
            )
            resp.raise_for_status()
            return resp.json()
        except Exception:
            if TORCHSERVE_FALLBACK:
                return _local_event_classify(text)
            raise
