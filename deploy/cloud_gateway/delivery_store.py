"""Bounded, durable CPU-only delivery recovery for completed RunPod outputs.

No model imports, RunPod submissions, caller-supplied file paths or URLs.
Mount KRIDE_DELIVERY_DIR outside the public media tree for restart recovery.
"""
from __future__ import annotations

import base64
import binascii
import copy
import hashlib
import json
import sqlite3
import tempfile
from contextlib import contextmanager
from pathlib import Path

from deploy.media_motion.cloudinary_upload import upload_to_cloudinary

MAX_VIDEO_BYTES = 6 * 1024 * 1024


def execution_mode(output: dict) -> str:
    metadata = output.get("metadata") or {}
    if metadata.get("mock") is True or metadata.get("simulation") is True:
        return "simulation"
    actual = metadata.get("actual_model_executed")
    if actual is True:
        return "model_executed"
    if output.get("status") == "fallback_used" or metadata.get("fallback_type"):
        return "fallback"
    if actual is False:
        return "model_not_executed"
    return "unknown"


class DeliveryStore:
    def __init__(self, directory: Path):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.database = self.directory / "delivery.sqlite3"
        with self.connect() as con:
            con.execute("""CREATE TABLE IF NOT EXISTS deliveries(
                job TEXT PRIMARY KEY, endpoint TEXT NOT NULL, output TEXT NOT NULL,
                video BLOB, attempts INTEGER NOT NULL DEFAULT 0)""")

    @contextmanager
    def connect(self):
        con = sqlite3.connect(self.database, timeout=60)
        con.row_factory = sqlite3.Row
        try:
            with con:
                yield con
        finally:
            con.close()

    def capture(self, job: str, endpoint: str, output: dict) -> dict:
        """First observation wins; stale provider polls cannot undo a retry."""
        clean = copy.deepcopy(output)
        artifacts = clean.get("artifacts", [])
        video = None
        if isinstance(artifacts, list):
            for artifact in artifacts:
                if not isinstance(artifact, dict):
                    continue
                encoded = artifact.pop("data_base64", None)
                if artifact.get("kind") != "final_video" or not isinstance(encoded, str) or video is not None:
                    continue
                if len(encoded) > ((MAX_VIDEO_BYTES + 2) // 3) * 4:
                    continue
                try:
                    decoded = base64.b64decode(encoded, validate=True)
                    if 0 < len(decoded) <= MAX_VIDEO_BYTES:
                        video = decoded
                except (ValueError, binascii.Error):
                    pass
        # Only accept worker-declared delivery failures. A generation failure
        # with an intermediate artifact must never become a successful video.
        if clean.get("failure_stage") != "delivery":
            video = None
        with self.connect() as con:
            con.execute("INSERT OR IGNORE INTO deliveries(job,endpoint,output,video) VALUES(?,?,?,?)",
                        (job, endpoint, json.dumps(clean), video))
            row = con.execute("SELECT * FROM deliveries WHERE job=?", (job,)).fetchone()
            if row["endpoint"] != endpoint:
                raise ValueError("Job endpoint mismatch")
            return self._view(row)

    def get(self, job: str) -> dict:
        with self.connect() as con:
            row = con.execute("SELECT * FROM deliveries WHERE job=?", (job,)).fetchone()
            if row is None:
                raise KeyError(job)
            return self._view(row)

    @staticmethod
    def _view(row) -> dict:
        output = json.loads(row["output"])
        delivered = bool(output.get("result_url"))
        failed_delivery = output.get("failure_stage") == "delivery"
        return {
            "job_id": row["job"],
            "endpoint_id": row["endpoint"],
            "generation_status": "completed" if failed_delivery or delivered else output.get("status", "unknown"),
            "delivery_status": "delivered" if delivered else ("failed" if failed_delivery else "unavailable"),
            "failure_stage": output.get("failure_stage"),
            "retry_available": bool(failed_delivery and row["video"] and not delivered),
            "retry_unavailable_reason": None if delivered or row["video"] else "No retained final video within the 6 MiB recovery limit.",
            "attempts": row["attempts"],
            "execution_mode": execution_mode(output),
            "output": output,
        }

    def retry(self, job: str) -> dict:
        """Serialize delivery attempts, and reuse the same CDN object identity."""
        with self.connect() as con:
            con.execute("BEGIN IMMEDIATE")
            row = con.execute("SELECT * FROM deliveries WHERE job=?", (job,)).fetchone()
            if row is None:
                raise KeyError(job)
            view = self._view(row)
            if view["delivery_status"] == "delivered":
                return view
            if not view["retry_available"]:
                raise ValueError("No retained final video; delivery-only retry is unavailable")
            output = view["output"]
            # Ignore paths and case IDs in the worker response.
            identity = hashlib.sha256((row["endpoint"] + ":" + job).encode()).hexdigest()
            try:
                with tempfile.TemporaryDirectory() as temporary:
                    video = Path(temporary) / (identity + ".mp4")
                    video.write_bytes(row["video"])
                    upload = upload_to_cloudinary(video, folder="kride/recovered",
                                                  resource_type="video", public_id=identity)
            except Exception:
                upload = {"ok": False}
            if upload.get("ok") and upload.get("url"):
                output["result_url"] = str(upload["url"])
                output["status"] = output.pop("generation_status", "success")
                output["delivery_status"] = "delivered"
                output.pop("failure_stage", None)
                output.pop("error", None)
                output.pop("result_delivery_error", None)
                for artifact in output.get("artifacts", []):
                    if isinstance(artifact, dict) and artifact.get("kind") == "final_video":
                        artifact["url"] = output["result_url"]
            else:
                # Do not return provider exception text that may include secrets.
                output["result_delivery_error"] = "Result upload failed; retained video is available."
            con.execute("UPDATE deliveries SET output=?,attempts=attempts+1 WHERE job=?",
                        (json.dumps(output), job))
            return self._view(con.execute("SELECT * FROM deliveries WHERE job=?", (job,)).fetchone())
