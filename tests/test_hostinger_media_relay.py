from fastapi.testclient import TestClient
import deploy.cloud_gateway.app as gateway

client = TestClient(gateway.app)
AUTH = {"X-Internal-Api-Key": gateway.FASTAPI_INTERNAL_API_KEY}


def test_all_relay_operations_require_internal_auth():
    for method, path, payload in [
        ("POST", "/jobs/runpod", {"route": "cogvideox_real"}),
        ("POST", "/jobs/runpod/batch", {"images": [{"image_url": "https://example.com/a.jpg"}]}),
        ("GET", "/jobs/runpod/existing-job", None),
    ]:
        response = client.request(method, path, json=payload,
                                  headers={"X-Internal-Api-Key": "wrong-key"})
        assert response.status_code == 401


def test_status_can_find_existing_job_on_legacy_endpoint(monkeypatch):
    calls = []
    monkeypatch.setattr(gateway, "RUNPOD_API_KEY", "mock-provider-key")
    monkeypatch.setattr(gateway, "RUNPOD_TORA_ENDPOINT_ID", "tora")
    monkeypatch.setattr(gateway, "RUNPOD_MEDIA_ENDPOINT_ID", "media")
    monkeypatch.setattr(gateway, "RUNPOD_ENDPOINT_ID", "legacy")

    class Response:
        def __init__(self, status):
            self.status_code = status
        def raise_for_status(self):
            assert self.status_code == 200
        def json(self):
            return {"id": "existing-job", "status": "IN_PROGRESS"}

    def get(url, **kwargs):
        calls.append(url)
        assert kwargs["headers"]["Authorization"] == "Bearer mock-provider-key"
        return Response(200 if "/legacy/" in url else 404)

    monkeypatch.setattr("httpx.get", get)
    response = client.get("/jobs/runpod/existing-job", headers=AUTH)
    assert response.status_code == 200
    assert response.json()["endpoint_id"] == "legacy"
    assert calls == [
        f"https://api.runpod.ai/v2/{endpoint}/status/existing-job"
        for endpoint in ("tora", "media", "legacy")
    ]


def test_batch_uses_media_run_contract(monkeypatch):
    monkeypatch.setattr(gateway, "RUNPOD_API_KEY", "mock-provider-key")
    monkeypatch.setattr(gateway, "RUNPOD_MEDIA_ENDPOINT_ID", "media")

    class Response:
        def raise_for_status(self):
            pass
        def json(self):
            return {"id": "batch-job"}

    def post(url, **kwargs):
        assert url == "https://api.runpod.ai/v2/media/run"
        assert kwargs["json"]["input"]["route"] == "batch_video"
        return Response()

    monkeypatch.setattr("httpx.post", post)
    response = client.post("/jobs/runpod/batch", headers=AUTH,
                           json={"images": [{"image_url": "https://example.com/a.jpg"}]})
    assert response.status_code == 200
    assert response.json()["id"] == "batch-job"


def test_missing_provider_configuration_does_not_submit(monkeypatch):
    monkeypatch.setattr(gateway, "RUNPOD_API_KEY", "")
    def unexpected(*args, **kwargs):
        raise AssertionError("No provider request should be sent")
    monkeypatch.setattr("httpx.post", unexpected)
    monkeypatch.setattr("httpx.get", unexpected)
    assert client.post("/jobs/runpod", headers=AUTH,
                       json={"route": "cogvideox_real"}).status_code == 501
    assert client.post("/jobs/runpod/batch", headers=AUTH,
                       json={"images": [{"image_url": "https://example.com/a.jpg"}]}).status_code == 501
    assert client.get("/jobs/runpod/existing-job", headers=AUTH).status_code == 501


def test_provider_failure_is_reported_without_repost(monkeypatch):
    monkeypatch.setattr(gateway, "RUNPOD_API_KEY", "mock-provider-key")
    monkeypatch.setattr(gateway, "RUNPOD_MEDIA_ENDPOINT_ID", "media")
    calls = []
    def failing(url, **kwargs):
        calls.append(url)
        raise RuntimeError("Provider unavailable")
    monkeypatch.setattr("httpx.post", failing)
    response = client.post("/jobs/runpod", headers=AUTH,
                           json={"route": "cogvideox_real"})
    assert response.status_code == 502
    assert calls == ["https://api.runpod.ai/v2/media/run"]
