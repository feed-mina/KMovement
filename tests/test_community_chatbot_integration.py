"""
test_community_chatbot_integration.py — KRIDE 커뮤니티 + 챗봇 통합 테스트
==========================================================================

실행:
  cd D:/kride-project
  pytest tests/test_community_chatbot_integration.py -v

검증 대상:
  - FastAPI /api/recommend/ai 엔드포인트 구조
  - FastAPI /api/recommend/itinerary 엔드포인트 구조
  - FastAPI /api/artists, /api/regions 엔드포인트
  - HAS_AI=False 시 503 응답
"""

from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock, patch

import pytest

# ── 외부 패키지 stub (import 전에 설정) ──
def _stub(name: str):
    if name not in sys.modules:
        mod = types.ModuleType(name)
        mod.__dict__.setdefault("__all__", [])
        sys.modules[name] = mod
    return sys.modules[name]

for _pkg in [
    "neo4j", "chromadb", "groq", "supabase", "sentence_transformers",
    "lightgbm", "sklearn", "sklearn.model_selection",
]:
    _stub(_pkg)

# ensemble_client를 가짜 모듈로 대체 (pickle 모델 로드 방지)
_ens = types.ModuleType("src.api.ensemble_client")
_ens.rank_pois = MagicMock(return_value=[])
sys.modules["src.api.ensemble_client"] = _ens

# feature_engineering도 stub (numpy import 지연 방지)
_fe = types.ModuleType("src.ml.feature_engineering")
_fe.compute_features = MagicMock(return_value=[])
sys.modules["src.ml.feature_engineering"] = _fe

from fastapi.testclient import TestClient

# FastAPI 앱 임포트 (stub 설정 이후에 해야 ImportError/hang 방지)
from src.api.fastapi_server import app  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)


# ══════════════════════════════════════════════════════════════════════════════
# 1. /api/recommend/ai — AI 추천
# ══════════════════════════════════════════════════════════════════════════════
MOCK_POIS = [
    {"poi_id": "poi_14", "name": "경복궁", "lat": 37.576, "lon": 126.977, "category": "tourism"},
    {"poi_id": "poi_60", "name": "길상도예", "lat": 37.486, "lon": 127.032, "category": "tourism"},
]

# 지역을 함께 고른 요청은 주소로 한 번 더 걸러진다. 주소 없는 POI 는 그
# 필터에서 전부 떨어지므로, 지역 필터를 지나야 하는 테스트는 이쪽을 쓴다.
MOCK_SEOUL_POIS = [
    {**poi, "address": "서울 종로구", "sido": "서울"} for poi in MOCK_POIS
]


class TestRecommendAI:
    def test_recommend_ai_503_when_no_ai(self):
        """HAS_AI=False 시 503 반환"""
        with patch("src.api.fastapi_server.HAS_AI", False):
            resp = client.post("/api/recommend/ai", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
            })
        assert resp.status_code == 503

    def test_recommend_ai_returns_pois_and_text(self):
        """HAS_AI=True 시 pois, recommendation_text, count 필드 반환"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_SEOUL_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value="추천 텍스트"):
            resp = client.post("/api/recommend/ai", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
            })
        assert resp.status_code == 200
        body = resp.json()
        assert "pois" in body
        assert "recommendation_text" in body
        assert "count" in body
        assert body["count"] >= 1

    def test_recommend_ai_empty_request(self):
        """빈 요청도 에러 없이 처리"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=[]), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value=""):
            resp = client.post("/api/recommend/ai", json={
                "artists": [],
                "regions": [],
                "purposes": [],
            })
        assert resp.status_code == 200
        body = resp.json()
        assert body["count"] == 0

    def test_recommend_ai_deduplication(self):
        """동일 POI가 Neo4j와 ChromaDB에서 중복 반환되면 하나만 남아야 함"""
        chroma_dup = [{"poi_id": "poi_14", "name": "경복궁", "lat": 37.576, "lon": 126.977}]
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=chroma_dup), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value=""):
            resp = client.post("/api/recommend/ai", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["tourism"],
            })
        body = resp.json()
        poi_ids = [p["poi_id"] for p in body["pois"]]
        assert len(poi_ids) == len(set(poi_ids)), "POI 중복 제거 실패"


# ══════════════════════════════════════════════════════════════════════════════
# 2. /api/recommend/itinerary — 일정 생성
# ══════════════════════════════════════════════════════════════════════════════
class TestRecommendItinerary:
    def test_itinerary_503_when_no_ai(self):
        with patch("src.api.fastapi_server.HAS_AI", False):
            resp = client.post("/api/recommend/itinerary", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
                "duration": "1박2일",
            })
        assert resp.status_code == 503

    def test_itinerary_returns_structure(self):
        """일정 생성 결과에 itinerary, mapData 키가 있어야 함"""
        mock_itinerary_result = {
            "itinerary": [{"day": 1, "morning": {"places": []}}],
            "mapData": {"markers": []},
            "source_pois": MOCK_POIS,
        }
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=mock_itinerary_result), \
             patch("src.api.fastapi_server.HAS_ENSEMBLE", False):
            resp = client.post("/api/recommend/itinerary", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
                "duration": "1박2일",
            })
        assert resp.status_code == 200
        body = resp.json()
        assert "itinerary" in body or "source_pois" in body


# ══════════════════════════════════════════════════════════════════════════════
# 3. /api/artists, /api/regions — 정적 데이터
# ══════════════════════════════════════════════════════════════════════════════
class TestStaticEndpoints:
    def test_artists_returns_list(self):
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.get_all_artists", return_value=[
                 {"id": 1, "name": "BTS", "imageUrl": "/artists/BTS.png", "name_ko": "방탄소년단"},
             ]):
            resp = client.get("/api/artists")
        assert resp.status_code == 200
        body = resp.json()
        assert "artists" in body
        assert len(body["artists"]) == 1

    def test_regions_returns_list(self):
        """Neo4j 조회가 사라져 주입할 대상이 없다. 실제 응답을 그대로 본다."""
        with patch("src.api.fastapi_server.HAS_AI", True):
            resp = client.get("/api/regions")
        assert resp.status_code == 200
        body = resp.json()
        assert "regions" in body
        assert len(body["regions"]) >= 2


# ══════════════════════════════════════════════════════════════════════════════
# 4. /api/health — 기본 동작 확인
# ══════════════════════════════════════════════════════════════════════════════
class TestHealthForChatbot:
    def test_health_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
