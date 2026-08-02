"""
test_fastapi.py — K-Ride FastAPI 단위 테스트
=============================================

실행:
  cd D:/kride-project
  pytest tests/test_fastapi.py -v

의존성:
  pip install pytest httpx

배포 환경 대응:
  - TestClient는 실제 HTTP 서버 없이 ASGI 앱을 직접 호출 (Vercel/EC2 불필요)
  - 외부 서비스(ChromaDB, Groq, Supabase)는 모두 patch로 격리
  - HAS_AI=True 경로와 False 경로 모두 검증
"""

from __future__ import annotations

import asyncio
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ── 외부 패키지가 없어도 import 가능하도록 stub ──────────────────────────────
def _stub(name: str):
    """존재하지 않는 패키지를 빈 MagicMock으로 대체"""
    mod = types.ModuleType(name)
    sys.modules.setdefault(name, mod)
    return mod

for _pkg in ["chromadb", "groq", "supabase", "sentence_transformers"]:
    _stub(_pkg)

# FastAPI 앱 임포트 (stub 설정 이후에 해야 ImportError 방지)
from src.api.fastapi_server import app, extract_coordinates, resolve_itinerary_markers  # noqa: E402

client = TestClient(app, raise_server_exceptions=False)


# ══════════════════════════════════════════════════════════════════════════════
# 1. 헬스체크
# ══════════════════════════════════════════════════════════════════════════════
class TestHealth:
    def test_health_returns_ok(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_has_required_fields(self):
        body = client.get("/api/health").json()
        assert "status" in body
        assert body["status"] == "ok"
        assert "graph_nodes" in body
        assert "graph_edges" in body
        assert "road_scored_rows" in body

    def test_health_numeric_fields(self):
        body = client.get("/api/health").json()
        assert isinstance(body["graph_nodes"], int)
        assert isinstance(body["graph_edges"], int)
        assert isinstance(body["road_scored_rows"], int)


# ══════════════════════════════════════════════════════════════════════════════
# 2. GET /api/artists
# ══════════════════════════════════════════════════════════════════════════════
MOCK_ARTISTS = [
    {"id": "1", "name": "BTS",   "imageUrl": "https://example.com/bts.jpg"},
    {"id": "2", "name": "아이유", "imageUrl": "https://example.com/iu.jpg"},
]

class TestArtists:
    def test_artists_fallback_when_no_ai(self):
        """HAS_AI=False → FALLBACK_ARTISTS 반환 (200)"""
        with patch("src.api.fastapi_server.HAS_AI", False):
            resp = client.get("/api/artists")
        assert resp.status_code == 200
        body = resp.json()
        assert "artists" in body
        assert len(body["artists"]) > 0

    def test_artists_returns_list(self):
        """HAS_AI=True, Supabase mock → artists 배열 반환"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.get_all_artists", return_value=MOCK_ARTISTS):
            resp = client.get("/api/artists")
        assert resp.status_code == 200
        body = resp.json()
        assert "artists" in body
        assert len(body["artists"]) == 2

    def test_artists_item_shape(self):
        """각 아티스트가 id/name/imageUrl 보유"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.get_all_artists", return_value=MOCK_ARTISTS):
            artists = client.get("/api/artists").json()["artists"]
        for a in artists:
            assert "id" in a
            assert "name" in a
            assert "imageUrl" in a

    def test_artists_fallback_on_exception(self):
        """get_all_artists 예외 → FALLBACK_ARTISTS 반환 (200)"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.get_all_artists", side_effect=Exception("DB 오류")):
            resp = client.get("/api/artists")
        assert resp.status_code == 200
        body = resp.json()
        assert "artists" in body
        assert len(body["artists"]) > 0


# ══════════════════════════════════════════════════════════════════════════════
# 3. GET /api/regions
# ══════════════════════════════════════════════════════════════════════════════
class TestRegions:
    def test_regions_served_without_ai_modules(self):
        """AI 모듈이 없어도 지역 목록은 나가야 한다.

        예전에는 Neo4j Region 노드를 먼저 조회하고 실패하면 하드코딩 목록으로
        떨어졌다. Neo4j 를 걷어낸 지금은 분기 없이 REGIONS 하나만 나간다.
        """
        with patch("src.api.fastapi_server.HAS_AI", False):
            resp = client.get("/api/regions")
        assert resp.status_code == 200
        assert len(resp.json()["regions"]) == 17

    def test_regions_cover_all_seventeen_sido(self):
        body = client.get("/api/regions").json()
        assert len(body["regions"]) == 17
        names = [r["name"] for r in body["regions"]]
        assert "서울" in names
        assert "제주" in names

    def test_region_item_has_id_and_name(self):
        for r in client.get("/api/regions").json()["regions"]:
            assert "id" in r
            assert "name" in r


# ══════════════════════════════════════════════════════════════════════════════
# 4. POST /api/recommend/ai
# ══════════════════════════════════════════════════════════════════════════════
MOCK_POIS = [
    {"poi_id": "p1", "name": "경복궁", "sido": "서울", "lat": 37.58, "lon": 126.97,
     "category": "kculture", "address": "서울 종로구", "image_url": ""},
    {"poi_id": "p2", "name": "광장시장", "sido": "서울", "lat": 37.57, "lon": 126.99,
     "category": "food", "address": "서울 종로구", "image_url": ""},
]

class TestRecommendAI:
    def test_recommend_ai_503_no_ai(self):
        with patch("src.api.fastapi_server.HAS_AI", False):
            resp = client.post("/api/recommend/ai", json={})
        assert resp.status_code == 503

    def test_recommend_ai_returns_structure(self):
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value="추천 이유"):
            resp = client.post("/api/recommend/ai", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
                "budget": {"min": 0, "max": 500000},
            })
        assert resp.status_code == 200
        body = resp.json()
        assert "pois" in body
        assert "recommendation_text" in body
        assert "count" in body

    def test_recommend_ai_budget_filter(self):
        """avg_cost 없는 POI는 예산 필터에서 제외되지 않음"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value=""):
            body = client.post("/api/recommend/ai", json={
                "artists": ["BTS"],
                "budget": {"min": 0, "max": 100},
            }).json()
        # avg_cost 없는 POI는 통과해야 함
        assert body["count"] == len(MOCK_POIS)

    def test_recommend_ai_empty_request(self):
        """빈 요청도 200 반환 (graphrag/chroma 결과 없으면 count=0)"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=[]), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value=""):
            resp = client.post("/api/recommend/ai", json={})
        assert resp.status_code == 200
        assert resp.json()["count"] == 0

    def test_recommend_ai_deduplication(self):
        """같은 poi_id POI는 중복 제거"""
        dup = MOCK_POIS + [MOCK_POIS[0]]   # p1 중복
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=dup), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_recommendation_text", return_value=""):
            body = client.post("/api/recommend/ai", json={
                "artists": ["BTS"],
            }).json()
        assert body["count"] == len(MOCK_POIS)   # 중복 제거 후 2개


# ══════════════════════════════════════════════════════════════════════════════
# 5. POST /api/recommend/itinerary
# ══════════════════════════════════════════════════════════════════════════════
MOCK_ITINERARY = {
    "itinerary": [
        {
            "day": 1,
            "morning":   {"places": [{"name": "경복궁", "address": "서울 종로구", "tip": "개장 직후 방문"}]},
            "afternoon": {"places": [{"name": "광장시장", "address": "서울 종로구", "tip": "육회비빔밥"}]},
        }
    ]
}

class TestItinerary:
    def test_coordinate_aliases_are_normalized(self):
        assert extract_coordinates({"mapy": "37.5665", "mapx": "126.9780"}) == {
            "lat": 37.5665,
            "lng": 126.978,
        }
        assert extract_coordinates({"latitude": 37.5, "longitude": 127.0}) == {
            "lat": 37.5,
            "lng": 127.0,
        }
        assert extract_coordinates({"lat": 91, "lon": 127}) is None

    def test_inline_itinerary_coordinates_create_complete_markers(self):
        itinerary = [{
            "day": 1,
            "morning": {"places": [{"name": "경복궁", "latitude": "37.58", "longitude": "126.97"}]},
            "afternoon": {"places": []},
        }]

        result = asyncio.run(resolve_itinerary_markers(itinerary, []))

        assert result["markerResolutionStatus"] == "complete"
        assert result["resolvedMarkerCount"] == 1
        assert result["markers"][0]["coordinateSource"] == "itinerary"
        assert result["markers"][0]["day"] == 1

    def test_partial_resolution_keeps_valid_source_markers(self):
        itinerary = [{
            "day": 1,
            "morning": {"places": [{"name": "경복궁"}, {"name": "알 수 없는 장소"}]},
            "afternoon": {"places": []},
        }]
        source_pois = [{"poi_id": "p1", "name": "경복궁", "lat": 37.58, "lon": 126.97}]

        with patch("src.api.fastapi_server.geocode_address", new=AsyncMock(return_value=None)):
            result = asyncio.run(resolve_itinerary_markers(itinerary, source_pois))

        assert result["markerResolutionStatus"] == "partial"
        assert [marker["name"] for marker in result["markers"]] == ["경복궁"]
        assert result["unresolvedPlaces"][0]["name"] == "알 수 없는 장소"

    def test_itinerary_503_no_ai(self):
        with patch("src.api.fastapi_server.HAS_AI", False):
            resp = client.post("/api/recommend/itinerary", json={})
        assert resp.status_code == 503

    def test_itinerary_returns_structure(self):
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=MOCK_ITINERARY):
            resp = client.post("/api/recommend/itinerary", json={
                "duration": "당일치기",
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
                "budget": {"min": 0, "max": 500000},
            })
        assert resp.status_code == 200
        body = resp.json()
        assert "itinerary" in body
        assert "mapData" in body
        assert "markers" in body["mapData"]
        assert "markerResolutionStatus" in body
        assert "unresolvedPlaces" in body

    def test_itinerary_day_count_onenight(self):
        two_day = {
            "itinerary": [
                {"day": 1, "morning": {"places": []}, "afternoon": {"places": []}},
                {"day": 2, "morning": {"places": []}, "afternoon": {"places": []}},
            ]
        }
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=[]), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=two_day):
            body = client.post("/api/recommend/itinerary", json={"duration": "1박2일"}).json()
        assert len(body["itinerary"]) == 2

    def test_itinerary_markers_from_pois_with_coords(self):
        """좌표 있는 POI만 markers에 포함"""
        no_coord_poi = {"poi_id": "p3", "name": "좌표없음", "category": "food"}
        pois_mixed = MOCK_POIS + [no_coord_poi]
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=pois_mixed), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=MOCK_ITINERARY):
            markers = client.post("/api/recommend/itinerary", json={}).json()["mapData"]["markers"]
        # 좌표 없는 p3는 제외
        marker_names = [m["name"] for m in markers]
        assert "좌표없음" not in marker_names

    def test_itinerary_fallback_on_groq_failure(self):
        """Groq 호출 실패 → fallback 빈 일정 반환 (200)"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=[]), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", side_effect=Exception("Groq 오류")):
            resp = client.post("/api/recommend/itinerary", json={})
        assert resp.status_code == 200
        body = resp.json()
        assert "itinerary" in body
        assert "mapData" in body


# ══════════════════════════════════════════════════════════════════════════════
# 5b. POST /api/recommend/itinerary — 앙상블 통합 경로
# ══════════════════════════════════════════════════════════════════════════════
class TestItineraryEnsemble:
    def test_ensemble_ranking_applied(self):
        """HAS_ENSEMBLE=True → ensemble_rank_pois 호출"""
        mock_ranked = [
            {"poi_id": "p1", "name": "경복궁", "lat": 37.58, "lon": 126.97, "ensemble_score": 0.9},
            {"poi_id": "p2", "name": "광장시장", "lat": 37.57, "lon": 126.99, "ensemble_score": 0.5},
        ]
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_ENSEMBLE", True), \
             patch("src.api.fastapi_server.ensemble_rank_pois", return_value=mock_ranked), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=MOCK_ITINERARY):
            resp = client.post("/api/recommend/itinerary", json={
                "artists": ["BTS"],
                "regions": ["서울"],
                "purposes": ["kculture"],
            })
        assert resp.status_code == 200
        body = resp.json()
        assert "itinerary" in body
        assert "mapData" in body

    def test_ensemble_fallback_on_exception(self):
        """앙상블 예외 시 기존 union 방식 fallback"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_ENSEMBLE", True), \
             patch("src.api.fastapi_server.ensemble_rank_pois", side_effect=Exception("모델 오류")), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=MOCK_ITINERARY):
            resp = client.post("/api/recommend/itinerary", json={})
        assert resp.status_code == 200

    def test_no_ensemble_uses_union(self):
        """HAS_ENSEMBLE=False → 기존 union 방식"""
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_ENSEMBLE", False), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=MOCK_POIS), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=MOCK_ITINERARY):
            resp = client.post("/api/recommend/itinerary", json={})
        assert resp.status_code == 200

    def test_ensemble_markers_have_coords(self):
        """앙상블 결과에서 좌표 있는 POI만 markers에 포함"""
        mock_ranked = [
            {"poi_id": "p1", "name": "좌표있음", "lat": 37.5, "lon": 127.0, "ensemble_score": 0.9},
            {"poi_id": "p2", "name": "좌표없음", "ensemble_score": 0.8},
        ]
        with patch("src.api.fastapi_server.HAS_AI", True), \
             patch("src.api.fastapi_server.HAS_ENSEMBLE", True), \
             patch("src.api.fastapi_server.ensemble_rank_pois", return_value=mock_ranked), \
             patch("src.api.fastapi_server.HAS_GRAPHRAG", True), \
             patch("src.api.fastapi_server.search_artists_by_name", return_value=["artist_1"]), \
             patch("src.api.fastapi_server.get_graphrag_pois", return_value=[]), \
             patch("src.api.fastapi_server.search_pois_by_purpose", return_value=[]), \
             patch("src.api.fastapi_server.generate_itinerary", return_value=MOCK_ITINERARY):
            markers = client.post("/api/recommend/itinerary", json={}).json()["mapData"]["markers"]
        marker_names = [m["name"] for m in markers]
        assert "좌표있음" in marker_names
        assert "좌표없음" not in marker_names


# ══════════════════════════════════════════════════════════════════════════════
# 6. GET /api/weather (KMA 키 없는 fallback)
# ══════════════════════════════════════════════════════════════════════════════
class TestWeather:
    def test_weather_fallback_no_key(self):
        """KMA 키 없으면 fallback 응답 반환"""
        with patch.dict("os.environ", {"KMA_API_KEY": ""}, clear=False):
            resp = client.get("/api/weather?lat=37.5&lon=127.0")
        assert resp.status_code == 200
        body = resp.json()
        assert "weather_label" in body
        assert "w_safety_adj" in body
        assert "w_tourism_adj" in body

    def test_weather_adj_sum_to_one(self):
        """w_safety_adj + w_tourism_adj 합계 = 1.0"""
        with patch.dict("os.environ", {"KMA_API_KEY": ""}, clear=False):
            body = client.get("/api/weather?lat=37.5&lon=127.0&base_w_safety=0.7").json()
        total = round(body["w_safety_adj"] + body["w_tourism_adj"], 5)
        assert total == 1.0


# ══════════════════════════════════════════════════════════════════════════════
# 7. POST /api/recommend (기존 세그먼트 추천 — CSV 없을 때 503)
# ══════════════════════════════════════════════════════════════════════════════
class TestRecommend:
    def test_recommend_503_no_csv(self):
        """road_scored.csv 없으면 503"""
        with patch("src.api.fastapi_server.df_scored", None):
            resp = client.post("/api/recommend", json={
                "lat": 37.5, "lon": 127.0,
            })
        assert resp.status_code == 503

    def test_recommend_validation_error(self):
        """필수 필드(lat/lon) 누락 → 422"""
        resp = client.post("/api/recommend", json={})
        assert resp.status_code == 422


# ══════════════════════════════════════════════════════════════════════════════
# 8. GET /api/weather_forecast (날짜 유효성)
# ══════════════════════════════════════════════════════════════════════════════
class TestWeatherForecast:
    def test_forecast_invalid_date(self):
        resp = client.get("/api/weather_forecast?travel_date=not-a-date")
        assert resp.status_code == 400

    def test_forecast_no_model_fallback(self):
        """LSTM 모델 없으면 더미 응답"""
        with patch("src.api.fastapi_server.HAS_LSTM_WEATHER", False):
            resp = client.get("/api/weather_forecast?travel_date=2026-06-01")
        assert resp.status_code == 200
        assert resp.json()["weather_label"] == "맑음"
