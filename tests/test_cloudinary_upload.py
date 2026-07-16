from __future__ import annotations

import sys
import types

from deploy.media_motion import cloudinary_upload


def test_cloudinary_url_replaces_empty_individual_credentials(monkeypatch) -> None:
    monkeypatch.setenv(
        "CLOUDINARY_URL",
        "cloudinary://api-key:secret%2Fwith%40chars@demo-cloud",
    )
    monkeypatch.setenv("CLOUDINARY_API_KEY", "")
    monkeypatch.setenv("CLOUDINARY_API_SECRET", "")
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "")

    cloudinary_upload._parse_cloudinary_url()

    assert cloudinary_upload._cloudinary_configured()
    assert cloudinary_upload.os.environ["CLOUDINARY_API_KEY"] == "api-key"
    assert cloudinary_upload.os.environ["CLOUDINARY_API_SECRET"] == "secret/with@chars"
    assert cloudinary_upload.os.environ["CLOUDINARY_CLOUD_NAME"] == "demo-cloud"


def test_cloudinary_url_does_not_override_explicit_credentials(monkeypatch) -> None:
    monkeypatch.setenv("CLOUDINARY_URL", "cloudinary://url-key:url-secret@url-cloud")
    monkeypatch.setenv("CLOUDINARY_API_KEY", "explicit-key")
    monkeypatch.setenv("CLOUDINARY_API_SECRET", "explicit-secret")
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "explicit-cloud")

    cloudinary_upload._parse_cloudinary_url()

    assert cloudinary_upload.os.environ["CLOUDINARY_API_KEY"] == "explicit-key"
    assert cloudinary_upload.os.environ["CLOUDINARY_API_SECRET"] == "explicit-secret"
    assert cloudinary_upload.os.environ["CLOUDINARY_CLOUD_NAME"] == "explicit-cloud"


def test_invalid_cloudinary_url_does_not_create_credentials(monkeypatch) -> None:
    monkeypatch.setenv("CLOUDINARY_URL", "https://example.com/not-cloudinary")
    monkeypatch.delenv("CLOUDINARY_API_KEY", raising=False)
    monkeypatch.delenv("CLOUDINARY_API_SECRET", raising=False)
    monkeypatch.delenv("CLOUDINARY_CLOUD_NAME", raising=False)

    cloudinary_upload._parse_cloudinary_url()

    assert not cloudinary_upload._cloudinary_configured()


def test_upload_without_a_public_url_is_a_failure(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("CLOUDINARY_API_KEY", "key")
    monkeypatch.setenv("CLOUDINARY_API_SECRET", "secret")
    monkeypatch.setenv("CLOUDINARY_CLOUD_NAME", "cloud")
    artifact = tmp_path / "artifact.wav"
    artifact.write_bytes(b"audio")

    cloudinary_module = types.ModuleType("cloudinary")
    uploader_module = types.ModuleType("cloudinary.uploader")
    cloudinary_module.config = lambda **_kwargs: None
    uploader_module.upload = lambda *_args, **_kwargs: {"public_id": "artifact"}
    cloudinary_module.uploader = uploader_module
    monkeypatch.setitem(sys.modules, "cloudinary", cloudinary_module)
    monkeypatch.setitem(sys.modules, "cloudinary.uploader", uploader_module)

    result = cloudinary_upload.upload_to_cloudinary(artifact)

    assert result == {
        "ok": False,
        "error": "Cloudinary upload returned no public URL",
        "source": "none",
    }
