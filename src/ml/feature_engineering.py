"""
feature_engineering.py — 앙상블 랭커용 8-feature 벡터 추출
=========================================================
"""
from __future__ import annotations

import math
import os
import pickle
from typing import Optional

import numpy as np


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 좌표 간 거리 (km)"""
    R = 6371.0
    rlat1, rlon1 = math.radians(lat1), math.radians(lon1)
    rlat2, rlon2 = math.radians(lat2), math.radians(lon2)
    dlat, dlon = rlat2 - rlat1, rlon2 - rlon1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlon / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ── co-occurrence 사전 로드 ───────────────────────────────────────────────────
_cooccurrence: dict | None = None

def _load_cooccurrence() -> dict:
    global _cooccurrence
    if _cooccurrence is None:
        pkl_path = os.path.join(os.path.dirname(__file__), "..", "..", "models", "poi_cooccurrence_v2.pkl")
        if os.path.exists(pkl_path):
            with open(pkl_path, "rb") as f:
                _cooccurrence = pickle.load(f)
        else:
            _cooccurrence = {}
    return _cooccurrence


# ── 카테고리 → 목적 매핑 ─────────────────────────────────────────────────────
PURPOSE_CATEGORY_MAP = {
    "kculture": {"관광지", "문화시설", "K-pop", "한류", "촬영지"},
    "food":     {"음식점", "카페", "맛집", "식당"},
    "nature":   {"자연", "공원", "산", "바다", "해변", "자연관광지"},
    "history":  {"역사", "유적", "문화재", "박물관", "고궁"},
    "shopping": {"쇼핑", "시장", "면세점"},
    "rest":     {"숙박", "리조트", "펜션", "호텔"},
}


def compute_features(
    poi: dict,
    neo4j_poi_ids: set[str],
    neo4j_artist_counts: dict[str, int],
    chroma_similarities: dict[str, float],
    user_artists: list[str],
    user_regions: list[str],
    user_purposes: list[str],
    user_budget: dict,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
) -> np.ndarray:
    """
    단일 POI에 대해 8-feature 벡터 생성.

    Returns: np.ndarray shape (8,)
    """
    poi_id = poi.get("poi_id") or poi.get("id") or poi.get("name", "")
    poi_name = poi.get("name", "")

    # 1. neo4j_hit (0/1)
    neo4j_hit = 1.0 if poi_id in neo4j_poi_ids or poi_name in neo4j_poi_ids else 0.0

    # 2. neo4j_artist_count
    neo4j_artist_count = float(neo4j_artist_counts.get(poi_id, neo4j_artist_counts.get(poi_name, 0)))

    # 3. chroma_similarity (0~1)
    chroma_similarity = chroma_similarities.get(poi_id, chroma_similarities.get(poi_name, 0.0))

    # 4. jaccard_score (co-occurrence)
    cooc = _load_cooccurrence()
    jaccard_score = 0.0
    if cooc and poi_name:
        scores = [cooc.get((poi_name, a), cooc.get((a, poi_name), 0.0)) for a in user_artists]
        jaccard_score = max(scores) if scores else 0.0

    # 5. category_match (0/1)
    category_match = 0.0
    poi_category = poi.get("category", "")
    for purpose in user_purposes:
        cats = PURPOSE_CATEGORY_MAP.get(purpose, set())
        if any(cat in poi_category for cat in cats):
            category_match = 1.0
            break

    # 6. region_match (0/1)
    region_match = 0.0
    poi_address = poi.get("address", "") or poi.get("sido", "")
    for region in user_regions:
        if region in poi_address:
            region_match = 1.0
            break

    # 7. distance_km
    distance_km = 0.0
    if user_lat and user_lon and poi.get("lat") and poi.get("lon"):
        distance_km = haversine(user_lat, user_lon, float(poi["lat"]), float(poi["lon"]))

    # 8. budget_fit (0/1)
    budget_fit = 1.0
    avg_cost = poi.get("avg_cost")
    if avg_cost is not None and user_budget:
        bmin = user_budget.get("min", 0)
        bmax = user_budget.get("max", 2_000_000)
        budget_fit = 1.0 if bmin <= avg_cost <= bmax else 0.0

    return np.array([
        neo4j_hit,
        neo4j_artist_count,
        chroma_similarity,
        jaccard_score,
        category_match,
        region_match,
        distance_km,
        budget_fit,
    ], dtype=np.float32)


FEATURE_NAMES = [
    "neo4j_hit",
    "neo4j_artist_count",
    "chroma_similarity",
    "jaccard_score",
    "category_match",
    "region_match",
    "distance_km",
    "budget_fit",
]
