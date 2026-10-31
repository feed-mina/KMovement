"""CPU-only recovery tests: all provider HTTP and uploads are mocked."""
import base64
import concurrent.futures
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from deploy.cloud_gateway.delivery_store import DeliveryStore, execution_mode
from deploy.media_motion import result_delivery
import deploy.cloud_gateway.app as gateway
from fastapi.testclient import TestClient


def output(data=b"generated-video", **extra):
    return {"status": "failed", "generation_status": "success",
            "failure_stage": "delivery", "delivery_status": "failed",
            "metadata": {"actual_model_executed": True},
            "artifacts": [{"kind": "final_video", "path": "/untrusted/final.mp4",
                           "data_base64": base64.b64encode(data).decode()}], **extra}


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.store = DeliveryStore(self.root / "private")

    def test_delivery_failure_keeps_artifacts_and_metadata(self):
        video = self.root / "final.mp4"
        video.write_bytes(b"video")
        result = {"status": "success", "metadata": {"actual_model_executed": True},
                  "artifacts": [{"kind": "final_video", "path": str(video)}]}
        with patch.dict(os.environ, {"KRIDE_RESULT_URL_REQUIRED": "true"}), patch.object(
                result_delivery, "upload_to_cloudinary", return_value={"ok": False}):
            actual = result_delivery.finalize_result(result)
        self.assertEqual(actual["failure_stage"], "delivery")
        self.assertEqual(actual["generation_status"], "success")
        self.assertTrue(actual["metadata"]["actual_model_executed"])
        self.assertEqual(actual["artifacts"][0]["data_base64"], "dmlkZW8=")

    def test_failed_generation_is_not_relabelled_as_delivery_failure(self):
        video = self.root / "intermediate.mp4"
        video.write_bytes(b"partial")
        result = {"status": "failed", "error": "generation failed",
                  "artifacts": [{"kind": "final_video", "path": str(video)}]}
        with patch.object(result_delivery, "upload_to_cloudinary") as upload:
            actual = result_delivery.finalize_result(result)
        upload.assert_not_called()
        self.assertNotIn("failure_stage", actual)
        self.assertEqual(actual["error"], "generation failed")

    def test_final_video_has_inline_priority(self):
        auxiliary = self.root / "raw.mp4"
        final = self.root / "final.mp4"
        auxiliary.write_bytes(b"12345")
        final.write_bytes(b"video")
        result = {"status": "success", "artifacts": [
            {"kind": "raw", "path": str(auxiliary)},
            {"kind": "final_video", "path": str(final)}]}
        with patch.dict(os.environ, {"KRIDE_MAX_INLINE_OUTPUT_BYTES": "5"}), patch.object(
                result_delivery, "upload_to_cloudinary", return_value={"ok": False}):
            actual = result_delivery.finalize_result(result)
        self.assertIsNone(actual["artifacts"][0]["data_base64"])
        self.assertEqual(actual["artifacts"][1]["data_base64"], "dmlkZW8=")

    def test_restart_preserves_result(self):
        self.store.capture("job", "endpoint", output())
        restarted = DeliveryStore(self.root / "private")
        self.assertTrue(restarted.get("job")["retry_available"])
        self.assertNotIn("data_base64", restarted.get("job")["output"]["artifacts"][0])

    def test_success_retries_only_upload_and_is_idempotent(self):
        self.store.capture("job", "endpoint", output())
        seen = []
        def upload(path, **kwargs):
            seen.append((path.read_bytes(), kwargs["public_id"]))
            return {"ok": True, "url": "https://cdn.example/final.mp4"}
        with patch("deploy.cloud_gateway.delivery_store.upload_to_cloudinary", side_effect=upload) as mocked:
            first = self.store.retry("job")
            second = self.store.retry("job")
        self.assertEqual(mocked.call_count, 1)
        self.assertEqual(seen[0][0], b"generated-video")
        self.assertEqual(first, second)
        self.assertEqual(first["output"]["status"], "success")
        self.assertEqual(first["delivery_status"], "delivered")
        self.assertFalse(first["retry_available"])

    def test_failed_retry_preserves_bytes_then_recovers(self):
        self.store.capture("job", "endpoint", output())
        with patch("deploy.cloud_gateway.delivery_store.upload_to_cloudinary",
                   side_effect=[RuntimeError("secret"), {"ok": True, "url": "https://cdn.example/x"}]):
            first = self.store.retry("job")
            second = self.store.retry("job")
        self.assertTrue(first["retry_available"])
        self.assertNotIn("secret", json.dumps(first))
        self.assertEqual(second["attempts"], 2)

    def test_concurrent_duplicate_retry_uploads_once(self):
        self.store.capture("job", "endpoint", output())
        with patch("deploy.cloud_gateway.delivery_store.upload_to_cloudinary",
                   return_value={"ok": True, "url": "https://cdn.example/x"}) as mocked:
            with concurrent.futures.ThreadPoolExecutor(2) as pool:
                results = list(pool.map(self.store.retry, ["job", "job"]))
        self.assertEqual(mocked.call_count, 1)
        self.assertTrue(all(r["delivery_status"] == "delivered" for r in results))

    def test_stale_poll_cannot_overwrite_recovered_result(self):
        self.store.capture("job", "endpoint", output())
        with patch("deploy.cloud_gateway.delivery_store.upload_to_cloudinary",
                   return_value={"ok": True, "url": "https://cdn.example/x"}):
            self.store.retry("job")
        self.assertEqual(self.store.capture("job", "endpoint", output())["delivery_status"], "delivered")

    def test_bad_or_missing_or_oversized_inline_is_not_retryable(self):
        for index, encoded in enumerate([None, "invalid!", "", "A" * (8 * 1024 * 1024 + 4)]):
            result = output()
            result["artifacts"][0]["data_base64"] = encoded
            self.assertFalse(self.store.capture(str(index), "endpoint", result)["retry_available"])

    def test_generation_failure_cannot_be_retried_as_delivery(self):
        result = output()
        result.pop("failure_stage")
        self.store.capture("job", "endpoint", result)
        with self.assertRaises(ValueError):
            self.store.retry("job")

    def test_endpoint_mismatch_rejected(self):
        self.store.capture("job", "endpoint", output())
        with self.assertRaises(ValueError):
            self.store.capture("job", "different", output())

    def test_execution_modes_require_evidence(self):
        self.assertEqual(execution_mode({"route": "cogvideox_real"}), "unknown")
        self.assertEqual(execution_mode(output()), "model_executed")
        self.assertEqual(execution_mode({"metadata": {"actual_model_executed": False}}), "model_not_executed")
        self.assertEqual(execution_mode({"metadata": {"simulation": True}}), "simulation")
        self.assertEqual(execution_mode({"metadata": {"fallback_type": "zoompan"}}), "fallback")

    def test_fallback_status_survives_delivery_retry(self):
        result = output(generation_status="fallback_used", fallback_reason="model unavailable")
        self.store.capture("job", "endpoint", result)
        with patch("deploy.cloud_gateway.delivery_store.upload_to_cloudinary",
                   return_value={"ok": True, "url": "https://cdn.example/x"}):
            recovered = self.store.retry("job")
        self.assertEqual(recovered["output"]["status"], "fallback_used")
        self.assertEqual(recovered["output"]["fallback_reason"], "model unavailable")


class GatewayTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = str(Path(self.temporary.name) / "private")
        self.env = patch.dict(os.environ, {"KRIDE_DELIVERY_DIR": self.directory})
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client = TestClient(gateway.app)
        self.headers = {"X-Internal-Api-Key": gateway.FASTAPI_INTERNAL_API_KEY}

    def test_recovery_requires_internal_auth(self):
        self.assertEqual(self.client.post("/jobs/runpod/job/delivery-retry").status_code, 401)
        self.assertEqual(self.client.get("/jobs/runpod/job/delivery").status_code, 401)

    def test_missing_job_does_not_submit_generation(self):
        with patch("httpx.post", side_effect=AssertionError("GPU submission forbidden")):
            response = self.client.post("/jobs/runpod/missing/delivery-retry", headers=self.headers)
        self.assertEqual(response.status_code, 404)

    def test_recovery_opt_in_and_private_storage(self):
        with patch.dict(os.environ, {"KRIDE_DELIVERY_DIR": ""}):
            self.assertEqual(self.client.get("/jobs/runpod/job/delivery", headers=self.headers).status_code, 501)
        with patch.dict(os.environ, {"KRIDE_DELIVERY_DIR": str(gateway.MEDIA_DIR / "private")}):
            self.assertEqual(self.client.get("/jobs/runpod/job/delivery", headers=self.headers).status_code, 503)

    def test_poll_capture_retry_and_cached_status_without_runpod(self):
        class Response:
            status_code = 200
            def raise_for_status(self):
                pass
            def json(self):
                return {"status": "COMPLETED", "output": output()}
        with patch.object(gateway, "RUNPOD_API_KEY", "fake"), patch.object(
                gateway, "_configured_runpod_endpoint_ids", return_value=["endpoint"]), patch(
                "httpx.get", return_value=Response()):
            first = self.client.get("/jobs/runpod/job", headers=self.headers)
        self.assertTrue(first.json()["delivery"]["retry_available"])
        with patch("httpx.post", side_effect=AssertionError("GPU submission forbidden")), patch(
                "httpx.get", side_effect=AssertionError("Unexpected provider poll")), patch(
                "deploy.cloud_gateway.delivery_store.upload_to_cloudinary",
                return_value={"ok": True, "url": "https://cdn.example/x"}):
            retry = self.client.post("/jobs/runpod/job/delivery-retry", headers=self.headers)
            final = self.client.get("/jobs/runpod/job", headers=self.headers)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(final.json()["output"]["result_url"], "https://cdn.example/x")

    def test_audio_inline_result_is_not_changed_by_recovery(self):
        payload = {"status": "COMPLETED", "output": {"status": "success",
                   "artifacts": [{"kind": "tts", "data_base64": "YXVkaW8="}]}}
        class Response:
            status_code = 200
            def raise_for_status(self):
                pass
            def json(self):
                return copy.deepcopy(payload)
        with patch.object(gateway, "RUNPOD_API_KEY", "fake"), patch.object(
                gateway, "_configured_runpod_endpoint_ids", return_value=["endpoint"]), patch(
                "httpx.get", return_value=Response()):
            actual = self.client.get("/jobs/runpod/audio", headers=self.headers)
        self.assertEqual(actual.json()["output"], payload["output"])
        self.assertNotIn("delivery", actual.json())

    def test_console_has_safe_mode_labels_and_no_generation_submit(self):
        response = self.client.get("/jobs/delivery")
        self.assertEqual(response.status_code, 200)
        self.assertIn("실제 모델 실행 여부 미확인", response.text)
        self.assertIn("CPU", response.text)
        self.assertIn("모의 처리", response.text)
        self.assertNotIn("localStorage", response.text)
        self.assertNotIn("/jobs/runpod/batch", response.text)


if __name__ == "__main__":
    unittest.main()
