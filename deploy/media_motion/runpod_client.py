"""
RunPod Serverless Client for K-Ride Media Motion
=================================================
Async client to submit jobs and poll results from RunPod.

Usage:
    client = RunPodMediaClient()
    result = await client.generate_video(
        route="cogvideox_real",
        image_path="photo.jpg",
        case_id="gangneung",
        place="Gangneung Beach",
        tts_text="강릉 해변 소개입니다.",
    )

Environment variables:
    RUNPOD_API_KEY      — RunPod API key
    RUNPOD_ENDPOINT_ID  — Serverless endpoint ID
"""
from __future__ import annotations

import asyncio
import base64
import json
import os
import time
from pathlib import Path
from typing import Any

import httpx

RUNPOD_API_BASE = "https://api.runpod.ai/v2"


class RunPodMediaClient:
    """Async client for RunPod serverless media generation."""

    def __init__(
        self,
        api_key: str | None = None,
        endpoint_id: str | None = None,
        timeout: int = 600,
        poll_interval: int = 5,
    ):
        self.api_key = api_key or os.environ.get("RUNPOD_API_KEY", "")
        self.endpoint_id = endpoint_id or os.environ.get("RUNPOD_ENDPOINT_ID", "")
        self.timeout = timeout
        self.poll_interval = poll_interval

        if not self.api_key:
            raise ValueError("RUNPOD_API_KEY is required")
        if not self.endpoint_id:
            raise ValueError("RUNPOD_ENDPOINT_ID is required")

    @property
    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    @property
    def _base_url(self) -> str:
        return f"{RUNPOD_API_BASE}/{self.endpoint_id}"

    async def submit_job(self, payload: dict[str, Any]) -> str:
        """Submit a job and return the job ID."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self._base_url}/run",
                headers=self._headers,
                json={"input": payload},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["id"]

    async def poll_result(self, job_id: str) -> dict[str, Any]:
        """Poll until job completes or times out."""
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=30) as client:
            while time.monotonic() - start < self.timeout:
                resp = await client.get(
                    f"{self._base_url}/status/{job_id}",
                    headers=self._headers,
                )
                resp.raise_for_status()
                data = resp.json()
                status = data.get("status", "")

                if status == "COMPLETED":
                    return data.get("output", {})
                if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
                    return {
                        "error": f"Job {status}: {data.get('error', 'unknown')}",
                        "status": "failed",
                    }

                await asyncio.sleep(self.poll_interval)

        return {"error": f"Timeout after {self.timeout}s", "status": "timeout"}

    async def run_job(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Submit and poll for result (convenience method)."""
        job_id = await self.submit_job(payload)
        return await self.poll_result(job_id)

    async def generate_video(
        self,
        route: str,
        image_path: str | Path,
        case_id: str,
        place: str,
        tts_text: str,
        *,
        bgm_key: str = "bright_travel",
        motion: str = "slow_zoom_in",
        prompt: str = "",
        allow_fallback: bool = True,
    ) -> dict[str, Any]:
        """Generate a video from a travel photo."""
        image_bytes = Path(image_path).read_bytes()
        payload = {
            "route": route,
            "case_id": case_id,
            "place": place,
            "image_base64": base64.b64encode(image_bytes).decode(),
            "tts_text": tts_text,
            "bgm_key": bgm_key,
            "motion": motion,
            "prompt": prompt,
            "allow_fallback": allow_fallback,
        }
        return await self.run_job(payload)

    async def generate_tts(
        self,
        text: str,
        case_id: str = "tts",
    ) -> dict[str, Any]:
        """Generate TTS audio."""
        return await self.run_job({
            "route": "gpt_sovits_tts",
            "case_id": case_id,
            "tts_text": text,
        })

    async def generate_bgm(
        self,
        description: str = "calm Korean ambient music",
        duration: int = 15,
        case_id: str = "bgm",
    ) -> dict[str, Any]:
        """Generate MusicGen BGM."""
        return await self.run_job({
            "route": "musicgen",
            "case_id": case_id,
            "musicgen_description": description,
            "musicgen_duration": duration,
        })

    @staticmethod
    def save_artifacts(result: dict[str, Any], output_dir: Path) -> list[Path]:
        """Save base64-encoded artifacts from RunPod response to disk."""
        output_dir.mkdir(parents=True, exist_ok=True)
        saved = []
        for artifact in result.get("artifacts", []):
            data_b64 = artifact.get("data_base64")
            if not data_b64:
                continue
            kind = artifact.get("kind", "unknown")
            orig_path = Path(artifact.get("path", f"{kind}.bin"))
            out_path = output_dir / orig_path.name
            out_path.write_bytes(base64.b64decode(data_b64))
            saved.append(out_path)
        return saved
