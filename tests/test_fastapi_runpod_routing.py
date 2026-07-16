from __future__ import annotations

import os
import sys
import types
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


os.environ.setdefault("FASTAPI_INTERNAL_API_KEY", "test-internal-api-key-for-runpod-routing")


def _stub(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules.setdefault(name, mod)
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


class _FakeRunPodResponse:
    status_code = 200

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, str]:
        return {"id": "job-1"}


def _configure_runpod(monkeypatch) -> None:
    monkeypatch.setattr(server, "FASTAPI_INTERNAL_API_KEY", "test-internal-api-key-for-runpod-routing")
    monkeypatch.setattr(server, "RUNPOD_API_KEY", "runpod-key")
    monkeypatch.setattr(server, "RUNPOD_ENDPOINT_ID", "legacy-endpoint")
    monkeypatch.setattr(server, "RUNPOD_MEDIA_ENDPOINT_ID", "media-endpoint")
    monkeypatch.setattr(server, "RUNPOD_TORA_ENDPOINT_ID", "tora-endpoint")


def _auth_headers() -> dict[str, str]:
    return {"X-Internal-Api-Key": server.FASTAPI_INTERNAL_API_KEY}


def test_runpod_proxy_routes_tora_to_tora_endpoint(monkeypatch):
    _configure_runpod(monkeypatch)
    seen: dict[str, object] = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json, timeout=timeout)
        return _FakeRunPodResponse()

    monkeypatch.setattr(server.httpx, "post", fake_post)

    response = client.post(
        "/jobs/runpod",
        headers=_auth_headers(),
        json={
            "route": "tora_cogvideox_i2v",
            "case_id": "photo-i2v",
            "place": "Seoul",
            "image_url": "https://example.com/photo.jpg",
        },
    )

    assert response.status_code == 200
    assert "/tora-endpoint/run" in seen["url"]
    assert seen["json"]["input"]["route"] == "tora_cogvideox_i2v"
    assert response.json()["endpoint_id"] == "tora-endpoint"


def test_runpod_proxy_routes_doodle_worker_to_media_endpoint(monkeypatch):
    _configure_runpod(monkeypatch)
    seen: dict[str, object] = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json, timeout=timeout)
        return _FakeRunPodResponse()

    monkeypatch.setattr(server.httpx, "post", fake_post)

    response = client.post(
        "/jobs/runpod",
        headers=_auth_headers(),
        json={
            "route": "animated_drawings_worker",
            "case_id": "doodle",
            "place": "Seoul",
            "image_url": "https://example.com/doodle.png",
        },
    )

    assert response.status_code == 200
    assert "/media-endpoint/run" in seen["url"]
    assert seen["json"]["input"]["route"] == "animated_drawings_worker"
    assert response.json()["endpoint_id"] == "media-endpoint"


def test_runpod_batch_uses_media_endpoint(monkeypatch):
    _configure_runpod(monkeypatch)
    seen: dict[str, object] = {}

    def fake_post(url, headers, json, timeout):
        seen.update(url=url, headers=headers, json=json, timeout=timeout)
        return _FakeRunPodResponse()

    monkeypatch.setattr(server.httpx, "post", fake_post)

    response = client.post(
        "/jobs/runpod/batch",
        headers=_auth_headers(),
        json={
            "case_id": "batch",
            "place": "Seoul",
            "images": [{"image_url": "https://example.com/doodle.png", "image_type": "doodle"}],
        },
    )

    assert response.status_code == 200
    assert "/media-endpoint/run" in seen["url"]
    assert seen["json"]["input"]["route"] == "batch_video"
    assert response.json()["endpoint_id"] == "media-endpoint"
