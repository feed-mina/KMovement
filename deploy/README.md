# K-Ride Model-Less Media Preview Deployment

This deployment serves the already generated K-Ride media artifacts from `report/`.
It does not run AnimatedDrawings, GPT-SoVITS, MusicGen, CogVideoX, TorchServe, or any GPU model.

## Assets

Expected local files:

```text
report/finally-deploy-yerin.ipynb
report/meta_combined_6.mp4
report/meta_combined_6_Musicgen.mp4
report/meta_combined_6_Musicgen_tts_success.mp4
report/tts_torchaudito_1.wav
report/tts_torchaudito_2.wav
report/tts_torchaudito_3.wav
report/tts_torchaudito_4.wav
report/tts_torchaudito_5.wav
```

## Local Run

```powershell
cd D:\kride-project
py -m venv .venv-preview
.\.venv-preview\Scripts\Activate.ps1
pip install -r deploy\requirements-media-preview.txt
$env:KRIDE_MEDIA_DIR="D:\kride-project\report"
uvicorn deploy.media_preview_app:app --host 0.0.0.0 --port 7860
```

Open:

```text
http://127.0.0.1:7860/
http://127.0.0.1:7860/health
http://127.0.0.1:7860/manifest.json
```

## zrok Share

In another terminal:

```powershell
zrok enable <ACCOUNT_TOKEN>
zrok share public http://127.0.0.1:7860 --headless
```

Copy the printed zrok URL.

## Log Deployment To DagsHub

Set token in the terminal, then log the deployment:

```powershell
$env:MLFLOW_TRACKING_USERNAME="myelin24m"
$env:MLFLOW_TRACKING_PASSWORD="<DAGSHUB_TOKEN>"
$env:DAGSHUB_USER_TOKEN="<DAGSHUB_TOKEN>"
python deploy\log_media_preview_to_mlflow.py --public-url "https://YOUR-ZROK-URL.shares.zrok.io"
```

## Later Model Attachment

Keep this API stable. Add model workers behind new job endpoints later:

```text
POST /jobs/animation
POST /jobs/tts
POST /jobs/final-video
GET  /jobs/{job_id}
GET  /jobs/{job_id}/download
```

The frontend should read `/manifest.json` now, then switch from static URLs to job result URLs when model generation is enabled.
