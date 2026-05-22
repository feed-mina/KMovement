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
    monkeypatch.setattr(server, "HAS_AI", True)
    monkeypatch.setattr(
        server,
        "get_regions",
        lambda *args, **kwargs: [
            {"id": "seoul", "name": "Seoul", "imageUrl": None, "safety_score": 0.9}
        ],
    )

    response = client.get("/api/regions")

    assert response.status_code == 200
    body = response.json()
    assert body["regions"][0]["id"] == "seoul"
    assert body["regions"][0]["name"] == "Seoul"


def test_recommend_ai_endpoint_returns_pois_text_and_count(monkeypatch):
    monkeypatch.setattr(server, "HAS_AI", True)
    monkeypatch.setattr(server, "get_artist_pois", lambda *args, **kwargs: MOCK_POIS)
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


def test_recommend_itinerary_endpoint_accepts_spring_duration_and_returns_map(monkeypatch):
    monkeypatch.setattr(server, "HAS_AI", True)
    monkeypatch.setattr(server, "HAS_ENSEMBLE", False)
    monkeypatch.setattr(server, "get_artist_pois", lambda *args, **kwargs: MOCK_POIS)
    monkeypatch.setattr(server, "get_region_pois", lambda *args, **kwargs: [])
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
