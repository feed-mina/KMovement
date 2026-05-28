# Colab D: FastAPI + zrok Preview/Gateway

이 문서는 Colab 또는 클라우드 GPU 런타임에서 K-Ride Track B 결과물을 보여주고, 필요한 경우 worker를 실행하는 절차입니다.

## 목표

- Drive 또는 mounted media 폴더의 MP4/WAV/JSON/IPYNB를 FastAPI로 preview
- zrok으로 임시 HTTPS URL 공개
- `KRIDE_MODEL_GENERATION_ENABLED=true`일 때만 `/jobs/generate`에서 worker 실행
- DagsHub/MLflow에는 gateway manifest 또는 worker result JSON을 기록

## 1. 기본 설치

```python
from google.colab import drive, userdata
from pathlib import Path
import os, subprocess

drive.mount("/content/drive")

ROOT = Path("/content/drive/MyDrive/kride-track-b")
REPO = Path("/content/kride-project")

print("ROOT:", ROOT)
print("REPO:", REPO)
```

```bash
git clone <YOUR_GITHUB_REPO_URL> /content/kride-project
cd /content/kride-project
pip install -r deploy/cloud_gateway/requirements.txt
pip install -r deploy/media_motion/requirements.txt
```

## 2. Preview Gateway 실행

```python
import os, subprocess, time, requests
from pathlib import Path

REPO = Path("/content/kride-project")
ROOT = Path("/content/drive/MyDrive/kride-track-b")

os.environ["KRIDE_MEDIA_DIR"] = str(ROOT)
os.environ["KRIDE_MODEL_GENERATION_ENABLED"] = "false"
os.environ["KRIDE_WORKER_OUTPUT_DIR"] = str(ROOT / "generated")

server = subprocess.Popen(
    [
        "python", "-m", "uvicorn",
        "deploy.cloud_gateway.app:app",
        "--host", "0.0.0.0",
        "--port", "7860",
    ],
    cwd=str(REPO),
)

time.sleep(5)
print(requests.get("http://127.0.0.1:7860/health").json())
```

## 3. zrok 공개

```python
from google.colab import userdata
import subprocess, time, re
from pathlib import Path

ZROK_TOKEN = userdata.get("ZROK_TOKEN")

subprocess.run(["zrok", "enable", ZROK_TOKEN], check=False)

log_path = Path("/content/zrok_share.log")
share = subprocess.Popen(
    ["zrok", "share", "public", "http://127.0.0.1:7860", "--headless"],
    stdout=open(log_path, "w"),
    stderr=subprocess.STDOUT,
    text=True,
)

time.sleep(10)
log = log_path.read_text(errors="ignore")
print(log[-3000:])

matches = re.findall(r"([a-zA-Z0-9.-]+\.shares\.zrok\.io)", log)
public_url = "https://" + matches[-1] if matches else ""
print("public_url:", public_url)
```

## 4. Worker 실행 켜기

Preview만 할 때는 끄고, GPU/worker 런타임에서만 켭니다.

```python
os.environ["KRIDE_MODEL_GENERATION_ENABLED"] = "true"
```

### 3D Photo Light

```python
import requests

payload = {
    "route": "3d_photo_light",
    "case_id": "gangneung_beach",
    "place": "Gangneung Beach",
    "image": "gangneung_beach.jpg",
    "tts": "A bright travel narration for Gangneung Beach.",
    "bgm_key": "bright_travel",
    "allow_fallback": True,
}

print(requests.post("http://127.0.0.1:7860/jobs/generate", json=payload).json())
```

### CogVideoX Real

CogVideoX는 CUDA/PyTorch/diffusers가 맞는 GPU 런타임에서만 실행합니다.

```bash
pip install -r deploy/media_motion/requirements-cogvideox.txt
```

```python
payload = {
    "route": "cogvideox_real",
    "case_id": "gwanghwamun",
    "place": "Gwanghwamun",
    "image": "gwanghwamun.jpg",
    "tts": "A cinematic travel narration for Gwanghwamun.",
    "bgm_key": "cinematic_memory",
    "prompt": "A cinematic AI-generated travel video from a real photo of Gwanghwamun.",
    "allow_fallback": True,
}

print(requests.post("http://127.0.0.1:7860/jobs/generate", json=payload).json())
```

## 5. DagsHub 기록

Gateway 상태 기록:

```bash
pip install -r deploy/cloud_gateway/requirements-logging.txt

export MLFLOW_TRACKING_USERNAME=myelin24m
export MLFLOW_TRACKING_PASSWORD=<DAGSHUB_TOKEN>
export MLFLOW_TRACKING_URI=https://dagshub.com/myelin24m/Kride.mlflow

python deploy/cloud_gateway/log_gateway_to_mlflow.py --public-url https://YOUR-ZROK-URL
```

Worker 결과 기록:

```bash
pip install -r deploy/media_motion/requirements-logging.txt

python -m deploy.media_motion.log_result_to_mlflow \
  --result-json /content/drive/MyDrive/kride-track-b/generated/gwanghwamun_cogvideox_real_result.json \
  --experiment track-b-media-motion-workers
```

## 단계별 진행도

- STEP 1: Drive 또는 cloud volume에 media/input 준비
- STEP 2: FastAPI gateway 실행
- STEP 3: `/health`, `/manifest.json` 확인
- STEP 4: zrok share로 URL 공개
- STEP 5: preview-only면 여기서 종료
- STEP 6: GPU worker에서만 `KRIDE_MODEL_GENERATION_ENABLED=true`
- STEP 7: `/jobs/generate`로 route 실행
- STEP 8: worker result JSON과 artifacts를 DagsHub에 기록
