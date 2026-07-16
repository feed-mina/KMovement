from __future__ import annotations

import hashlib
import hmac
import os
import sys
import types
from unittest.mock import MagicMock

from fastapi.testclient import TestClient


TEST_INTERNAL_KEY = "test-internal-key-for-celery-security"
TASK_ID = "85a9f8bb-e57b-4b8d-a1ca-5a1f34cb764a"
os.environ.setdefault("FASTAPI_INTERNAL_API_KEY", TEST_INTERNAL_KEY)


def _stub(name: str) -> types.ModuleType:
    module = types.ModuleType(name)
    sys.modules.setdefault(name, module)
    return module


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

try:
    import celery as _real_celery  # noqa: F401
except ModuleNotFoundError:
    _celery_module = types.ModuleType("celery")
    _celery_result_module = types.ModuleType("celery.result")
    _celery_schedules_module = types.ModuleType("celery.schedules")

    class _FakeConf:
        def update(self, **kwargs) -> None:
            for key, value in kwargs.items():
                setattr(self, key, value)

    class _FakeTask:
        def __init__(self, function, bind: bool) -> None:
            self.function = function
            self.bind = bind
            self.update_state = MagicMock()

        def run(self, *args, **kwargs):
            if self.bind:
                return self.function(self, *args, **kwargs)
            return self.function(*args, **kwargs)

        def retry(self, exc):
            raise exc

        def apply_async(self, *args, **kwargs):
            raise AssertionError("apply_async must be mocked by the test")

    class _FakeCelery:
        def __init__(self, *_args, **_kwargs) -> None:
            self.conf = _FakeConf()

        def task(self, function=None, **options):
            if function is not None:
                return _FakeTask(function, bind=options.get("bind", False))
            return lambda wrapped: _FakeTask(wrapped, bind=options.get("bind", False))

        def autodiscover_tasks(self, _packages) -> None:
            return None

    _celery_module.Celery = _FakeCelery
    _celery_result_module.AsyncResult = MagicMock
    _celery_schedules_module.crontab = lambda **kwargs: kwargs
    _celery_module.result = _celery_result_module
    _celery_module.schedules = _celery_schedules_module
    sys.modules["celery"] = _celery_module
    sys.modules["celery.result"] = _celery_result_module
    sys.modules["celery.schedules"] = _celery_schedules_module

_ensemble = types.ModuleType("src.api.ensemble_client")
_ensemble.rank_pois = MagicMock(return_value=[])
sys.modules.setdefault("src.api.ensemble_client", _ensemble)

import src.api.fastapi_server as server  # noqa: E402
from src.api import tasks  # noqa: E402


client = TestClient(server.app, raise_server_exceptions=False)


class _SubmittedResult:
    id = TASK_ID


class _SuccessfulResult:
    status = "SUCCESS"
    info = None
    result = {"result_url": "https://example.com/result.mp4"}


def _internal_headers() -> dict[str, str]:
    return {"X-Internal-Api-Key": TEST_INTERNAL_KEY}


def _job_token(task_id: str = TASK_ID) -> str:
    return hmac.new(
        TEST_INTERNAL_KEY.encode(),
        task_id.encode(),
        hashlib.sha256,
    ).hexdigest()


def _job_headers(task_id: str = TASK_ID) -> dict[str, str]:
    return {
        **_internal_headers(),
        "X-Celery-Job-Token": _job_token(task_id),
    }


def _configure_key(monkeypatch) -> None:
    monkeypatch.setattr(server, "FASTAPI_INTERNAL_API_KEY", TEST_INTERNAL_KEY)


def test_internal_key_fails_closed_when_server_key_is_empty(monkeypatch):
    monkeypatch.setattr(server, "FASTAPI_INTERNAL_API_KEY", "")
    apply_async = MagicMock(return_value=_SubmittedResult())
    monkeypatch.setattr(tasks.task_generate_tts, "apply_async", apply_async, raising=False)

    response = client.post(
        "/jobs/celery/tts",
        headers={"X-Internal-Api-Key": "sdui-internal-dev-key"},
        json={"text": "hello"},
    )

    assert response.status_code == 401
    apply_async.assert_not_called()


def test_tts_and_video_submissions_are_validated_and_do_not_expose_job_tokens(monkeypatch):
    _configure_key(monkeypatch)
    tts_submit = MagicMock(return_value=_SubmittedResult())
    video_submit = MagicMock(return_value=_SubmittedResult())
    monkeypatch.setattr(tasks.task_generate_tts, "apply_async", tts_submit, raising=False)
    monkeypatch.setattr(tasks.task_generate_video, "apply_async", video_submit, raising=False)

    tts_response = client.post(
        "/jobs/celery/tts",
        headers=_internal_headers(),
        json={"text": "안녕하세요", "voice_id": "default", "lang": "ko"},
    )
    video_response = client.post(
        "/jobs/celery/video",
        headers=_internal_headers(),
        json={
            "image_url": "https://example.com/input.jpg",
            "route": "3d_photo_light",
            "case_id": "case_1",
        },
    )

    assert tts_response.status_code == 200
    assert video_response.status_code == 200
    assert "job_token" not in tts_response.json()
    assert "job_token" not in video_response.json()
    tts_submit.assert_called_once_with(args=("안녕하세요", "default", "ko"))
    video_submit.assert_called_once()

    invalid = client.post(
        "/jobs/celery/video",
        headers=_internal_headers(),
        json={"image_url": "file:///etc/passwd", "route": "unsupported"},
    )
    assert invalid.status_code == 422

    insecure = client.post(
        "/jobs/celery/video",
        headers=_internal_headers(),
        json={"image_url": "http://example.com/image.jpg"},
    )
    assert insecure.status_code == 422


def test_cleanup_smoke_submission_accepts_an_empty_body(monkeypatch):
    _configure_key(monkeypatch)
    apply_async = MagicMock(return_value=_SubmittedResult())
    monkeypatch.setattr(tasks.task_cleanup_temp, "apply_async", apply_async, raising=False)

    response = client.post("/jobs/celery/cleanup", headers=_internal_headers())

    assert response.status_code == 200
    apply_async.assert_called_once_with(args=(None,))


def test_ml_submissions_are_disabled_unless_an_ml_worker_is_explicitly_enabled(monkeypatch):
    _configure_key(monkeypatch)
    apply_async = MagicMock(return_value=_SubmittedResult())
    monkeypatch.setattr(tasks.task_embed_texts, "apply_async", apply_async, raising=False)
    monkeypatch.delenv("CELERY_ML_TASKS_ENABLED", raising=False)

    disabled = client.post(
        "/jobs/celery/embed",
        headers=_internal_headers(),
        json={"texts": ["hello"]},
    )
    assert disabled.status_code == 503
    apply_async.assert_not_called()

    monkeypatch.setenv("CELERY_ML_TASKS_ENABLED", "true")
    enabled = client.post(
        "/jobs/celery/embed",
        headers=_internal_headers(),
        json={"texts": ["hello"]},
    )
    assert enabled.status_code == 200
    apply_async.assert_called_once_with(args=(["hello"],))


def test_status_requires_canonical_task_id_and_task_scoped_hmac(monkeypatch):
    _configure_key(monkeypatch)

    missing = client.get(f"/jobs/celery/{TASK_ID}", headers=_internal_headers())
    wrong = client.get(
        f"/jobs/celery/{TASK_ID}",
        headers={**_internal_headers(), "X-Celery-Job-Token": "0" * 64},
    )
    invalid_id = client.get(
        "/jobs/celery/job-1",
        headers={**_internal_headers(), "X-Celery-Job-Token": _job_token("job-1")},
    )

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert invalid_id.status_code == 400


def test_status_and_stream_accept_service_derived_hmac(monkeypatch):
    _configure_key(monkeypatch)
    import celery.result

    monkeypatch.setattr(celery.result, "AsyncResult", lambda *_args, **_kwargs: _SuccessfulResult())

    status = client.get(f"/jobs/celery/{TASK_ID}", headers=_job_headers())
    stream = client.get(f"/jobs/celery/{TASK_ID}/stream", headers=_job_headers())

    assert status.status_code == 200
    assert status.json()["celery_status"] == "SUCCESS"
    assert stream.status_code == 200
    assert "data: [DONE]" in stream.text
