from fastapi.testclient import TestClient

import deploy.cloud_gateway.app as cloud_gateway_app
from deploy.cloud_gateway.app import FASTAPI_INTERNAL_API_KEY, app


client = TestClient(app)


def test_runpod_proxy_rejects_missing_internal_api_key():
    response = client.post(
        "/jobs/runpod",
        json={
            "route": "cogvideox_real",
            "image_url": "https://project.supabase.co/storage/v1/object/public/a.jpg",
        },
    )

    assert response.status_code == 401


def test_runpod_proxy_accepts_internal_api_key_before_configuration_check():
    response = client.post(
        "/jobs/runpod",
        headers={"X-Internal-Api-Key": FASTAPI_INTERNAL_API_KEY},
        json={
            "route": "cogvideox_real",
            "image_url": "https://project.supabase.co/storage/v1/object/public/a.jpg",
        },
    )

    assert response.status_code != 401


def test_runpod_proxy_routes_tora_to_tora_endpoint(monkeypatch):
    seen = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"id": "job-tora"}

    def fake_post(url, **kwargs):
        seen["url"] = url
        seen["json"] = kwargs["json"]
        return Response()

    monkeypatch.setattr(cloud_gateway_app, "RUNPOD_API_KEY", "test-key")
    monkeypatch.setattr(cloud_gateway_app, "RUNPOD_MEDIA_ENDPOINT_ID", "media-endpoint")
    monkeypatch.setattr(cloud_gateway_app, "RUNPOD_TORA_ENDPOINT_ID", "tora-endpoint")
    monkeypatch.setattr("httpx.post", fake_post)

    response = client.post(
        "/jobs/runpod",
        headers={"X-Internal-Api-Key": FASTAPI_INTERNAL_API_KEY},
        json={
            "route": "tora_cogvideox_i2v",
            "image_url": "https://project.supabase.co/storage/v1/object/public/photo.jpg",
        },
    )

    assert response.status_code == 200
    assert "tora-endpoint/run" in seen["url"]
    assert seen["json"]["input"]["route"] == "tora_cogvideox_i2v"


def test_runpod_proxy_routes_doodle_worker_to_media_endpoint(monkeypatch):
    seen = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"id": "job-media"}

    def fake_post(url, **kwargs):
        seen["url"] = url
        seen["json"] = kwargs["json"]
        return Response()

    monkeypatch.setattr(cloud_gateway_app, "RUNPOD_API_KEY", "test-key")
    monkeypatch.setattr(cloud_gateway_app, "RUNPOD_MEDIA_ENDPOINT_ID", "media-endpoint")
    monkeypatch.setattr(cloud_gateway_app, "RUNPOD_TORA_ENDPOINT_ID", "tora-endpoint")
    monkeypatch.setattr("httpx.post", fake_post)

    response = client.post(
        "/jobs/runpod",
        headers={"X-Internal-Api-Key": FASTAPI_INTERNAL_API_KEY},
        json={
            "route": "animated_drawings_worker",
            "image_url": "https://project.supabase.co/storage/v1/object/public/doodle.png",
        },
    )

    assert response.status_code == 200
    assert "media-endpoint/run" in seen["url"]
    assert seen["json"]["input"]["route"] == "animated_drawings_worker"
