from __future__ import annotations

import base64
import os
from pathlib import Path
from typing import Any

from .cloudinary_upload import upload_to_cloudinary


MEDIA_SUFFIXES = {".gif", ".mp3", ".mp4", ".mov", ".wav", ".webm"}


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _inline_budget() -> int:
    try:
        return max(0, int(os.environ.get("KRIDE_MAX_INLINE_OUTPUT_BYTES", "6291456")))
    except ValueError:
        return 6 * 1024 * 1024


def _final_video_artifact(artifacts: list[dict[str, Any]]) -> dict[str, Any] | None:
    return next((artifact for artifact in artifacts if artifact.get("kind") == "final_video"), None)


def finalize_result(result: dict[str, Any]) -> dict[str, Any]:
    """Upload the final video and keep the RunPod response below payload limits."""
    artifacts = result.get("artifacts", [])
    if not isinstance(artifacts, list):
        artifacts = []

    final_artifact = _final_video_artifact(artifacts)
    # An intermediate file in a failed generation is not proof of completion.
    if result.get("status") not in {"success", "fallback_used"} and result.get("failure_stage") != "delivery":
        final_artifact = None
    delivery_error = ""

    if final_artifact:
        final_path = Path(str(final_artifact.get("path", "")))
        if final_path.is_file():
            case_id = str(result.get("case_id", "unknown"))
            upload = upload_to_cloudinary(
                final_path,
                folder=f"kride/media/{case_id}",
                resource_type="video",
                public_id=final_path.stem,
            )
            if upload.get("ok") and upload.get("url"):
                result["result_url"] = str(upload["url"])
                final_artifact["url"] = str(upload["url"])
            else:
                delivery_error = str(upload.get("error", "final video upload failed"))
                result["result_delivery_error"] = delivery_error

    if result.get("status") == "fallback_used":
        result["fallback_reason"] = result.pop("error", "")

    if final_artifact and not result.get("result_url"):
        generation_status = result.get("generation_status", result.get("status", "success"))
        result.update({
            "route": result.get("route", ""),
            "status": "failed" if _env_bool("KRIDE_RESULT_URL_REQUIRED") else result.get("status", "success"),
            "case_id": result.get("case_id", ""),
            "generation_status": generation_status,
            "failure_stage": "delivery",
            "delivery_status": "failed",
            "error": (
                "The video was generated, but no public result URL could be created. "
                "Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and "
                f"CLOUDINARY_API_SECRET. Upload error: {delivery_error or 'unknown'}"
            ),
        })
    elif final_artifact and result.get("result_url"):
        result["delivery_status"] = "delivered"

    remaining = _inline_budget()
    has_public_video = bool(result.get("result_url"))
    # Keep the final video ahead of auxiliary artifacts within the bounded payload.
    ordered = sorted(artifacts, key=lambda item: item.get("kind") != "final_video")
    for artifact in ordered:
        path = Path(str(artifact.get("path", "")))
        if not path.is_file():
            artifact["data_base64"] = None
            continue

        size = path.stat().st_size
        if has_public_video and path.suffix.lower() in MEDIA_SUFFIXES:
            artifact["data_base64"] = None
            continue

        if size > remaining:
            artifact["data_base64"] = None
            continue

        artifact["data_base64"] = base64.b64encode(path.read_bytes()).decode()
        remaining -= size

    return result
