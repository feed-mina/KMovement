import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image

from deploy.photo_video.app import create_app


def client(tmp_path, monkeypatch):
    monkeypatch.setenv('PHOTO_VIDEO_INTERNAL_KEY', 'test-key-' * 8)
    return TestClient(create_app(tmp_path))


def headers(owner=1):
    return {'X-Photo-Video-Key': 'test-key-' * 8, 'X-Photo-Video-Owner': str(owner), 'Content-Type': 'image/png'}


def picture():
    data = io.BytesIO()
    Image.new('RGB', (64, 48), 'blue').save(data, 'PNG')
    return data.getvalue()


def test_private_upload_survives_restart(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    response = c.post('/photos', content=picture(), headers=headers())
    assert response.status_code == 201
    photo = response.json()['photoId']
    assert c.get(f'/photos/{photo}', headers=headers(2)).status_code == 404
    assert c.get(f'/photos/{photo}').status_code == 401
    c = client(tmp_path, monkeypatch)
    result = c.get(f'/photos/{photo}', headers=headers())
    assert result.status_code == 200
    assert result.headers['cache-control'] == 'private, no-store'
    assert Image.open(io.BytesIO(result.content)).format == 'JPEG'


def test_invalid_upload_and_quota(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    assert c.post('/photos', content=b'fake image', headers=headers()).status_code == 422
    assert c.post('/photos', content=b'x' * (10 * 1024 * 1024 + 1), headers=headers()).status_code == 413
    assert c.post('/photos', content=picture(), headers={**headers(), 'Content-Type': 'text/html'}).status_code == 415
    for _ in range(20):
        assert c.post('/photos', content=picture(), headers=headers()).status_code == 201
    assert c.post('/photos', content=picture(), headers=headers()).status_code == 429


def test_unconfigured_server_rejects(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    monkeypatch.delenv('PHOTO_VIDEO_INTERNAL_KEY')
    assert c.post('/photos', content=picture(), headers=headers()).status_code == 503


def new_job(c, owner=1):
    photo = c.post('/photos', content=picture(), headers=headers(owner)).json()['photoId']
    body = {'photoId': photo, 'requestId': str(uuid.uuid4())}
    return body, c.post('/jobs', json=body, headers={**headers(owner), 'Content-Type': 'application/json'})


def test_job_ownership_idempotency_and_limit(tmp_path, monkeypatch):
    c = client(tmp_path, monkeypatch)
    body, result = new_job(c)
    assert result.status_code == 202
    job_id = result.json()['jobId']
    assert result.json()['status'] == 'QUEUED'
    assert c.post('/jobs', json=body, headers={**headers(), 'Content-Type': 'application/json'}).json()['jobId'] == job_id
    assert c.get(f'/jobs/{job_id}', headers=headers(2)).status_code == 404
    assert c.get(f'/jobs/{job_id}', headers=headers()).status_code == 200
    foreign = c.post('/jobs', json={**body, 'requestId': str(uuid.uuid4())}, headers={**headers(2), 'Content-Type': 'application/json'})
    assert foreign.status_code == 404
    assert new_job(c)[1].status_code == 202
    assert new_job(c)[1].status_code == 429
    assert c.post('/jobs', json={**body, 'owner': 2}, headers={**headers(), 'Content-Type': 'application/json'}).status_code == 422


def test_real_video_and_range_survive_restart(tmp_path, monkeypatch):
    from deploy.photo_video.worker import run_once
    c = client(tmp_path, monkeypatch)
    _, result = new_job(c)
    job = result.json()['jobId']
    assert c.get(f'/jobs/{job}/video', headers=headers()).status_code == 409
    assert run_once(tmp_path)
    c = client(tmp_path, monkeypatch)
    assert c.get(f'/jobs/{job}', headers=headers()).json()['status'] == 'COMPLETED'
    assert c.get('/jobs', headers=headers(2)).json()['items'] == []
    video = c.get(f'/jobs/{job}/video', headers={**headers(), 'Range': 'bytes=0-63'})
    assert video.status_code == 206
    assert len(video.content) == 64
    assert c.get(f'/jobs/{job}/video', headers=headers(2)).status_code == 404
    assert not run_once(tmp_path)
