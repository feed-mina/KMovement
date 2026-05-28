# Track B Kaggle Dependency Cells

새 Kaggle 계정에서 아래 셀을 한 노트북에 전부 섞어 실행하지 마세요. `AnimatedDrawings`, `GPT-SoVITS`, `CogVideoX`는 의존성 요구가 다르므로 노트북 또는 subprocess env를 분리합니다.

## Notebook A: AnimatedDrawings / TorchServe

```python
!apt-get update -qq
!apt-get install -y -qq libosmesa6 libosmesa6-dev freeglut3-dev libglfw3-dev ffmpeg git curl
```

```python
import os
from pathlib import Path

CONDA_DIR = "/kaggle/working/miniconda"
ENV_DIR = f"{CONDA_DIR}/envs/ad_env"
PYTHON_EXE = f"{ENV_DIR}/bin/python"
PIP_EXE = f"{ENV_DIR}/bin/pip"
TORCHSERVE = f"{ENV_DIR}/bin/torchserve"

if not Path(CONDA_DIR).exists():
    os.chdir("/kaggle/working")
    os.system("wget -q https://repo.anaconda.com/miniconda/Miniconda3-py38_23.11.0-2-Linux-x86_64.sh")
    os.system("bash Miniconda3-py38_23.11.0-2-Linux-x86_64.sh -b -p /kaggle/working/miniconda")

if not Path(ENV_DIR).exists():
    os.system(f"{CONDA_DIR}/bin/conda create -n ad_env python=3.8 -y")

print("python exists:", Path(PYTHON_EXE).exists())
```

```python
! /kaggle/working/miniconda/envs/ad_env/bin/pip install --upgrade pip setuptools==65.5.0 wheel six --quiet
! /kaggle/working/miniconda/envs/ad_env/bin/pip install chumpy --no-build-isolation --quiet
! /kaggle/working/miniconda/envs/ad_env/bin/pip install torch==1.13.1+cu116 torchvision==0.14.1+cu116 torchaudio==0.13.1 --extra-index-url https://download.pytorch.org/whl/cu116 --quiet
! /kaggle/working/miniconda/envs/ad_env/bin/pip install mmcv-full==1.7.0 -f https://download.openmmlab.com/mmcv/dist/cu116/torch1.13.0/index.html --quiet
! /kaggle/working/miniconda/envs/ad_env/bin/pip install mmdet==2.28.2 mmpose==0.28.1 --quiet
! /kaggle/working/miniconda/envs/ad_env/bin/pip install torchserve==0.8.0 torch-model-archiver==0.8.0 --quiet
! /kaggle/working/miniconda/envs/ad_env/bin/pip install scikit-image scikit-learn PyOpenGL==3.1.7 PyOpenGL-accelerate imageio imageio-ffmpeg shapely pillow pyyaml requests mlflow dagshub tqdm matplotlib opencv-python-headless --quiet
```

## Notebook B: GPT-SoVITS + MusicGen

먼저 시스템 패키지:

```python
!apt-get update -y
!apt-get install -y ffmpeg git curl mecab libmecab-dev mecab-ipadic-utf8 --quiet
```

공통 기록/서버/미디어:

```python
!pip install -q --no-cache-dir \
  mlflow dagshub \
  fastapi uvicorn \
  pillow imageio imageio-ffmpeg \
  soundfile scipy \
  requests gTTS
```

GPT-SoVITS 의존성:

```python
!pip install -q --no-cache-dir \
  gradio typer click \
  split_lang x_transformers pytorch_lightning \
  cn2an pypinyin jieba_fast \
  mecab-python3 python-mecab-ko mecab-ko-dic \
  g2pk2 ko_pron fast_langdetect wordsegment g2p_en konlpy
```

빌드 안정화:

```python
!pip install -q --no-cache-dir setuptools==65.5.0 wheel six
!pip install -q --no-cache-dir chumpy --no-build-isolation --no-deps
```

최종 pin. 중요: 모든 설치가 끝난 뒤 마지막에 실행합니다.

```python
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

버전 확인:

```python
import peft, accelerate, huggingface_hub, transformers, click, numpy, pandas, fsspec

print("peft:", peft.__version__)
print("accelerate:", accelerate.__version__)
print("huggingface_hub:", huggingface_hub.__version__)
print("transformers:", transformers.__version__)
print("click:", click.__version__)
print("numpy:", numpy.__version__)
print("pandas:", pandas.__version__)
print("fsspec:", fsspec.__version__)
```

Python 3.12 / torchaudio patch는 `inference_webui` import 직후 적용합니다.

```python
import os
os.environ["TRANSFORMERS_NO_TORCHVISION"] = "1"
os.environ["TRANSFORMERS_NO_IMAGE_PROCESSING"] = "1"

import pkgutil
import importlib.machinery

if not hasattr(pkgutil, "ImpImporter"):
    pkgutil.ImpImporter = type("ImpImporter", (), {})

if not hasattr(importlib.machinery.FileFinder, "find_module"):
    def _find_module(self, fullname, path=None):
        spec = self.find_spec(fullname)
        return spec.loader if spec else None
    importlib.machinery.FileFinder.find_module = _find_module
```

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

`inference_webui` import 후:

```python
import inference_webui
inference_webui.torchaudio.load = safe_torchaudio_load
```

## Notebook C: CogVideoX

CogVideoX는 Notebook B와 같은 런타임에 섞지 않는 것을 권장합니다.

```python
!apt-get update -y
!apt-get install -y ffmpeg git curl --quiet
```

```python
!pip install -q --no-cache-dir -U \
  diffusers accelerate transformers huggingface_hub \
  pillow imageio imageio-ffmpeg requests mlflow dagshub
```

메모리 절약 기본값:

```python
pipe.enable_sequential_cpu_offload()
pipe.vae.enable_slicing()
pipe.vae.enable_tiling()
```

처음 테스트는 낮은 설정으로 시작합니다.

```python
num_inference_steps=10
guidance_scale=5.0
fps=8
```

## Notebook D: Gateway / zrok

```python
!pip install -q --no-cache-dir fastapi uvicorn mlflow dagshub requests
```

zrok 설치는 release asset의 실제 실행 파일명이 `zrok` 또는 `zrok2`일 수 있으므로 둘 다 탐색합니다.

```python
import os, json, urllib.request, subprocess, shutil
from pathlib import Path

WORK = Path("/kaggle/working")
ZROK_BIN = WORK / "zrok2"

if not ZROK_BIN.exists():
    meta = json.load(urllib.request.urlopen("https://api.github.com/repos/openziti/zrok/releases/latest"))
    tag = meta["tag_name"]
    version = tag.lstrip("v")
    url = f"https://github.com/openziti/zrok/releases/download/{tag}/zrok_{version}_linux_amd64.tar.gz"

    subprocess.run(f"curl -L '{url}' -o {WORK}/zrok.tgz", shell=True, check=True)

    extract_dir = WORK / "zrok_extract"
    if extract_dir.exists():
        shutil.rmtree(extract_dir)
    extract_dir.mkdir(parents=True, exist_ok=True)

    subprocess.run(f"tar -xzf {WORK}/zrok.tgz -C {extract_dir}", shell=True, check=True)

    candidates = [
        x for x in extract_dir.rglob("*")
        if x.is_file() and x.name in ("zrok", "zrok2")
    ]
    if not candidates:
        raise FileNotFoundError("zrok/zrok2 실행파일을 압축 해제 결과에서 찾지 못했습니다.")

    shutil.copy(candidates[0], ZROK_BIN)
    os.chmod(ZROK_BIN, 0o755)

subprocess.run([str(ZROK_BIN), "version"], check=False)
```

