from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def _stub(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod


for _package in [
    "neo4j",
    "chromadb",
    "groq",
    "supabase",
    "sentence_transformers",
    "lightgbm",
    "sklearn",
    "sklearn.model_selection",
]:
    _stub(_package)

_ensemble = types.ModuleType("src.api.ensemble_client")
_ensemble.rank_pois = MagicMock(return_value=[])
sys.modules["src.api.ensemble_client"] = _ensemble

import src.api.fastapi_server as server  # noqa: E402


client = TestClient(server.app, raise_server_exceptions=False)

MOCK_POIS = [
    {
        "poi_id": "poi_1",
        "name": "Seoul Hall",
        "lat": 37.5665,
        "lon": 126.9780,
        "category": "kculture",
        "address": "Seoul",
    }
]


def test_artists_endpoint_returns_sdui_shape(monkeypatch):
    monkeypatch.setattr(server, "HAS_AI", True)
    monkeypatch.setattr(
        server,
        "get_all_artists",
        lambda: [{"id": "bts", "name": "BTS", "imageUrl": "/artists/BTS.png"}],
    )

    response = client.get("/api/artists")

    assert response.status_code == 200
    body = response.json()
    assert body["artists"][0]["id"] == "bts"
    assert body["artists"][0]["name"] == "BTS"


def test_regions_endpoint_returns_sdui_shape(monkeypatch):
    """지역 목록은 이제 조회 없이 REGIONS 를 그대로 내보낸다.

    예전에는 Neo4j Region 노드를 주입해 모양을 확인했다. Neo4j 를 걷어낸 뒤로는
    주입할 대상이 없으므로 실제 응답의 모양을 그대로 본다.
    """
    monkeypatch.setattr(server, "HAS_AI", True)

    response = client.get("/api/regions")

    assert response.status_code == 200
    body = response.json()
    assert len(body["regions"]) == 17
    for region in body["regions"]:
        assert isinstance(region["id"], str)
        assert region["name"]
        assert "imageUrl" in region
        assert "safety_score" in region


def test_recommend_ai_endpoint_returns_pois_text_and_count(monkeypatch):
    monkeypatch.setattr(server, "HAS_AI", True)
    monkeypatch.setattr(server, "HAS_GRAPHRAG", True)
    monkeypatch.setattr(server, "search_artists_by_name", lambda *a, **k: ["artist_1"])
    monkeypatch.setattr(server, "get_graphrag_pois", lambda *a, **k: MOCK_POIS)
    monkeypatch.setattr(server, "search_pois_by_purpose", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        server,
        "generate_recommendation_text",
        lambda *args, **kwargs: "Recommended K-Ride POI",
    )

    response = client.post(
        "/api/recommend/ai",
        json={
            "artists": ["BTS"],
            "regions": ["Seoul"],
            "purposes": ["kculture"],
            "budget": {"min": 0, "max": 500000},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["pois"][0]["poi_id"] == "poi_1"
    assert body["recommendation_text"] == "Recommended K-Ride POI"


def test_recommend_ai_supports_region_and_korean_purpose_only(monkeypatch):
    captured = {}
    region_poi = {
        **MOCK_POIS[0],
        "poi_id": "poi_region",
        "address": "서울 종로구",
        "sido": "서울",
    }

    def fake_search(purposes, query_text, top_k=5):
        captured["purposes"] = purposes
        captured["query_text"] = query_text
        return []

    monkeypatch.setattr(server, "HAS_AI", True)
    # 아티스트를 고르지 않은 요청이라 아티스트 확장이 아니라 지역 대체 경로를
    # 탄다. 예전에는 Neo4j get_region_pois 가 그 자리였다.
    monkeypatch.setattr(server, "HAS_GRAPHRAG", True)
    monkeypatch.setattr(server, "get_region_pois_from_graph", lambda *a, **k: [region_poi])
    monkeypatch.setattr(server, "search_pois_by_purpose", fake_search)
    monkeypatch.setattr(
        server,
        "generate_recommendation_text",
        lambda *args, **kwargs: "Recommended Seoul POI",
    )

    response = client.post(
        "/api/recommend/ai",
        json={
            "artists": [],
            "regions": ["서울"],
            "purposes": ["관광지"],
            "budget": {"min": 0, "max": 500000},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 1
    assert body["pois"][0]["poi_id"] == "poi_region"
    assert captured["purposes"] == ["kculture"]


def test_recommend_itinerary_endpoint_accepts_spring_duration_and_returns_map(monkeypatch):
    monkeypatch.setattr(server, "HAS_AI", True)
    monkeypatch.setattr(server, "HAS_ENSEMBLE", False)
    monkeypatch.setattr(server, "HAS_GRAPHRAG", True)
    monkeypatch.setattr(server, "search_artists_by_name", lambda *a, **k: ["artist_1"])
    monkeypatch.setattr(server, "get_graphrag_pois", lambda *a, **k: MOCK_POIS)
    monkeypatch.setattr(server, "search_pois_by_purpose", lambda *args, **kwargs: [])
    monkeypatch.setattr(
        server,
        "generate_itinerary",
        lambda *args, **kwargs: {"itinerary": [{"day": 1, "morning": {"places": []}}]},
    )

    response = client.post(
        "/api/recommend/itinerary",
        json={
            "artists": ["BTS"],
            "regions": ["Seoul"],
            "purposes": ["kculture"],
            "duration": 2,
            "budget": {"min": 0, "max": 500000},
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert "itinerary" in body
    assert body["mapData"]["markers"][0]["name"] == "Seoul Hall"
    assert body["source_pois"][0]["poi_id"] == "poi_1"


def test_chat_stream_endpoint_returns_plain_text_stream():
    response = client.post("/api/chat/stream", json={"message": "hello kride"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "hello kride" in response.text
