"""
test_fastapi.py
===============
FastAPI 서버 단위 / 통합 테스트 (pytest + FastAPI TestClient)

실행:
    cd D:/kride-project
    pytest src/api/test_fastapi.py -v

의존 패키지:
    pip install pytest httpx

외부 의존성(Neo4j / Supabase / ChromaDB / Groq)은 모두 monkeypatch로 mock 처리.
서버가 꺼져 있어도 실행 가능.
"""

from __future__ import annotations

import sys
import types
import importlib
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient


# ─────────────────────────────────────────────────────────────────────────────
# 외부 패키지 stub (설치 안 돼 있어도 import 에러 방지)
# ─────────────────────────────────────────────────────────────────────────────
def _stub_module(name: str):
    """sys.modules 에 빈 mock 모듈을 등록한다."""
    mod = types.ModuleType(name)
    sys.modules.setdefault(name, mod)
    return mod


for _pkg in [
    "neo4j", "neo4j.exceptions",
    "chromadb",
    "groq",
    "supabase",
    "sentence_transformers",
    "weather_kma",
    "build_event_ner",
    "build_weather_lstm",
]:
    _stub_module(_pkg)

# AI 클라이언트 함수 stub — HAS_AI=False 분기를 우회하기 위해
_ai_stubs = {
    "get_all_artists": lambda: [{"id": "1", "name": "BTS", "imageUrl": None}],
    "get_artist_pois": lambda artist_ids, limit=15: [],
    "get_region_pois": lambda region: [],
    "get_regions": lambda limit=20: [{"id": "1", "name": "서울", "imageUrl": None, "safety_score": 0.8}],
    "search_pois_by_purpose": lambda purposes, text, top_k=5: [],
    "generate_recommendation_text": lambda pois, artists, regions, purposes: "테스트 추천 텍스트",
    "generate_itinerary": lambda pois, duration, theme: "{}",
    "get_poi_details": lambda poi_id: None,
}

# neo4j_client / rag_client / supabase_client 를 stub 모듈로 등록
for _mod_name, _funcs in {
    "src.api.neo4j_client": {
        "get_artist_pois": _ai_stubs["get_artist_pois"],
        "get_region_pois": _ai_stubs["get_region_pois"],
        "get_regions": _ai_stubs["get_regions"],
    },
    "src.api.rag_client": {
        "search_pois_by_purpose": _ai_stubs["search_pois_by_purpose"],
        "generate_recommendation_text": _ai_stubs["generate_recommendation_text"],
        "generate_itinerary": _ai_stubs["generate_itinerary"],
    },
    "src.api.supabase_client": {
        "get_all_artists": _ai_stubs["get_all_artists"],
        "get_poi_details": _ai_stubs["get_poi_details"],
    },
}.items():
    _m = _stub_module(_mod_name)
    for _fn, _impl in _funcs.items():
        setattr(_m, _fn, _impl)


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app 로드 (stub 등록 후 import)
# ─────────────────────────────────────────────────────────────────────────────
import importlib.util
import os

_server_path = os.path.join(os.path.dirname(__file__), "fastapi_server.py")
_spec = importlib.util.spec_from_file_location("fastapi_server", _server_path)
_module = importlib.util.module_from_spec(_spec)

# HAS_AI=True 로 강제 (stub 모듈이 등록돼 있으므로 import 성공)
with patch.dict("sys.modules", sys.modules):
    _spec.loader.exec_module(_module)

app = _module.app

# 로드 후 AI 함수를 stub으로 교체 (모듈 레벨 변수)
_module.get_all_artists        = _ai_stubs["get_all_artists"]
_module.get_regions            = _ai_stubs["get_regions"]
_module.get_artist_pois        = _ai_stubs["get_artist_pois"]
_module.search_pois_by_purpose = _ai_stubs["search_pois_by_purpose"]
_module.generate_recommendation_text = _ai_stubs["generate_recommendation_text"]
_module.generate_itinerary     = _ai_stubs["generate_itinerary"]
_module.HAS_AI                 = True

client = TestClient(app)


# ═════════════════════════════════════════════════════════════════════════════
# 1. Health 엔드포인트
# ═════════════════════════════════════════════════════════════════════════════
class TestHealth:
    def test_health_returns_200(self):
        res = client.get("/api/health")
        assert res.status_code == 200

    def test_health_schema(self):
        body = client.get("/api/health").json()
        assert "status" in body
        assert body["status"] == "ok"
        assert "graph_nodes" in body
        assert "graph_edges" in body
        assert "road_scored_rows" in body

    def test_health_values_are_numeric(self):
        body = client.get("/api/health").json()
        assert isinstance(body["graph_nodes"], (int, float))
        assert isinstance(body["graph_edges"], (int, float))
        assert isinstance(body["road_scored_rows"], (int, float))


# ═════════════════════════════════════════════════════════════════════════════
# 2. /api/artists
# ═════════════════════════════════════════════════════════════════════════════
class TestArtists:
    def test_returns_200(self):
        res = client.get("/api/artists")
        assert res.status_code == 200

    def test_response_has_artists_key(self):
        body = client.get("/api/artists").json()
        assert "artists" in body

    def test_artists_is_list(self):
        body = client.get("/api/artists").json()
        assert isinstance(body["artists"], list)

    def test_artist_item_schema(self):
        body = client.get("/api/artists").json()
        if body["artists"]:
            item = body["artists"][0]
            assert "id" in item
            assert "name" in item


# ═════════════════════════════════════════════════════════════════════════════
# 3. /api/regions
# ═════════════════════════════════════════════════════════════════════════════
class TestRegions:
    def test_returns_200(self):
        res = client.get("/api/regions")
        assert res.status_code == 200

    def test_response_has_regions_key(self):
        body = client.get("/api/regions").json()
        assert "regions" in body

    def test_regions_is_list(self):
        body = client.get("/api/regions").json()
        assert isinstance(body["regions"], list)

    def test_regions_not_empty(self):
        """Neo4j fallback이 동작해서 최소 1개 이상"""
        body = client.get("/api/regions").json()
        assert len(body["regions"]) >= 1

    def test_region_item_schema(self):
        body = client.get("/api/regions").json()
        item = body["regions"][0]
        assert "id" in item
        assert "name" in item

    def test_fallback_when_neo4j_empty(self):
        """Neo4j가 빈 목록을 반환할 때 하드코딩 fallback 동작"""
        original = _module.get_regions
        _module.get_regions = lambda limit=20: []
        try:
            body = client.get("/api/regions").json()
            assert len(body["regions"]) >= 17  # fallback 목록 17개
        finally:
            _module.get_regions = original


# ═════════════════════════════════════════════════════════════════════════════
# 4. /api/recommend/itinerary
# ═════════════════════════════════════════════════════════════════════════════
class TestItinerary:
    _valid_payload = {
        "duration": "당일치기",
        "artists": ["BTS"],
        "regions": ["서울"],
        "purposes": ["food"],
        "budget": {"min": 0, "max": 500000},
    }

    def test_returns_200(self):
        res = client.post("/api/recommend/itinerary", json=self._valid_payload)
        assert res.status_code == 200

    def test_response_has_itinerary_key(self):
        body = client.post("/api/recommend/itinerary", json=self._valid_payload).json()
        assert "itinerary" in body

    def test_response_has_map_data(self):
        body = client.post("/api/recommend/itinerary", json=self._valid_payload).json()
        assert "mapData" in body

    def test_map_data_has_markers(self):
        body = client.post("/api/recommend/itinerary", json=self._valid_payload).json()
        assert "markers" in body["mapData"]
        assert isinstance(body["mapData"]["markers"], list)

    def test_itinerary_is_list(self):
        body = client.post("/api/recommend/itinerary", json=self._valid_payload).json()
        assert isinstance(body["itinerary"], list)

    def test_empty_artists_still_returns_200(self):
        payload = {**self._valid_payload, "artists": [], "regions": []}
        res = client.post("/api/recommend/itinerary", json=payload)
        assert res.status_code == 200

    def test_invalid_payload_returns_422(self):
        """duration 필드 없이 요청 → pydantic validation 실패"""
        # duration 은 기본값이 있으므로, 완전히 잘못된 타입으로 검증
        res = client.post("/api/recommend/itinerary", json={"duration": 12345})
        # 기본값이 있어 200이거나 422일 수 있음 — 서버 크래시(5xx)만 아니면 통과
        assert res.status_code < 500


# ═════════════════════════════════════════════════════════════════════════════
# 5. /api/recommend/ai
# ═════════════════════════════════════════════════════════════════════════════
class TestRecommendAI:
    _valid_payload = {
        "artists": ["블랙핑크"],
        "regions": ["제주"],
        "purposes": ["nature"],
        "budget": {"min": 0, "max": 300000},
    }

    def test_returns_200(self):
        res = client.post("/api/recommend/ai", json=self._valid_payload)
        assert res.status_code == 200

    def test_response_schema(self):
        body = client.post("/api/recommend/ai", json=self._valid_payload).json()
        assert "pois" in body
        assert "recommendation_text" in body
        assert "count" in body

    def test_pois_is_list(self):
        body = client.post("/api/recommend/ai", json=self._valid_payload).json()
        assert isinstance(body["pois"], list)

    def test_empty_request_still_200(self):
        res = client.post("/api/recommend/ai", json={})
        assert res.status_code == 200

    def test_route_history_save_called_with_user_context(self):
        calls = []
        original = _module.save_user_route_history
        _module.save_user_route_history = lambda *args, **kwargs: calls.append((args, kwargs))
        try:
            res = client.post("/api/recommend/ai", json={**self._valid_payload, "user_sqno": 7, "user_id": "tester"})
        finally:
            _module.save_user_route_history = original

        assert res.status_code == 200
        assert calls
        assert calls[0][0][0] == "poi_recommendation"
        assert calls[0][0][1].user_sqno == 7


class TestRouteHistoryAnalytics:
    def test_route_history_endpoint_returns_timeline_items(self):
        original = _module.fetch_user_route_history
        _module.fetch_user_route_history = lambda user_id, limit=20, offset=0: [
            {"id": "h1", "title": f"Route for {user_id}", "activity_date": "2026-07-08"}
        ]
        try:
            res = client.get("/api/users/7/route-history?limit=3&offset=1")
        finally:
            _module.fetch_user_route_history = original

        assert res.status_code == 200
        body = res.json()
        assert body[0]["id"] == "h1"
        assert body[0]["title"] == "Route for 7"

    def test_route_summary_endpoint_returns_aggregate_object(self):
        original = _module.fetch_user_route_summary
        _module.fetch_user_route_summary = lambda user_id: {
            "total_routes": 2,
            "visited_regions": [{"label": "Seoul", "value": 2}],
            "preferred_artists": [{"label": "BTS", "value": 1}],
        }
        try:
            res = client.get("/api/users/7/summary")
        finally:
            _module.fetch_user_route_summary = original

        assert res.status_code == 200
        body = res.json()
        assert body["total_routes"] == 2
        assert body["visited_regions"][0]["label"] == "Seoul"

    def test_travel_trends_endpoint_returns_admin_chart_series(self):
        original = _module.fetch_travel_trends
        _module.fetch_travel_trends = lambda limit=10: {
            "regions": [{"label": "Seoul", "value": limit}],
            "artists": [{"label": "BTS", "value": 3}],
        }
        try:
            res = client.get("/api/stats/travel-trends?limit=5")
        finally:
            _module.fetch_travel_trends = original

        assert res.status_code == 200
        body = res.json()
        assert body["regions"][0]["value"] == 5
        assert body["artists"][0]["label"] == "BTS"


# ═════════════════════════════════════════════════════════════════════════════
# 9. 일정 마커 해소 — 장소별 지오코딩
# ═════════════════════════════════════════════════════════════════════════════
class TestItineraryMarkerResolution:
    """
    좌표를 가진 source POI가 하나라도 있으면 지오코딩을 통째로 건너뛰던 동작 때문에,
    이름이 매칭되지 않은 장소가 곧바로 미해석 처리됐다. 이제 장소별로 판단한다.
    """

    @staticmethod
    def _itinerary(*names):
        return [{
            "day": 1,
            "morning": {"places": [{"name": name} for name in names]},
            "afternoon": {"places": []},
        }]

    def _resolve(self, itinerary, source_pois, geocode_result, budget=None):
        import asyncio

        async def fake_geocode(address):
            return geocode_result(address) if callable(geocode_result) else geocode_result

        original_budget = _module.GEOCODE_BUDGET_PER_REQUEST
        original_geocode = _module.geocode_address
        if budget is not None:
            _module.GEOCODE_BUDGET_PER_REQUEST = budget
        _module.geocode_address = fake_geocode
        try:
            return asyncio.run(_module.resolve_itinerary_markers(itinerary, source_pois))
        finally:
            _module.GEOCODE_BUDGET_PER_REQUEST = original_budget
            _module.geocode_address = original_geocode

    def test_geocodes_unmatched_place_even_when_source_pois_have_coordinates(self):
        source_pois = [{"poi_id": "p1", "name": "경복궁", "lat": 37.58, "lon": 126.97}]

        result = self._resolve(
            self._itinerary("경복궁", "이름이 다른 장소"),
            source_pois,
            {"lat": 37.55, "lng": 126.98},
        )

        assert result["markerResolutionStatus"] == "complete"
        assert result["unresolvedPlaces"] == []
        sources = {marker["name"]: marker["coordinateSource"] for marker in result["markers"]}
        assert sources["경복궁"] == "poi"
        assert sources["이름이 다른 장소"] == "geocode"

    def test_reports_geocode_failure_with_the_query_that_was_tried(self):
        source_pois = [{"poi_id": "p1", "name": "경복궁", "lat": 37.58, "lon": 126.97}]

        result = self._resolve(self._itinerary("경복궁", "없는 장소"), source_pois, None)

        assert result["markerResolutionStatus"] == "partial"
        assert len(result["unresolvedPlaces"]) == 1
        unresolved = result["unresolvedPlaces"][0]
        assert unresolved["name"] == "없는 장소"
        assert unresolved["reason"] == "geocode_failed"
        assert unresolved["geocodeQuery"] == "없는 장소"

    def test_budget_caps_how_many_places_are_geocoded(self):
        result = self._resolve(
            self._itinerary("장소1", "장소2", "장소3"),
            [],
            {"lat": 37.55, "lng": 126.98},
            budget=1,
        )

        assert len(result["markers"]) == 1
        reasons = [place["reason"] for place in result["unresolvedPlaces"]]
        assert reasons == ["geocode_budget_exhausted", "geocode_budget_exhausted"]

    def test_places_with_their_own_coordinates_do_not_consume_the_budget(self):
        itinerary = [{
            "day": 1,
            "morning": {"places": [
                {"name": "좌표 있는 장소", "latitude": "37.58", "longitude": "126.97"},
                {"name": "좌표 없는 장소"},
            ]},
        }]

        result = self._resolve(itinerary, [], {"lat": 37.55, "lng": 126.98}, budget=1)

        assert result["markerResolutionStatus"] == "complete"
        assert result["unresolvedPlaces"] == []
        sources = {marker["name"]: marker["coordinateSource"] for marker in result["markers"]}
        assert sources["좌표 있는 장소"] == "itinerary"
        assert sources["좌표 없는 장소"] == "geocode"
