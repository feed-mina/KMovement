from __future__ import annotations

import json
import sys
import types
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


def _stub(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod


from tests.module_stubs import stub_modules

# stub 은 이 블록 안에서만 산다. 그대로 두면 뒤에 수집되는 테스트가 진짜 모듈
# 대신 이것을 집는다 — sklearn stub 하나가 test_ensemble.py 의 sklearn.metrics
# import 를 깨뜨렸다.
_ensemble = types.ModuleType("src.api.ensemble_client")
_ensemble.rank_pois = MagicMock(return_value=[])

with stub_modules(
    [
        "chromadb",
        "groq",
        "supabase",
        "sentence_transformers",
        "lightgbm",
        "sklearn",
        "sklearn.model_selection",
    ],
    {"src.api.ensemble_client": _ensemble},
):
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


def test_chat_stream_endpoint_speaks_sse_the_way_spring_reads_it():
    """The consumer is Spring's `bodyToFlux(String.class)` on this endpoint.

    That decoder only strips the `data: ` framing when the response is
    `text/event-stream`; on `text/plain` it hands back raw chunks and the client
    sees the framing as content. This test used to assert `text/plain`, which
    stopped matching the endpoint and had been failing on main ever since.
    """
    response = client.post("/api/chat/stream", json={"message": "hello kride"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    # Every payload is one `data:` frame, and the stream terminates with the
    # sentinel Spring forwards to the browser (KrideChatService).
    lines = [line for line in response.text.splitlines() if line]
    assert all(line.startswith("data: ") for line in lines), lines
    assert lines[-1] == "data: [DONE]"

    # Frames before the sentinel carry JSON with a content field.
    payload = json.loads(lines[0].removeprefix("data: "))
    assert "content" in payload


def test_chat_stream_stub_matches_the_real_function_signature():
    """The AI-module fallback must accept what the endpoint actually passes.

    `chat_stream` calls `generate_chat_answer_stream(message, graphrag_context=...)`.
    When the AI modules fail to import, the stub took `message` only, so the call
    raised TypeError and the endpoint fell into its exception branch instead of
    the intended "준비 중" message — the reason was only visible in stdout.
    """
    import ast
    import inspect
    from pathlib import Path

    # rag_client cannot be imported here — its dependencies are stubbed above,
    # which is exactly the condition that selects the fallback. Read the real
    # signatures from source instead.
    source = Path(__file__).resolve().parents[1] / "src" / "api" / "rag_client.py"
    real_parameters = {
        node.name: {argument.arg for argument in node.args.args}
        for node in ast.parse(source.read_text(encoding="utf-8")).body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }

    for name in ("generate_chat_answer", "generate_chat_answer_stream"):
        stub_parameters = set(inspect.signature(getattr(server, name)).parameters)
        assert "graphrag_context" in stub_parameters, name
        assert real_parameters[name] <= stub_parameters, name
