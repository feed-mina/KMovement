from fastapi.testclient import TestClient

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
