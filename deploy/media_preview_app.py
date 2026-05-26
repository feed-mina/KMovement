from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MEDIA_DIR = Path(os.environ.get("KRIDE_MEDIA_DIR", PROJECT_ROOT / "report")).resolve()

VIDEO_ASSETS = {
    "animation": {
        "title": "Animation",
        "file": "meta_combined_6.mp4",
        "description": "Six sequential doodle animations.",
    },
    "animation-bgm": {
        "title": "Animation + MusicGen",
        "file": "meta_combined_6_Musicgen.mp4",
        "description": "Sequential animation mixed with MusicGen BGM.",
    },
    "full": {
        "title": "Animation + MusicGen + TTS",
        "file": "meta_combined_6_Musicgen_tts_success.mp4",
        "description": "Final static demo with animation, BGM, and synced TTS.",
    },
}

TTS_ASSETS = {
    str(i): {
        "title": f"TTS sample {i}",
        "file": f"tts_torchaudito_{i}.wav",
    }
    for i in range(1, 6)
}

NOTEBOOK_FILE = "finally-deploy-yerin.ipynb"


def _asset_path(filename: str) -> Path:
    return (MEDIA_DIR / filename).resolve()


def _file_info(path: Path) -> dict[str, Any]:
    exists = path.exists()
    return {
        "path": str(path),
        "exists": exists,
        "size_mb": round(path.stat().st_size / 1024 / 1024, 3) if exists else 0,
    }


def build_manifest() -> dict[str, Any]:
    videos = {
        key: {
            **meta,
            **_file_info(_asset_path(meta["file"])),
            "url": f"/video/{key}",
        }
        for key, meta in VIDEO_ASSETS.items()
    }
    tts_samples = {
        key: {
            **meta,
            **_file_info(_asset_path(meta["file"])),
            "url": f"/audio/tts/{key}",
        }
        for key, meta in TTS_ASSETS.items()
    }
    notebook = _file_info(_asset_path(NOTEBOOK_FILE))
    notebook["url"] = "/notebook"

    return {
        "mode": "static-demo",
        "modeling_enabled": False,
        "media_dir": str(MEDIA_DIR),
        "videos": videos,
        "tts_samples": tts_samples,
        "notebook": notebook,
    }


def require_existing(path: Path, label: str) -> Path:
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{label} not found: {path}")
    return path


app = FastAPI(
    title="K-Ride Media Preview",
    description="Model-less static media preview for the K-Ride deployment path.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, Any]:
    manifest = build_manifest()
    required = [
        *manifest["videos"].values(),
        *manifest["tts_samples"].values(),
        manifest["notebook"],
    ]
    missing = [item["path"] for item in required if not item["exists"]]
    return {
        "ok": len(missing) == 0,
        "mode": "static-demo",
        "modeling_enabled": False,
        "media_dir": str(MEDIA_DIR),
        "missing": missing,
    }


@app.get("/manifest.json")
def manifest() -> dict[str, Any]:
    return build_manifest()


@app.get("/", response_class=HTMLResponse)
def index() -> str:
    manifest_data = build_manifest()
    video_blocks = []
    for key, asset in manifest_data["videos"].items():
        status = "ready" if asset["exists"] else "missing"
        video_blocks.append(
            f"""
            <section>
              <h2>{asset["title"]}</h2>
              <p>{asset["description"]} <span class="status">{status}</span></p>
              <video src="/video/{key}" controls preload="metadata"></video>
              <p><a href="/video/{key}">Open file</a></p>
            </section>
            """
        )

    audio_blocks = []
    for key, asset in manifest_data["tts_samples"].items():
        status = "ready" if asset["exists"] else "missing"
        audio_blocks.append(
            f"""
            <li>
              <span>{asset["title"]}</span>
              <span class="status">{status}</span>
              <audio src="/audio/tts/{key}" controls preload="metadata"></audio>
            </li>
            """
        )

    return f"""
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>K-Ride Media Preview</title>
      <style>
        :root {{
          color-scheme: dark;
          font-family: Arial, sans-serif;
          background: #111;
          color: #f5f5f5;
        }}
        body {{
          margin: 0;
          padding: 32px;
        }}
        main {{
          width: min(980px, 100%);
          margin: 0 auto;
        }}
        header {{
          margin-bottom: 28px;
        }}
        section {{
          margin: 28px 0 40px;
          border-top: 1px solid #333;
          padding-top: 24px;
        }}
        video {{
          width: 100%;
          max-height: 72vh;
          background: #000;
        }}
        audio {{
          width: min(520px, 100%);
          vertical-align: middle;
          margin-left: 12px;
        }}
        li {{
          margin: 14px 0;
        }}
        a {{
          color: #8fd3ff;
        }}
        .status {{
          display: inline-block;
          margin-left: 8px;
          color: #9ee37d;
          font-size: 0.9em;
        }}
        code {{
          color: #f9d36a;
        }}
      </style>
    </head>
    <body>
      <main>
        <header>
          <h1>K-Ride Media Preview</h1>
          <p>Static demo mode. Model generation is disabled.</p>
          <p><a href="/health">Health</a> · <a href="/manifest.json">Manifest</a> · <a href="/notebook">Notebook</a></p>
          <p><code>{MEDIA_DIR}</code></p>
        </header>
        {''.join(video_blocks)}
        <section>
          <h2>TTS Samples</h2>
          <ul>{''.join(audio_blocks)}</ul>
        </section>
      </main>
    </body>
    </html>
    """


@app.get("/video/{asset_key}")
def video(asset_key: str) -> FileResponse:
    asset = VIDEO_ASSETS.get(asset_key)
    if not asset:
        raise HTTPException(status_code=404, detail=f"unknown video asset: {asset_key}")
    path = require_existing(_asset_path(asset["file"]), asset["file"])
    return FileResponse(str(path), media_type="video/mp4", filename=path.name)


@app.get("/audio/tts/{index}")
def tts(index: str) -> FileResponse:
    asset = TTS_ASSETS.get(index)
    if not asset:
        raise HTTPException(status_code=404, detail=f"unknown TTS sample: {index}")
    path = require_existing(_asset_path(asset["file"]), asset["file"])
    return FileResponse(str(path), media_type="audio/wav", filename=path.name)


@app.get("/notebook")
def notebook() -> FileResponse:
    path = require_existing(_asset_path(NOTEBOOK_FILE), NOTEBOOK_FILE)
    return FileResponse(
        str(path),
        media_type="application/x-ipynb+json",
        filename=path.name,
    )
