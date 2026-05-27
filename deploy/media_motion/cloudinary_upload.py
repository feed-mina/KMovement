"""
Cloudinary Upload Utility for K-Ride Media Motion
==================================================
Uploads generated media artifacts (MP4, WAV) to Cloudinary CDN.
Falls back to local/zrok serving when Cloudinary is unavailable.

Environment variables:
    CLOUDINARY_CLOUD_NAME  — Cloudinary cloud name
    CLOUDINARY_API_KEY     — Cloudinary API key
    CLOUDINARY_API_SECRET  — Cloudinary API secret
    KRIDE_ZROK_BASE_URL    — zrok fallback base URL (optional)
"""
from __future__ import annotations

import base64
import os
import tempfile
from pathlib import Path
from typing import Any


def _cloudinary_configured() -> bool:
    return all([
        os.environ.get("CLOUDINARY_CLOUD_NAME"),
        os.environ.get("CLOUDINARY_API_KEY"),
        os.environ.get("CLOUDINARY_API_SECRET"),
    ])


def upload_to_cloudinary(
    file_path: Path | str,
    *,
    folder: str = "kride/media",
    resource_type: str = "auto",
    public_id: str | None = None,
) -> dict[str, Any]:
    """Upload a file to Cloudinary and return the result with CDN URL.

    Returns:
        {"ok": True, "url": "https://res.cloudinary.com/...", "public_id": "...", "source": "cloudinary"}
        or
        {"ok": False, "error": "...", "source": "none"}
    """
    file_path = Path(file_path)
    if not file_path.exists():
        return {"ok": False, "error": f"File not found: {file_path}", "source": "none"}

    if not _cloudinary_configured():
        return {"ok": False, "error": "Cloudinary not configured", "source": "none"}

    try:
        import cloudinary
        import cloudinary.uploader

        cloudinary.config(
            cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
            api_key=os.environ["CLOUDINARY_API_KEY"],
            api_secret=os.environ["CLOUDINARY_API_SECRET"],
            secure=True,
        )

        upload_kwargs: dict[str, Any] = {
            "folder": folder,
            "resource_type": resource_type,
        }
        if public_id:
            upload_kwargs["public_id"] = public_id

        result = cloudinary.uploader.upload(str(file_path), **upload_kwargs)

        return {
            "ok": True,
            "url": result.get("secure_url", result.get("url", "")),
            "public_id": result.get("public_id", ""),
            "format": result.get("format", ""),
            "size_bytes": result.get("bytes", 0),
            "source": "cloudinary",
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)[:500], "source": "none"}


def upload_base64_to_cloudinary(
    data_base64: str,
    filename: str,
    *,
    folder: str = "kride/media",
    resource_type: str = "auto",
) -> dict[str, Any]:
    """Upload base64-encoded data to Cloudinary (for RunPod response artifacts)."""
    with tempfile.NamedTemporaryFile(
        suffix=Path(filename).suffix,
        delete=False,
    ) as tmp:
        tmp.write(base64.b64decode(data_base64))
        tmp_path = Path(tmp.name)

    try:
        return upload_to_cloudinary(
            tmp_path,
            folder=folder,
            resource_type=resource_type,
            public_id=Path(filename).stem,
        )
    finally:
        tmp_path.unlink(missing_ok=True)


def upload_artifacts_from_result(
    result: dict[str, Any],
    *,
    folder: str = "kride/media",
) -> list[dict[str, Any]]:
    """Upload all artifacts from a RunPod/worker result dict to Cloudinary.

    Each artifact with `data_base64` gets uploaded. Returns list of upload results.
    Falls back to zrok URL if Cloudinary fails.
    """
    zrok_base = os.environ.get("KRIDE_ZROK_BASE_URL", "")
    uploaded: list[dict[str, Any]] = []

    for artifact in result.get("artifacts", []):
        kind = artifact.get("kind", "unknown")
        orig_path = artifact.get("path", "")
        filename = Path(orig_path).name if orig_path else f"{kind}.bin"
        data_b64 = artifact.get("data_base64")

        # Try Cloudinary first
        if data_b64 and _cloudinary_configured():
            case_id = result.get("case_id", "unknown")
            sub_folder = f"{folder}/{case_id}"
            upload_result = upload_base64_to_cloudinary(
                data_b64, filename, folder=sub_folder,
            )
            if upload_result["ok"]:
                uploaded.append({
                    "kind": kind,
                    "filename": filename,
                    **upload_result,
                })
                continue

        # Fallback to zrok URL
        if zrok_base and orig_path:
            uploaded.append({
                "kind": kind,
                "filename": filename,
                "ok": True,
                "url": f"{zrok_base}/media/{filename}",
                "source": "zrok",
            })
        else:
            uploaded.append({
                "kind": kind,
                "filename": filename,
                "ok": False,
                "error": "No Cloudinary or zrok configured",
                "source": "none",
            })

    return uploaded


def get_media_url(
    artifact_path: str | Path,
    *,
    case_id: str = "",
    kind: str = "",
) -> str:
    """Get the best available URL for a media artifact.

    Priority: Cloudinary CDN > zrok tunnel > local path
    """
    zrok_base = os.environ.get("KRIDE_ZROK_BASE_URL", "")
    filename = Path(artifact_path).name

    # If Cloudinary is configured, construct expected URL
    if _cloudinary_configured():
        cloud_name = os.environ["CLOUDINARY_CLOUD_NAME"]
        ext = Path(artifact_path).suffix.lstrip(".")
        resource = "video" if ext in ("mp4", "webm", "mov") else "raw"
        public_id = f"kride/media/{case_id}/{Path(artifact_path).stem}" if case_id else f"kride/media/{Path(artifact_path).stem}"
        return f"https://res.cloudinary.com/{cloud_name}/{resource}/upload/{public_id}.{ext}"

    # Fallback to zrok
    if zrok_base:
        return f"{zrok_base}/media/{filename}"

    # Last resort: local path
    return str(artifact_path)
