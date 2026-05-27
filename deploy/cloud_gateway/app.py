from __future__ import annotations

import hashlib
import html
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from pydantic import BaseModel, Field

RUNPOD_API_KEY = os.environ.get("RUNPOD_API_KEY", "")
RUNPOD_ENDPOINT_ID = os.environ.get("RUNPOD_ENDPOINT_ID", "")


# STEP 0. Deployment configuration.
# In local development this defaults to the repo's report/ folder.
# In cloud deployment set KRIDE_MEDIA_DIR=/app/media or another mounted artifact path.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
MEDIA_DIR = Path(os.environ.get("KRIDE_MEDIA_DIR", PROJECT_ROOT / "report")).resolve()
APP_MODE = os.environ.get("KRIDE_APP_MODE", "preview_gateway")
MODEL_GENERATION_ENABLED = os.environ.get("KRIDE_MODEL_GENERATION_ENABLED", "false").lower() == "true"
WORKER_OUTPUT_DIR = Path(os.environ.get("KRIDE_WORKER_OUTPUT_DIR", MEDIA_DIR / "generated")).resolve()
WORKER_TIMEOUT_SECONDS = int(os.environ.get("KRIDE_WORKER_TIMEOUT_SECONDS", "1800"))


SUPPORTED_EXTENSIONS = {".mp4", ".wav", ".mp3", ".json", ".ipynb"}
WORKER_ROUTES = {
    "3d_photo_light",
    "3d_photo_inpainting_real",
    "cogvideo_fallback",
    "cogvideox_real",
    "gpt_sovits_tts",
    "animated_drawings_worker",
    "meta_animation",
}


class GenerateJobRequest(BaseModel):
    """Cloud worker request contract.

    The gateway only launches workers when KRIDE_MODEL_GENERATION_ENABLED=true.
    Heavy model dependencies remain isolated inside deploy.media_motion.
    """

    route: str = Field(..., description="One of the media-motion worker routes.")
    case_id: str = "travel_case"
    place: str = "Travel Place"
    image: str = "gangneung_beach.jpg"
    tts: str = "A short travel narration."
    bgm_key: str = "bright_travel"
    motion: str = "slow_zoom_in"
    prompt: str = ""
    source_mp4: str = "meta_combined_6.mp4"
    allow_fallback: bool = True


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^\w._-]+", "-", value, flags=re.UNICODE)
    value = re.sub(r"-+", "-", value).strip("-")
    return value or "asset"


def is_inside(child: Path, parent: Path) -> bool:
    try:
        child.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def resolve_media_relative(relative_path: str) -> Path:
    path = (MEDIA_DIR / relative_path).resolve()
    if not is_inside(path, MEDIA_DIR):
        raise HTTPException(status_code=400, detail="input path must stay inside KRIDE_MEDIA_DIR")
    return path


def classify_asset(path: Path) -> tuple[str, str, str]:
    """Return (group, title, media_type) for a discovered artifact."""
    name = path.name.lower()
    rel = str(path.relative_to(MEDIA_DIR)).replace("\\", "/").lower()

    if path.suffix.lower() == ".json":
        return "metadata", "Pipeline metadata", "application/json"
    if path.suffix.lower() == ".ipynb":
        return "notebook", "Source notebook", "application/x-ipynb+json"
    if path.suffix.lower() in {".wav", ".mp3"}:
        return "audio", "Audio asset", "audio/wav" if path.suffix.lower() == ".wav" else "audio/mpeg"

    if "final_segment_synced" in name:
        return "animated_tts_bgm", "AnimatedDrawings + TTS + BGM", "video/mp4"
    if "3d_photo_light" in rel:
        return "3d_photo_light", "3D Photo Light / real travel photo", "video/mp4"
    if "cogvideo" in rel or "cogvideo" in name:
        return "cogvideo_fallback", "CogVideoX branch fallback / real travel photo", "video/mp4"
    if "musicgen_tts_success" in name or "with_musicgen" in name:
        return "legacy_final", "Legacy final media", "video/mp4"
    if "musicgen" in name:
        return "legacy_musicgen", "Legacy animation + MusicGen", "video/mp4"
    if path.suffix.lower() == ".mp4":
        return "video", "Video asset", "video/mp4"

    return "asset", "Asset", "application/octet-stream"


def discover_assets() -> dict[str, dict[str, Any]]:
    # STEP 1. Discover artifacts recursively from MEDIA_DIR.
    assets: dict[str, dict[str, Any]] = {}
    if not MEDIA_DIR.exists():
        return assets

    for path in sorted(MEDIA_DIR.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        group, title, media_type = classify_asset(path)
        rel = path.relative_to(MEDIA_DIR).as_posix()
        digest = hashlib.sha1(rel.encode("utf-8")).hexdigest()[:10]
        asset_id = f"{slugify(path.stem)}-{digest}"
        assets[asset_id] = {
            "id": asset_id,
            "group": group,
            "title": title,
            "name": path.name,
            "relative_path": rel,
            "path": str(path),
            "exists": path.exists(),
            "size_mb": round(path.stat().st_size / 1024 / 1024, 3),
            "media_type": media_type,
            "url": f"/media/{asset_id}",
        }

    return assets


def build_manifest() -> dict[str, Any]:
    # STEP 2. Manifest is the frontend and monitoring contract.
    assets = discover_assets()
    counts: dict[str, int] = {}
    for asset in assets.values():
        counts[asset["group"]] = counts.get(asset["group"], 0) + 1

    return {
        "ok": MEDIA_DIR.exists(),
        "mode": APP_MODE,
        "model_generation_enabled": MODEL_GENERATION_ENABLED,
        "media_dir": str(MEDIA_DIR),
        "asset_count": len(assets),
        "counts": counts,
        "worker_routes": sorted(WORKER_ROUTES),
        "worker_output_dir": str(WORKER_OUTPUT_DIR),
        "assets": assets,
    }


app = FastAPI(
    title="K-Ride Track B Cloud Gateway",
    description="Cloud-ready preview gateway for generated K-Ride media artifacts.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    # STEP 3. Cloud health check. Use this in Render/Railway/Fly/zrok checks.
    manifest = build_manifest()
    return {
        "ok": manifest["ok"],
        "mode": manifest["mode"],
        "model_generation_enabled": manifest["model_generation_enabled"],
        "media_dir": manifest["media_dir"],
        "asset_count": manifest["asset_count"],
        "counts": manifest["counts"],
        "worker_routes": manifest["worker_routes"],
        "worker_output_dir": manifest["worker_output_dir"],
    }


@app.get("/manifest.json")
def manifest() -> dict[str, Any]:
    return build_manifest()


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    # STEP 4. Human preview page.
    manifest_data = build_manifest()
    cards: list[str] = []

    for asset in manifest_data["assets"].values():
        asset_name = html.escape(asset["name"])
        group = html.escape(asset["group"])
        title = html.escape(asset["title"])
        size = asset["size_mb"]
        url = asset["url"]

        if asset["media_type"].startswith("video/"):
            preview = f'<video controls preload="metadata" src="{url}"></video>'
        elif asset["media_type"].startswith("audio/"):
            preview = f'<audio controls preload="metadata" src="{url}"></audio>'
        else:
            preview = '<div class="file-box">Downloadable artifact</div>'

        cards.append(
            f"""
            <section class="card">
              <div class="group">{group}</div>
              <h2>{title}</h2>
              <p>{asset_name} &middot; {size} MB</p>
              {preview}
              <p><a href="{url}">Open / Download</a></p>
            </section>
            """
        )

    empty = "" if cards else "<p>No media assets found. Set <code>KRIDE_MEDIA_DIR</code> to the artifact directory.</p>"

    return f"""
    <!doctype html>
    <html lang="ko">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>K-Ride Track B Cloud Gateway</title>
      <style>
        :root {{ font-family: Arial, sans-serif; color-scheme: dark; background: #101114; color: #f4f4f4; }}
        body {{ margin: 0; padding: 28px; }}
        main {{ width: min(1080px, 100%); margin: 0 auto; }}
        header {{ margin-bottom: 28px; }}
        .grid {{ display: grid; grid-template-columns: 1fr; gap: 28px; }}
        .card {{ border-top: 1px solid #333842; padding-top: 22px; }}
        .group {{ color: #9ed0ff; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; }}
        h1, h2 {{ margin: 0 0 10px; }}
        p {{ color: #c8ccd5; }}
        video {{ width: 100%; max-height: 70vh; background: #000; }}
        audio {{ width: min(720px, 100%); }}
        a {{ color: #9ed0ff; }}
        code {{ color: #ffe08a; }}
        .file-box {{ padding: 24px; border: 1px solid #333842; color: #c8ccd5; }}
      </style>
    </head>
    <body>
      <main>
        <header>
          <h1>K-Ride Track B Cloud Gateway</h1>
          <p>Generated media preview. Model execution enabled: <code>{str(MODEL_GENERATION_ENABLED).lower()}</code></p>
          <p><a href="/health">Health</a> &middot; <a href="/manifest.json">Manifest</a></p>
          <p><code>{html.escape(str(MEDIA_DIR))}</code></p>
        </header>
        {empty}
        <div class="grid">{''.join(cards)}</div>
      </main>
    </body>
    </html>
    """


@app.get("/media/{asset_id}")
def media(asset_id: str) -> FileResponse:
    # STEP 5. Serve only discovered assets, preventing arbitrary path reads.
    assets = discover_assets()
    asset = assets.get(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"unknown asset: {asset_id}")

    path = Path(asset["path"]).resolve()
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"file missing: {path}")
    if not is_inside(path, MEDIA_DIR):
        raise HTTPException(status_code=403, detail="path outside media directory")

    return FileResponse(str(path), media_type=asset["media_type"], filename=path.name)


class RunPodJobRequest(BaseModel):
    """RunPod serverless proxy request."""
    route: str = Field(..., description="cogvideox_real, 3d_photo_light, cogvideo_fallback, gpt_sovits_tts, musicgen")
    case_id: str = "travel_case"
    place: str = "Travel Place"
    image_base64: str = ""
    tts_text: str = "여행 영상입니다."
    bgm_key: str = "bright_travel"
    motion: str = "slow_zoom_in"
    prompt: str = ""
    allow_fallback: bool = True
    musicgen_description: str = "calm Korean ambient music"
    musicgen_duration: int = 15


@app.post("/jobs/runpod")
def runpod_proxy(request: RunPodJobRequest) -> JSONResponse:
    """Proxy job to RunPod Serverless endpoint."""
    if not RUNPOD_API_KEY or not RUNPOD_ENDPOINT_ID:
        return JSONResponse(
            status_code=501,
            content={"ok": False, "message": "RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are required."},
        )

    import httpx

    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}", "Content-Type": "application/json"}
    payload = {"input": request.model_dump()}
    url = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run"

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        return JSONResponse(content={"ok": True, **resp.json()})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})


@app.get("/jobs/runpod/{job_id}")
def runpod_status(job_id: str) -> JSONResponse:
    """Check RunPod job status."""
    if not RUNPOD_API_KEY or not RUNPOD_ENDPOINT_ID:
        return JSONResponse(status_code=501, content={"ok": False, "message": "RunPod not configured."})

    import httpx

    headers = {"Authorization": f"Bearer {RUNPOD_API_KEY}"}
    url = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/status/{job_id}"

    try:
        resp = httpx.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        return JSONResponse(content={"ok": True, **resp.json()})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(exc)[:2000]})


@app.post("/jobs/generate")
def generate_job(request: GenerateJobRequest) -> JSONResponse:
    # STEP 6. Optional cloud worker endpoint.
    # Keep disabled for pure preview deployments. Enable only on GPU/worker hosts.
    if not MODEL_GENERATION_ENABLED:
        return JSONResponse(
            status_code=501,
            content={
                "ok": False,
                "message": "Model generation is disabled in this gateway.",
                "enable_with": "KRIDE_MODEL_GENERATION_ENABLED=true",
                "worker_package": "deploy.media_motion",
            },
        )

    if request.route not in WORKER_ROUTES:
        raise HTTPException(status_code=400, detail=f"unsupported route: {request.route}")

    if request.route == "meta_animation":
        resolve_media_relative(request.source_mp4)
    elif request.route != "gpt_sovits_tts":
        resolve_media_relative(request.image)

    WORKER_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        "-m",
        "deploy.media_motion.run_cases",
        "--route",
        request.route,
        "--input-dir",
        str(MEDIA_DIR),
        "--output-dir",
        str(WORKER_OUTPUT_DIR),
        "--case-id",
        request.case_id,
        "--place",
        request.place,
        "--image",
        request.image,
        "--tts",
        request.tts,
        "--bgm-key",
        request.bgm_key,
        "--motion",
        request.motion,
        "--prompt",
        request.prompt,
        "--source-mp4",
        request.source_mp4,
    ]
    if not request.allow_fallback:
        command.append("--no-allow-fallback")

    env = os.environ.copy()
    env["PYTHONPATH"] = f"{PROJECT_ROOT}{os.pathsep}{env.get('PYTHONPATH', '')}"

    result = subprocess.run(
        command,
        cwd=str(PROJECT_ROOT),
        env=env,
        capture_output=True,
        text=True,
        timeout=WORKER_TIMEOUT_SECONDS,
    )
    result_json = WORKER_OUTPUT_DIR / f"{request.case_id}_{request.route}_result.json"

    if result.returncode != 0:
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "command": command,
                "stdout_tail": (result.stdout or "")[-4000:],
                "stderr_tail": (result.stderr or "")[-4000:],
            },
        )

    payload: dict[str, Any] = {
        "ok": True,
        "command": command,
        "worker_output_dir": str(WORKER_OUTPUT_DIR),
        "stdout_tail": (result.stdout or "")[-4000:],
        "stderr_tail": (result.stderr or "")[-4000:],
    }
    if result_json.exists():
        payload["result_json"] = str(result_json)
        payload["result"] = json.loads(result_json.read_text(encoding="utf-8"))

    return JSONResponse(content=payload)
