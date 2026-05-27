# K-Ride Cloud Gateway

This package is the cloud-ready FastAPI gateway for K-Ride Track B media artifacts.

It serves generated files only. It does not run CogVideoX, GPT-SoVITS, MusicGen, AnimatedDrawings, or 3D Photo Inpainting.

## What It Serves

The app recursively discovers these file types from `KRIDE_MEDIA_DIR`:

```text
.mp4   preview videos
.wav   TTS / BGM audio
.mp3   TTS / BGM audio
.json  route/summary metadata
.ipynb source notebooks
```

## API

```text
GET  /
GET  /health
GET  /manifest.json
GET  /media/{asset_id}
POST /jobs/generate   # optional worker launch when KRIDE_MODEL_GENERATION_ENABLED=true
```

## Local Run

```powershell
cd D:\kride-project
.\.venv\Scripts\python.exe -m pip install -r deploy\cloud_gateway\requirements.txt
$env:KRIDE_MEDIA_DIR="D:\kride-project\report"
.\.venv\Scripts\python.exe -m uvicorn deploy.cloud_gateway.app:app --host 0.0.0.0 --port 7860
```

Open:

```text
http://127.0.0.1:7860/
http://127.0.0.1:7860/health
http://127.0.0.1:7860/manifest.json
```

## zrok Preview

Keep the FastAPI server running in terminal 1.

In terminal 2:

```bash
zrok enable <ACCOUNT_TOKEN>
zrok share public http://127.0.0.1:7860 --headless
```

Use the printed `https://...shares.zrok.io` URL while the zrok process is alive.

## Docker

Prepare a deployable media folder from `report/`:

```powershell
.\deploy\cloud_gateway\prepare_media_from_report.ps1
```

or on Linux/macOS:

```bash
bash deploy/cloud_gateway/prepare_media_from_report.sh
```

Build from the repository root:

```bash
docker build -f deploy/cloud_gateway/Dockerfile -t kride-cloud-gateway .
```

Run with a mounted media folder:

```bash
docker run --rm -p 7860:7860 \
  -e KRIDE_MEDIA_DIR=/app/media \
  -v /absolute/path/to/media:/app/media \
  kride-cloud-gateway
```

To bake media into the image for a small demo, first run the prepare script and then build:

```bash
docker build -f deploy/cloud_gateway/Dockerfile.with-media -t kride-cloud-gateway-with-media .
docker run --rm -p 7860:7860 kride-cloud-gateway-with-media
```

## Render / Railway / RunPod

Use:

```text
Build command: pip install -r deploy/cloud_gateway/requirements.txt
Start command: uvicorn deploy.cloud_gateway.app:app --host 0.0.0.0 --port $PORT
```

Environment:

```text
KRIDE_MEDIA_DIR=/path/to/media
KRIDE_APP_MODE=cloud_preview_gateway
KRIDE_MODEL_GENERATION_ENABLED=false
```

For a small demo, commit the MP4/WAV artifacts into a deployable media folder. For larger media, mount a volume or download artifacts at startup from object storage/DagsHub.

Note: the repository root `.dockerignore` excludes `report/`, so Docker images should use a mounted media folder or a prepared folder such as `deploy/cloud_gateway/media`.

## DagsHub Logging

Install the logging dependencies in a separate clean environment:

```bash
pip install -r deploy/cloud_gateway/requirements-logging.txt
```

Then:

```bash
export MLFLOW_TRACKING_USERNAME=myelin24m
export MLFLOW_TRACKING_PASSWORD=<DAGSHUB_TOKEN>
export DAGSHUB_USER_TOKEN=<DAGSHUB_TOKEN>
python deploy/cloud_gateway/log_gateway_to_mlflow.py --public-url https://YOUR-URL
```

## Media-Motion Worker Code

The generation-side code is kept separate from this preview gateway:

```text
deploy/media_motion/
```

Use that package for local, Colab, or GPU-worker generation:

```text
cogvideox_real             real photo -> CogVideoX -> TTS/BGM mix
3d_photo_inpainting_real   real photo -> full external 3D Photo command -> TTS/BGM mix
gpt_sovits_tts             Korean TTS through isolated GPT-SoVITS subprocess
animated_drawings_worker   AnimatedDrawings runtime -> MP4 -> TTS/BGM mix
3d_photo_light             stable static-photo fallback
cogvideo_fallback          explicit CogVideoX fallback
meta_animation             register/copy existing AnimatedDrawings/meta-animation MP4
```

This gateway should continue to run with `KRIDE_MODEL_GENERATION_ENABLED=false` for preview-only hosting. Set it to `true` only on a worker-capable host.

Worker launch endpoint:

```text
POST /jobs/generate
```

Minimal body:

```json
{
  "route": "3d_photo_light",
  "case_id": "gangneung_beach",
  "place": "Gangneung Beach",
  "image": "gangneung_beach.jpg",
  "tts": "A bright travel narration for Gangneung Beach.",
  "allow_fallback": true
}
```

## Deployment Progress Checklist

- [ ] Prepare media folder with MP4/WAV/JSON/IPYNB files.
- [ ] Start FastAPI gateway.
- [ ] Confirm `/health` returns `ok: true`.
- [ ] Confirm `/manifest.json` lists expected assets.
- [ ] Open `/` and play at least one video from each group.
- [ ] Open zrok share if doing temporary preview.
- [ ] Log gateway manifest and public URL to DagsHub.
- [ ] Keep model workers separate until cloud GPU runtime is chosen.
