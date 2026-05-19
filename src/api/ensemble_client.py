"""
ensemble_client.py — 앙상블 랭커 추론 래퍼
==========================================
models/ensemble_ranker.pkl 로드 → rank_pois() 호출
"""
from __future__ import annotations

import os
import pickle
from typing import Optional

import numpy as np

from src.ml.feature_engineering import compute_features

# ── 모델 로드 ─────────────────────────────────────────────────────────────────
_model_data: dict | None = None
_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "models", "ensemble_ranker.pkl",
)


def _load_model() -> dict | None:
    global _model_data
    if _model_data is None:
        if os.path.exists(_MODEL_PATH):
            with open(_MODEL_PATH, "rb") as f:
                _model_data = pickle.load(f)
            print(f"[ensemble] 모델 로드: {_model_data.get('type', '?')} from {_MODEL_PATH}")
        else:
            print(f"[ensemble] 모델 파일 없음: {_MODEL_PATH}")
    return _model_data


def rank_pois(
    neo4j_pois: list[dict],
    chroma_pois: list[dict],
    artists: list[str],
    regions: list[str],
    purposes: list[str],
    budget: dict,
    top_k: int = 15,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
) -> list[dict]:
    """
    Neo4j + ChromaDB + co-occurrence 후보를 앙상블 모델로 랭킹.

    Returns: 상위 top_k POI 목록 (ensemble_score 추가)
    """
    model_data = _load_model()

    # 후보 수집 + 중복 제거
    merged: dict[str, dict] = {}
    for p in neo4j_pois + chroma_pois:
        key = p.get("poi_id") or p.get("name", "")
        if key and key not in merged:
            merged[key] = p
    candidates = list(merged.values())

    if not candidates:
        return []

    # 모델이 없으면 기존 union 방식 fallback
    if model_data is None:
        return candidates[:top_k]

    model = model_data["model"]

    # Neo4j 기반 정보 구성
    neo4j_poi_ids: set[str] = set()
    neo4j_artist_counts: dict[str, int] = {}
    for p in neo4j_pois:
        pid = p.get("poi_id") or p.get("name", "")
        neo4j_poi_ids.add(pid)
        artists_list = p.get("artists", [])
        neo4j_artist_counts[pid] = len(artists_list) if isinstance(artists_list, list) else 1

    # ChromaDB similarity
    chroma_sims: dict[str, float] = {}
    for p in chroma_pois:
        pid = p.get("poi_id") or p.get("name", "")
        chroma_sims[pid] = p.get("similarity", 0.5)

    # Feature 계산 + 예측
    X = np.array([
        compute_features(
            poi=p,
            neo4j_poi_ids=neo4j_poi_ids,
            neo4j_artist_counts=neo4j_artist_counts,
            chroma_similarities=chroma_sims,
            user_artists=artists,
            user_regions=regions,
            user_purposes=purposes,
            user_budget=budget,
            user_lat=user_lat,
            user_lon=user_lon,
        )
        for p in candidates
    ])

    scores = model.predict(X)

    for poi, score in zip(candidates, scores):
        poi["ensemble_score"] = float(score)

    ranked = sorted(candidates, key=lambda x: x["ensemble_score"], reverse=True)
    return ranked[:top_k]
