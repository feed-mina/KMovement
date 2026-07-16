from __future__ import annotations

import os
from pathlib import Path
import sys
import types
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
import pytest


os.environ.setdefault("FASTAPI_INTERNAL_API_KEY", "test-internal-api-key-for-celery-pipeline")


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
    _celery_module.result = _celery_result_module
    _celery_module.schedules = _celery_schedules_module
    sys.modules["celery"] = _celery_module
    sys.modules["celery.result"] = _celery_result_module
    sys.modules["celery.schedules"] = _celery_schedules_module

_ensemble = types.ModuleType("src.api.ensemble_client")
_ensemble.rank_pois = MagicMock(return_value=[])
sys.modules.setdefault("src.api.ensemble_client", _ensemble)

import src.api.fastapi_server as server  # noqa: E402
from src.api.celery_app import celery  # noqa: E402
from src.api.tasks import cleanup_stale_temp_paths, task_generate_tts, task_generate_video  # noqa: E402


client = TestClient(server.app, raise_server_exceptions=False)
CELERY_TASK_ID = "85a9f8bb-e57b-4b8d-a1ca-5a1f34cb764a"


def _auth_headers(task_id: str = CELERY_TASK_ID) -> dict[str, str]:
    return {
        "X-Internal-Api-Key": server.FASTAPI_INTERNAL_API_KEY,
        "X-Celery-Job-Token": server._celery_job_token(task_id),
    }


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


def _install_video_pipeline_stubs(monkeypatch, finalized: dict) -> dict[str, Path]:
    captured: dict[str, Path] = {}

    runpod_module = types.ModuleType("deploy.media_motion.runpod_handler")

    def download_image(_url, _case_id, work_dir):
        image_path = work_dir / "input.jpg"
        image_path.write_bytes(b"image")
        return image_path

    runpod_module._download_image = download_image

    bgm_module = types.ModuleType("deploy.media_motion.bgm")

    def ensure_fallback_bgm(bgm_dir, _bgm_key):
        bgm_dir.mkdir(parents=True, exist_ok=True)
        bgm_path = bgm_dir / "fallback.wav"
        bgm_path.write_bytes(b"audio")
        return bgm_path

    bgm_module.ensure_fallback_bgm = ensure_fallback_bgm

    config_module = types.ModuleType("deploy.media_motion.worker_config")
    config_module.load_worker_config = lambda **_kwargs: types.SimpleNamespace()

    schemas_module = types.ModuleType("deploy.media_motion.schemas")
    schemas_module.TravelCase = lambda **kwargs: types.SimpleNamespace(**kwargs)

    video_module = types.ModuleType("deploy.media_motion.three_d_photo_light")

    def run_video(_case, work_dir, _bgm_wav):
        video_path = work_dir / "final.mp4"
        video_path.write_bytes(b"video")
        captured["local_video"] = video_path
        artifact = types.SimpleNamespace(kind="final_video", path=video_path)
        result = types.SimpleNamespace(
            status="success",
            route="3d_photo_light",
            metadata={"actual_model_executed": True},
            artifacts=[artifact],
        )
        result.to_dict = lambda: {
            "status": result.status,
            "route": result.route,
            "metadata": result.metadata,
            "artifacts": [{"kind": "final_video", "path": str(video_path)}],
        }
        return result

    video_module.run_3d_photo_light_case = run_video

    delivery_module = types.ModuleType("deploy.media_motion.result_delivery")
    delivery_module.finalize_result = lambda _result: dict(finalized)

    for name, module in {
        "deploy.media_motion.runpod_handler": runpod_module,
        "deploy.media_motion.bgm": bgm_module,
        "deploy.media_motion.worker_config": config_module,
        "deploy.media_motion.schemas": schemas_module,
        "deploy.media_motion.three_d_photo_light": video_module,
        "deploy.media_motion.result_delivery": delivery_module,
    }.items():
        monkeypatch.setitem(sys.modules, name, module)

    return captured


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
        response = client.get(
            f"/jobs/celery/{CELERY_TASK_ID}/stream",
            headers=_auth_headers(),
        )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["x-accel-buffering"] == "no"
    assert '"progress": 20' in response.text
    assert '"progress": 100' in response.text
    assert "data: [DONE]" in response.text


def test_celery_sse_requires_internal_api_key() -> None:
    response = client.get(f"/jobs/celery/{CELERY_TASK_ID}/stream")
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


def test_tts_upload_failure_never_returns_deleted_local_path(tmp_path: Path, monkeypatch) -> None:
    tts_module = types.ModuleType("deploy.media_motion.tts")
    upload_module = types.ModuleType("deploy.media_motion.cloudinary_upload")

    def synthesize_gtts(_text, output_path, lang):
        output_path.write_bytes(f"audio-{lang}".encode())
        return output_path

    tts_module.synthesize_gtts = synthesize_gtts
    upload_module.upload_to_cloudinary = lambda *_args, **_kwargs: {
        "ok": False,
        "error": "Cloudinary not configured",
    }
    monkeypatch.setitem(sys.modules, "deploy.media_motion.tts", tts_module)
    monkeypatch.setitem(sys.modules, "deploy.media_motion.cloudinary_upload", upload_module)
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.delenv("KRIDE_RESULT_URL_REQUIRED", raising=False)
    monkeypatch.setattr(task_generate_tts, "update_state", MagicMock())

    result = task_generate_tts.run("hello", lang="ko")

    assert result == {
        "status": "success",
        "url": "",
        "source": "unavailable",
        "text_length": 5,
        "upload_error": "Cloudinary not configured",
    }
    assert list(tmp_path.glob("celery_tts_*")) == []


def test_tts_required_delivery_retries_when_upload_has_no_public_url(tmp_path: Path, monkeypatch) -> None:
    tts_module = types.ModuleType("deploy.media_motion.tts")
    upload_module = types.ModuleType("deploy.media_motion.cloudinary_upload")

    def synthesize_gtts(_text, output_path, lang):
        output_path.write_bytes(f"audio-{lang}".encode())
        return output_path

    tts_module.synthesize_gtts = synthesize_gtts
    upload_module.upload_to_cloudinary = lambda *_args, **_kwargs: {
        "ok": True,
        "url": "",
        "source": "cloudinary",
    }
    monkeypatch.setitem(sys.modules, "deploy.media_motion.tts", tts_module)
    monkeypatch.setitem(sys.modules, "deploy.media_motion.cloudinary_upload", upload_module)
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.setenv("KRIDE_RESULT_URL_REQUIRED", "true")
    monkeypatch.setattr(task_generate_tts, "update_state", MagicMock())
    retry = MagicMock(side_effect=RuntimeError("retry scheduled"))
    monkeypatch.setattr(task_generate_tts, "retry", retry)

    with pytest.raises(RuntimeError, match="retry scheduled"):
        task_generate_tts.run("hello", lang="en")

    retry.assert_called_once()
    assert "no public URL" in str(retry.call_args.kwargs["exc"])
    assert list(tmp_path.glob("celery_tts_*")) == []


def test_video_uses_finalized_public_result_url(tmp_path: Path, monkeypatch) -> None:
    captured = _install_video_pipeline_stubs(
        monkeypatch,
        {
            "status": "success",
            "route": "3d_photo_light",
            "result_url": "https://cdn.example/final.mp4",
        },
    )
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.setenv("KRIDE_RESULT_URL_REQUIRED", "true")
    monkeypatch.setattr(task_generate_video, "update_state", MagicMock())

    result = task_generate_video.run("https://example.com/input.jpg", route="3d_photo_light")

    assert result == {
        "status": "success",
        "route": "3d_photo_light",
        "result_url": "https://cdn.example/final.mp4",
        "actual_model_executed": True,
        "case_id": "celery_video",
    }
    assert not captured["local_video"].exists()
    assert list(tmp_path.glob("celery_video_*")) == []


def test_video_never_returns_deleted_local_result_path(tmp_path: Path, monkeypatch) -> None:
    captured = _install_video_pipeline_stubs(
        monkeypatch,
        {
            "status": "success",
            "route": "3d_photo_light",
            "result_delivery_error": "Cloudinary not configured",
        },
    )
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.delenv("KRIDE_RESULT_URL_REQUIRED", raising=False)
    monkeypatch.setattr(task_generate_video, "update_state", MagicMock())

    result = task_generate_video.run("https://example.com/input.jpg", route="3d_photo_light")

    assert result["result_url"] == ""
    assert result["result_url"] != str(captured["local_video"])
    assert not captured["local_video"].exists()


def test_video_retries_when_required_result_delivery_fails(tmp_path: Path, monkeypatch) -> None:
    captured = _install_video_pipeline_stubs(
        monkeypatch,
        {
            "status": "failed",
            "route": "3d_photo_light",
            "error": "Cloudinary credentials are missing",
        },
    )
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.setenv("KRIDE_RESULT_URL_REQUIRED", "true")
    monkeypatch.setattr(task_generate_video, "update_state", MagicMock())

    def raise_retry(*, exc):
        raise exc

    retry = MagicMock(side_effect=raise_retry)
    monkeypatch.setattr(task_generate_video, "retry", retry)

    with pytest.raises(RuntimeError, match="Cloudinary credentials are missing"):
        task_generate_video.run("https://example.com/input.jpg", route="3d_photo_light")

    retry.assert_called_once()
    assert not captured["local_video"].exists()
    assert list(tmp_path.glob("celery_video_*")) == []


def test_video_retries_for_case_insensitive_failed_status(tmp_path: Path, monkeypatch) -> None:
    captured = _install_video_pipeline_stubs(
        monkeypatch,
        {
            "status": "FAILED",
            "route": "3d_photo_light",
            "result_url": "https://cdn.example/unusable.mp4",
            "error": "Video generation failed",
        },
    )
    monkeypatch.setenv("CELERY_MEDIA_TEMP_DIR", str(tmp_path))
    monkeypatch.delenv("KRIDE_RESULT_URL_REQUIRED", raising=False)
    monkeypatch.setattr(task_generate_video, "update_state", MagicMock())

    def raise_retry(*, exc):
        raise exc

    retry = MagicMock(side_effect=raise_retry)
    monkeypatch.setattr(task_generate_video, "retry", retry)

    with pytest.raises(RuntimeError, match="Video generation failed"):
        task_generate_video.run("https://example.com/input.jpg", route="3d_photo_light")

    retry.assert_called_once()
    assert not captured["local_video"].exists()


def test_celery_beat_routes_hourly_cleanup_to_maintenance_queue() -> None:
    assert celery.conf.task_routes["src.api.tasks.task_cleanup_temp"] == {"queue": "maintenance"}
    schedule = celery.conf.beat_schedule["cleanup-orphaned-media-temp-hourly"]
    assert schedule["task"] == "src.api.tasks.task_cleanup_temp"
