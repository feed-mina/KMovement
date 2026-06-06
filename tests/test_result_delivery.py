from pathlib import Path

from deploy.media_motion import result_delivery


def _video_result(path: Path) -> dict:
    return {
        "route": "batch_video",
        "status": "success",
        "case_id": "community_batch_20",
        "artifacts": [
            {
                "kind": "final_video",
                "path": str(path),
                "exists": True,
                "size_mb": 0.001,
            }
        ],
    }


def test_finalize_result_uploads_video_and_returns_url(tmp_path, monkeypatch):
    video = tmp_path / "final.mp4"
    video.write_bytes(b"video-data")
    monkeypatch.setattr(
        result_delivery,
        "upload_to_cloudinary",
        lambda *args, **kwargs: {"ok": True, "url": "https://cdn.example/final.mp4"},
    )
    monkeypatch.setenv("KRIDE_RESULT_URL_REQUIRED", "true")

    result = result_delivery.finalize_result(_video_result(video))

    assert result["result_url"] == "https://cdn.example/final.mp4"
    assert result["artifacts"][0]["url"] == result["result_url"]
    assert result["artifacts"][0]["data_base64"] is None


def test_finalize_result_fails_clearly_when_required_upload_is_missing(tmp_path, monkeypatch):
    video = tmp_path / "final.mp4"
    video.write_bytes(b"video-data")
    monkeypatch.setattr(
        result_delivery,
        "upload_to_cloudinary",
        lambda *args, **kwargs: {"ok": False, "error": "Cloudinary not configured"},
    )
    monkeypatch.setenv("KRIDE_RESULT_URL_REQUIRED", "true")

    result = result_delivery.finalize_result(_video_result(video))

    assert result["status"] == "failed"
    assert "CLOUDINARY_CLOUD_NAME" in result["error"]
    assert "Cloudinary not configured" in result["error"]


def test_finalize_result_keeps_small_non_video_artifact_inline(tmp_path, monkeypatch):
    audio = tmp_path / "tts.wav"
    audio.write_bytes(b"audio-data")
    monkeypatch.delenv("KRIDE_RESULT_URL_REQUIRED", raising=False)
    result = {
        "route": "gpt_sovits_tts",
        "status": "success",
        "case_id": "tts",
        "artifacts": [{"kind": "tts", "path": str(audio)}],
    }

    encoded = result_delivery.finalize_result(result)

    assert encoded["artifacts"][0]["data_base64"] == "YXVkaW8tZGF0YQ=="
