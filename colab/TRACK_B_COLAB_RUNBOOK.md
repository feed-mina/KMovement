# K-Ride Track B Colab Runbook

이 문서는 Kaggle GPU가 막힌 상황에서 Colab으로 `사진 -> 라우팅 -> CogVideoX 또는 3D animation -> TTS -> MusicGen -> MP4` 흐름을 다시 연습하고, 배포에 필요한 소스와 모델 산출물을 뽑기 위한 실행 순서입니다.

## 0. Colab 운영 원칙

- 한 런타임에 모든 모델을 섞지 않습니다.
- Google Drive를 산출물 저장소로 사용합니다.
- DagsHub/MLflow에는 각 단계의 입력, 출력, 실패 원인, 최종 MP4를 기록합니다.
- zrok은 서버를 영구 배포하는 도구가 아니라, 현재 실행 중인 Colab 서버를 임시 HTTPS URL로 공개하는 터널입니다.

권장 노트북 분리:

```text
Colab A: AnimatedDrawings / 3D animation
Colab B: GPT-SoVITS TTS + MusicGen + FFmpeg mux
Colab C: CogVideoX standalone
Colab D: FastAPI + zrok preview/gateway
```

Colab에서 GPU를 쓰려면 `Runtime -> Change runtime type -> Hardware accelerator -> GPU`로 설정합니다. GPU 종류와 사용 가능 여부는 계정/시간/요금제에 따라 달라질 수 있으므로, 첫 셀에서 반드시 `nvidia-smi`로 확인합니다.

## 1. 공통 시작 셀

모든 Colab 노트북 맨 위에 둡니다.

```python
from google.colab import drive, userdata
from pathlib import Path
import os, subprocess, json, time

drive.mount("/content/drive")

PROJECT_ROOT = Path("/content/drive/MyDrive/kride-track-b")
PROJECT_ROOT.mkdir(parents=True, exist_ok=True)

WORK = Path("/content/kride_work")
WORK.mkdir(parents=True, exist_ok=True)

print("PROJECT_ROOT:", PROJECT_ROOT)
print("WORK:", WORK)
subprocess.run(["bash", "-lc", "nvidia-smi || true"], check=False)
```

Colab Secrets에 아래 이름을 등록합니다.

```text
DAGSHUB_TOKEN
ZROK_TOKEN
HF_TOKEN        # CogVideoX 등 HuggingFace 인증이 필요한 경우
```

DagsHub 공통 설정:

```python
import os
from google.colab import userdata

DAGSHUB_USERNAME = "myelin24m"
DAGSHUB_REPO = "Kride"
DAGSHUB_TOKEN = userdata.get("DAGSHUB_TOKEN")

os.environ["DAGSHUB_USER"] = DAGSHUB_USERNAME
os.environ["DAGSHUB_REPO"] = DAGSHUB_REPO
os.environ["DAGSHUB_TOKEN"] = DAGSHUB_TOKEN
os.environ["MLFLOW_TRACKING_USERNAME"] = DAGSHUB_USERNAME
os.environ["MLFLOW_TRACKING_PASSWORD"] = DAGSHUB_TOKEN
os.environ["MLFLOW_TRACKING_URI"] = f"https://dagshub.com/{DAGSHUB_USERNAME}/{DAGSHUB_REPO}.mlflow"

print("MLflow URI:", os.environ["MLFLOW_TRACKING_URI"])
```

## 2. Colab A: AnimatedDrawings / 3D Animation

목표:

```text
input image or prepared character -> animation GIFs -> combined_sequential.mp4
```

시스템 패키지:

```python
!apt-get update -qq
!apt-get install -y -qq ffmpeg git curl libosmesa6 libosmesa6-dev freeglut3-dev libglfw3-dev
```

AnimatedDrawings 소스:

```python
from pathlib import Path
import os

WORK_DIR = Path("/content/kride_work/AnimatedDrawings")

if not WORK_DIR.exists():
    !git clone https://github.com/facebookresearch/AnimatedDrawings.git /content/kride_work/AnimatedDrawings

anno = WORK_DIR / "examples" / "annotations_to_animation.py"
src = anno.read_text()
if "'view': {'USE_MESA': True" not in src and '"view": {"USE_MESA": True' not in src:
    src = src.replace(
        "'controller': {",
        "'view': {'USE_MESA': True},\n        'controller': {",
        1,
    )
    anno.write_text(src)
    print("USE_MESA patch 완료")
```

Python 3.8 분리 환경:

```python
from pathlib import Path
import os

CONDA_DIR = "/content/miniconda"
ENV_DIR = f"{CONDA_DIR}/envs/ad_env"
PYTHON_EXE = f"{ENV_DIR}/bin/python"
PIP_EXE = f"{ENV_DIR}/bin/pip"
TORCHSERVE = f"{ENV_DIR}/bin/torchserve"

if not Path(CONDA_DIR).exists():
    %cd /content
    !wget -q https://repo.anaconda.com/miniconda/Miniconda3-py38_23.11.0-2-Linux-x86_64.sh
    !bash Miniconda3-py38_23.11.0-2-Linux-x86_64.sh -b -p /content/miniconda

if not Path(ENV_DIR).exists():
    !/content/miniconda/bin/conda create -n ad_env python=3.8 -y

print("python exists:", Path(PYTHON_EXE).exists())
```

AnimatedDrawings 의존성:

```python
! /content/miniconda/envs/ad_env/bin/pip install --upgrade pip setuptools==65.5.0 wheel six --quiet
! /content/miniconda/envs/ad_env/bin/pip install chumpy --no-build-isolation --quiet
! /content/miniconda/envs/ad_env/bin/pip install torch==1.13.1+cu116 torchvision==0.14.1+cu116 torchaudio==0.13.1 --extra-index-url https://download.pytorch.org/whl/cu116 --quiet
! /content/miniconda/envs/ad_env/bin/pip install mmcv-full==1.7.0 -f https://download.openmmlab.com/mmcv/dist/cu116/torch1.13.0/index.html --quiet
! /content/miniconda/envs/ad_env/bin/pip install mmdet==2.28.2 mmpose==0.28.1 --quiet
! /content/miniconda/envs/ad_env/bin/pip install torchserve==0.8.0 torch-model-archiver==0.8.0 --quiet
! /content/miniconda/envs/ad_env/bin/pip install scikit-image scikit-learn PyOpenGL==3.1.7 PyOpenGL-accelerate imageio imageio-ffmpeg shapely pillow pyyaml requests mlflow dagshub tqdm matplotlib opencv-python-headless --quiet
```

결과물은 다음 경로로 복사합니다.

```python
from pathlib import Path
import shutil

SRC = Path("/content/kride_work/six_doodle_actions_fallback/combined_sequential.mp4")
DST = Path("/content/drive/MyDrive/kride-track-b/combined_sequential.mp4")

if SRC.exists():
    shutil.copy2(SRC, DST)
    print("saved:", DST)
else:
    print("missing:", SRC)
```

## 3. Colab B: GPT-SoVITS TTS + MusicGen + FFmpeg

목표:

```text
combined_sequential.mp4 + 5 TTS clips + MusicGen BGM -> animation_musicgen_tts_segment_synced.mp4
```

의존성 설치:

```python
!apt-get update -y
!apt-get install -y ffmpeg git curl mecab libmecab-dev mecab-ipadic-utf8 --quiet

!pip install -q --no-cache-dir \
  mlflow dagshub fastapi uvicorn \
  pillow imageio imageio-ffmpeg \
  soundfile scipy requests gTTS

!pip install -q --no-cache-dir \
  gradio typer click \
  split_lang x_transformers pytorch_lightning \
  cn2an pypinyin jieba_fast \
  mecab-python3 python-mecab-ko mecab-ko-dic \
  g2pk2 ko_pron fast_langdetect wordsegment g2p_en konlpy

!pip install -q --no-cache-dir setuptools==65.5.0 wheel six
!pip install -q --no-cache-dir chumpy --no-build-isolation --no-deps

!pip install -q --no-cache-dir --force-reinstall \
  numpy==1.26.4 pandas==2.1.4 fsspec==2025.3.0

!pip install -q --no-cache-dir --force-reinstall \
  "peft==0.11.1" \
  "accelerate==0.33.0" \
  "huggingface_hub==0.23.5" \
  "transformers==4.46.3" \
  "tokenizers==0.20.3" \
  "click==8.1.7" \
  "typer==0.12.5"
```

Python 3.12 / torchvision / torchcodec 회피 패치:

```python
import os
os.environ["TRANSFORMERS_NO_TORCHVISION"] = "1"
os.environ["TRANSFORMERS_NO_IMAGE_PROCESSING"] = "1"

import pkgutil, importlib.machinery

if not hasattr(pkgutil, "ImpImporter"):
    pkgutil.ImpImporter = type("ImpImporter", (), {})

if not hasattr(importlib.machinery.FileFinder, "find_module"):
    def _find_module(self, fullname, path=None):
        spec = self.find_spec(fullname)
        return spec.loader if spec else None
    importlib.machinery.FileFinder.find_module = _find_module
```

`inference_webui` import 직후에는 반드시 `torchaudio.load`를 `soundfile` 기반으로 바꿉니다.

```python
import torch
import soundfile as sf
import torchaudio

def safe_torchaudio_load(filename, *args, **kwargs):
    audio, sr = sf.read(filename, always_2d=True)
    audio = torch.from_numpy(audio.T).float()
    return audio, sr

torchaudio.load = safe_torchaudio_load
```

최종 저장 경로:

```text
/content/drive/MyDrive/kride-track-b/final_tts_01.wav
/content/drive/MyDrive/kride-track-b/final_tts_02.wav
/content/drive/MyDrive/kride-track-b/final_tts_03.wav
/content/drive/MyDrive/kride-track-b/final_tts_04.wav
/content/drive/MyDrive/kride-track-b/final_tts_05.wav
/content/drive/MyDrive/kride-track-b/musicgen_travel_bgm.wav
/content/drive/MyDrive/kride-track-b/animation_musicgen_tts_segment_synced.mp4
```

## 4. Colab C: CogVideoX Standalone

목표:

```text
photo + prompt -> cogvideox_result.mp4
```

이 노트북은 Colab B와 같은 런타임에서 이어서 실행하지 않습니다. 새 런타임에서 시작합니다.

```python
!apt-get update -y
!apt-get install -y ffmpeg git curl --quiet

!pip install -q --no-cache-dir -U \
  diffusers accelerate transformers huggingface_hub \
  pillow imageio imageio-ffmpeg requests mlflow dagshub
```

라우팅 기준:

```python
def route_video_model(caption: str) -> str:
    dynamic_keywords = [
        "person", "people", "man", "woman", "girl", "boy", "child",
        "crowd", "dog", "cat", "animal", "character", "doodle"
    ]
    text = caption.lower()
    return "cogvideox" if any(word in text for word in dynamic_keywords) else "3d_animation"
```

CogVideoX 메모리 절약 기본값:

```python
pipe.enable_sequential_cpu_offload()
pipe.vae.enable_slicing()
pipe.vae.enable_tiling()
```

처음 검증은 작은 설정부터 시작합니다.

```text
num_inference_steps=10
guidance_scale=5.0
fps=8
short duration
```

출력:

```text
/content/drive/MyDrive/kride-track-b/cogvideox_result.mp4
```

## 5. Colab D: FastAPI + zrok Preview

목표:

```text
Drive에 저장된 MP4를 FastAPI로 노출하고 zrok public URL 생성
```

실행용 상세 셀은 별도 문서에 정리했습니다.

```text
colab/COLAB_D_FASTAPI_ZROK_GATEWAY.md
```

설치:

```python
!pip install -q --no-cache-dir fastapi uvicorn mlflow dagshub requests
```

zrok 설치:

```python
import os, json, urllib.request, subprocess, shutil
from pathlib import Path

WORK = Path("/content/kride_work")
ZROK_BIN = WORK / "zrok2"

if not ZROK_BIN.exists():
    meta = json.load(urllib.request.urlopen("https://api.github.com/repos/openziti/zrok/releases/latest"))
    tag = meta["tag_name"]
    version = tag.lstrip("v")
    url = f"https://github.com/openziti/zrok/releases/download/{tag}/zrok_{version}_linux_amd64.tar.gz"

    tgz = WORK / "zrok.tgz"
    subprocess.run(["curl", "-L", url, "-o", str(tgz)], check=True)

    extract_dir = WORK / "zrok_extract"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)

    subprocess.run(["tar", "-xzf", str(tgz), "-C", str(extract_dir)], check=True)

    candidates = [x for x in extract_dir.rglob("*") if x.is_file() and x.name in ("zrok", "zrok2")]
    if not candidates:
        raise FileNotFoundError("zrok 실행 파일을 찾지 못했습니다.")

    shutil.copy(candidates[0], ZROK_BIN)
    os.chmod(ZROK_BIN, 0o755)

subprocess.run([str(ZROK_BIN), "version"], check=False)
```

zrok enable:

```python
from google.colab import userdata
import subprocess

ZROK_TOKEN = userdata.get("ZROK_TOKEN")
subprocess.run([str(ZROK_BIN), "enable", ZROK_TOKEN], check=False)
```

FastAPI 앱은 모델을 직접 올리지 않고 결과 MP4만 먼저 서빙합니다. 이후 최종 배포에서는 `/generate`가 각 worker를 subprocess로 호출하게 확장합니다.

## 6. 최종 산출물 체크리스트

- `combined_sequential.mp4`
- `final_tts_01.wav` ~ `final_tts_05.wav`
- `musicgen_travel_bgm.wav`
- `animation_musicgen_tts_segment_synced.mp4`
- `cogvideox_result.mp4`
- `render_summary.json`
- `.mar` files:
  - `drawn_humanoid_detector.mar`
  - `drawn_humanoid_pose_estimator.mar`
- FastAPI source
- zrok public URL
- DagsHub MLflow run URL

## 7. 중요한 주의점

- Colab 런타임이 끊기면 `/content` 파일은 사라집니다. 중요한 결과는 즉시 Drive로 복사합니다.
- zrok URL은 `zrok share` 프로세스가 살아 있을 때만 유효합니다.
- GPT-SoVITS와 CogVideoX는 같은 런타임에서 의존성을 섞지 않습니다.
- 토큰은 코드에 직접 쓰지 않고 Colab Secrets에서 `userdata.get()`으로 가져옵니다.
- 이전에 노출된 토큰은 가능하면 재발급합니다.
