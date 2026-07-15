from __future__ import annotations

import os
from pathlib import Path
import sys
import types
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient


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
    sys.modules["celery"] = _celery_module
    sys.modules["celery.result"] = _celery_result_module
    sys.modules["celery.schedules"] = _celery_schedules_module

_ensemble = types.ModuleType("src.api.ensemble_client")
_ensemble.rank_pois = MagicMock(return_value=[])
sys.modules.setdefault("src.api.ensemble_client", _ensemble)

import src.api.fastapi_server as server  # noqa: E402
from src.api.celery_app import celery  # noqa: E402
from src.api.tasks import cleanup_stale_temp_paths, task_generate_tts  # noqa: E402


client = TestClient(server.app, raise_server_exceptions=False)


def _auth_headers() -> dict[str, str]:
    return {"X-Internal-Api-Key": server.FASTAPI_INTERNAL_API_KEY}


class _SequencedAsyncResult:
    def __init__(self) -> None:
        self._states = [
            ("VIDEO_RUNNING", {"step": "video", "progress": 20}, None),
            ("SUCCESS", None, {"result_url": "https://example.com/video.mp4"}),
        ]
        self._index = 0
        self._current = self._states[0]

    @property
    def status(self) -> str:
        self._current = self._states[min(self._index, len(self._states) - 1)]
        self._index += 1
        return self._current[0]

    @property
    def info(self):
        return self._current[1]

    @property
    def result(self):
        return self._current[2]


def test_submit_response_exposes_polling_and_stream_urls() -> None:
    response = server._celery_submit_response(types.SimpleNamespace(id="job-123"))
    body = bytes(response.body).decode("utf-8")
    assert '"status_url":"/jobs/celery/job-123"' in body
    assert '"stream_url":"/jobs/celery/job-123/stream"' in body


def test_success_payload_includes_100_percent_progress() -> None:
    result = types.SimpleNamespace(status="SUCCESS", result={"url": "ok"}, info=None)
    payload = server._celery_status_payload("job-1", result)
    assert payload["status"] == "SUCCESS"
    assert payload["meta"] == {"step": "complete", "progress": 100}


def test_celery_sse_emits_changes_done_and_proxy_headers(monkeypatch) -> None:
    fake_result = _SequencedAsyncResult()
    monkeypatch.setattr(server, "CELERY_SSE_POLL_INTERVAL_SECONDS", 0.001)

    with patch("celery.result.AsyncResult", return_value=fake_result):
        response = client.get("/jobs/celery/job-1/stream", headers=_auth_headers())

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-accel-buffering"] == "no"
    assert '"progress": 20' in response.text
    assert '"progress": 100' in response.text
    assert "data: [DONE]" in response.text


def test_celery_sse_requires_internal_api_key() -> None:
    response = client.get("/jobs/celery/job-1/stream")
    assert response.status_code == 401


def test_cleanup_stale_temp_paths_preserves_fresh_entries(tmp_path: Path) -> None:
    temp_root = tmp_path / "temp"
    repository_root = tmp_path / "repo"
    old_job = temp_root / "celery_video_old"
    fresh_job = temp_root / "celery_tts_fresh"
    old_tora = repository_root / ".tmp-tora-meta" / "old.json"
    for path in (old_job, fresh_job, old_tora.parent):
        path.mkdir(parents=True, exist_ok=True)
    old_tora.write_text("{}", encoding="utf-8")

    os.utime(old_job, (9_000, 9_000))
    os.utime(fresh_job, (9_950, 9_950))
    os.utime(old_tora, (9_000, 9_000))

    result = cleanup_stale_temp_paths(
        max_age_seconds=100,
        temp_roots=[temp_root],
        repository_root=repository_root,
        now=10_000,
    )

    assert result["removed_count"] == 2
    assert not old_job.exists()
    assert not old_tora.exists()
    assert fresh_job.exists()


def test_tts_work_directory_is_removed_after_success(tmp_path: Path, monkeypatch) -> None:
    tts_module = types.ModuleType("deploy.media_motion.tts")
    upload_module = types.ModuleType("deploy.media_motion.cloudinary_upload")

    def synthesize_gtts(_text, output_path, lang):
        output_path.write_bytes(f"audio-{lang}".encode())
        return output_path

    tts_module.synthesize_gtts = synthesize_gtts
    upload_module.upload_to_cloudinary = lambda *_args, **_kwargs: {
        "ok": True,
        "url": "https://example.com/tts.wav",
        "source": "cloudinary",
    }
    monkeypatch.setitem(sys.modules, "deploy.media_motion.tts", tts_module)
    monkeypatch.setitem(sys.modules, "deploy.media_motion.cloudinary_upload", upload_module)
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.setattr(task_generate_tts, "update_state", MagicMock())

    result = task_generate_tts.run("안녕하세요", lang="ko")

    assert result["url"] == "https://example.com/tts.wav"
    assert list(tmp_path.glob("celery_tts_*")) == []


def test_celery_beat_routes_hourly_cleanup_to_media_queue() -> None:
    assert celery.conf.task_routes["src.api.tasks.task_cleanup_temp"] == {"queue": "media"}
    schedule = celery.conf.beat_schedule["cleanup-orphaned-media-temp-hourly"]
    assert schedule["task"] == "src.api.tasks.task_cleanup_temp"
