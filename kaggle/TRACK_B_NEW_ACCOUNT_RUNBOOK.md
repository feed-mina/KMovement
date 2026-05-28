# K-Ride Track B New Kaggle Account Runbook

이 문서는 새 Kaggle 계정에서 `사진 -> 라우팅 -> CogVideoX 또는 3D/AnimatedDrawings -> TTS -> MusicGen -> MP4` 흐름을 다시 연습하고, 이후 배포용 소스/모델 산출물을 뽑기 위한 실행 순서입니다.

## 핵심 원칙

한 커널에 모든 모델 의존성을 한꺼번에 설치하지 않습니다.

- `CogVideoX/diffusers`는 최신 `huggingface_hub` 계열을 요구할 수 있습니다.
- `GPT-SoVITS`는 현재 성공 조합이 `huggingface_hub==0.23.5`, `peft==0.11.1`, `accelerate==0.33.0`, `transformers==4.46.3` 쪽입니다.
- `AnimatedDrawings`는 별도 Python 3.8 conda env와 TorchServe 조합이 안정적입니다.

따라서 연습은 아래처럼 나누고, 최종 배포에서는 FastAPI가 각 worker를 subprocess로 호출하게 만듭니다.

```text
Notebook A: AnimatedDrawings / 3D animation + fallback + sequential MP4
Notebook B: GPT-SoVITS TTS + MusicGen + FFmpeg mux
Notebook C: CogVideoX image-to-video standalone
Notebook D: FastAPI + zrok gateway + DagsHub logging
```

## Kaggle Secrets

새 계정에서 먼저 Secrets를 만듭니다.

```text
DAGSHUB_TOKEN
ZROK_TOKEN
HF_TOKEN        # CogVideoX / HuggingFace gated model이 필요할 때만
```

코드 안에 토큰 문자열을 직접 넣지 않습니다.

## Kaggle Inputs

새 계정 노트북에 붙일 권장 Input입니다.

```text
1. previous report backup
   - finally-deploy-yerin.ipynb
   - meta_combined_6*.mp4
   - tts_torchaudito_*.wav

2. AnimatedDrawings TorchServe model dataset
   - drawn_humanoid_detector.mar
   - drawn_humanoid_pose_estimator.mar

3. test images
   - person / animal photo
   - travel landscape photo
   - doodle character image
```

## Notebook A: AnimatedDrawings / 3D Animation

목표:

```text
sample character/image -> motion render -> fallback -> combined_sequential.mp4
```

실행 순서:

1. DagsHub/MLflow 환경 변수 설정
2. AnimatedDrawings clone
3. `annotations_to_animation.py`에 `USE_MESA` patch
4. Miniconda `ad_env` 생성
5. `ad_env`에 TorchServe/OSMesa/AnimatedDrawings 의존성 설치
6. `.mar` 파일을 `/kaggle/working/AnimatedDrawings/torchserve/model_store`로 복사
7. TorchServe 시작
8. `image_to_animation.py` 단일 테스트
9. pre-rigged `char1` 단일 렌더 테스트
10. 6개 action fallback 렌더
11. 개별 GIF는 화면에 전부 띄우지 않고 경로만 출력
12. 순차 MP4 생성
13. DagsHub artifact 기록

중요 실패 케이스:

```text
AssertionError: Could not find joint1 in runtime check: right_shoulder
```

처리:

- `render_with_fallback()`에서 먼저 `char_cfg.yaml`에 `right_shoulder`가 있는지 precheck
- 실패 시 안전 캐릭터 `char1~char4` 또는 안전 모션 `wave_hello`, `dab`로 대체
- 실패 로그와 fallback reason을 MLflow에 남김

결과 파일:

```text
/kaggle/working/six_doodle_actions_fallback/combined_sequential.mp4
/kaggle/working/six_doodle_actions_fallback/render_summary.json
```

## Notebook B: TTS + MusicGen + FFmpeg

목표:

```text
combined_sequential.mp4 + 5 TTS clips + MusicGen BGM -> final synced MP4
```

실행 순서:

1. 시스템 패키지 설치
2. GPT-SoVITS 의존성 설치
3. 마지막에 `numpy==1.26.4`, `pandas==2.1.4`, `fsspec==2025.3.0` 고정
4. `peft==0.11.1`, `accelerate==0.33.0`, `huggingface_hub==0.23.5`, `transformers==4.46.3`, `tokenizers==0.20.3`, `click==8.1.7`, `typer==0.12.5` 고정
5. Python 3.12 호환 patch
6. `torchaudio.load`를 `soundfile` 기반 loader로 patch
7. GPT-SoVITS clone / pretrained model 복구
8. 5개 TTS 샘플 생성
9. MusicGen BGM 생성
10. segment별 TTS를 애니메이션 구간에 맞춰 concat/mix
11. DagsHub artifact 기록

결과 파일:

```text
/kaggle/working/final_tts_01.wav
/kaggle/working/final_tts_02.wav
/kaggle/working/final_tts_03.wav
/kaggle/working/final_tts_04.wav
/kaggle/working/final_tts_05.wav
/kaggle/working/musicgen_travel_bgm.wav
/kaggle/working/animation_musicgen_tts_segment_synced.mp4
```

## Notebook C: CogVideoX Standalone

목표:

```text
photo + prompt -> CogVideoX I2V MP4
```

주의:

- Notebook B의 GPT-SoVITS pin 이후 같은 커널에서 CogVideoX를 바로 설치하지 않습니다.
- 새 노트북 또는 새 런타임에서 시작합니다.
- `diffusers`, `accelerate`, `transformers`, 최신 `huggingface_hub` 조합을 CogVideo 전용으로 둡니다.

라우팅 기준:

```python
def route_video_model(caption: str) -> str:
    dynamic_keywords = [
        "person", "people", "man", "woman", "girl", "boy", "child",
        "crowd", "dog", "cat", "animal"
    ]
    text = caption.lower()
    return "cogvideox" if any(word in text for word in dynamic_keywords) else "3d_animation"
```

Kaggle T4/16GB에서 CogVideoX 실행 시:

- `torch.float16`
- `enable_sequential_cpu_offload()`
- `pipe.vae.enable_slicing()`
- `pipe.vae.enable_tiling()`
- 짧은 영상, 낮은 fps, 낮은 inference steps부터 테스트
- 실패 시 3D animation fallback으로 기록

결과 파일:

```text
/kaggle/working/cogvideox_result.mp4
```

## Notebook D: FastAPI + zrok Gateway

목표:

```text
POST /generate
GET  /jobs/{job_id}
GET  /jobs/{job_id}/download
GET  /health
```

첫 배포는 실제 모델을 계속 메모리에 올리지 않고, 이미 생성된 산출물 또는 subprocess worker를 호출합니다.

권장 job schema:

```json
{
  "job_id": "uuid",
  "status": "queued|running|succeeded|failed",
  "route": "cogvideox|3d_animation",
  "input_image": "...",
  "caption": "...",
  "video_path": "...",
  "tts_paths": [],
  "bgm_path": "...",
  "final_mp4_path": "...",
  "error": null
}
```

zrok 실행:

```python
from kaggle_secrets import UserSecretsClient
import subprocess

ZROK = "/kaggle/working/zrok2"
ZROK_TOKEN = UserSecretsClient().get_secret("ZROK_TOKEN")

subprocess.run([ZROK, "enable", ZROK_TOKEN], check=False)
subprocess.Popen([
    ZROK, "share", "public", "http://127.0.0.1:7860", "--headless"
])
```

zrok URL은 로그에 다음처럼 나올 수 있습니다.

```text
access your zrok share at the following endpoints:
 abc123.shares.zrok.io
```

이 경우 실제 URL은:

```text
https://abc123.shares.zrok.io
```

## 최종 배포 산출물

최종본으로 repo에 남길 파일:

```text
kaggle/TRACK_B_NEW_ACCOUNT_RUNBOOK.md
kaggle/track_b_requirements_notes.md
deploy/model_gateway_app.py
deploy/worker_animation.py
deploy/worker_tts_musicgen.py
deploy/worker_cogvideox.py
deploy/requirements-gateway.txt
torchserve/drawn_humanoid_detector.mar
torchserve/drawn_humanoid_pose_estimator.mar
report/sample_final_outputs/
```

대용량 모델 가중치와 Kaggle input dataset은 GitHub에 직접 올리지 않습니다. 대신 DagsHub artifact, Kaggle Dataset, 또는 Hugging Face/DagsHub storage 링크로 참조합니다.

## 지금 다음 순서

1. 새 Kaggle 계정에서 Notebook A만 먼저 성공시킵니다.
2. `combined_sequential.mp4`가 만들어지면 Notebook B로 넘어갑니다.
3. `animation_musicgen_tts_segment_synced.mp4`가 만들어지면 DagsHub에 기록합니다.
4. 그 다음 CogVideoX Notebook C를 별도 런타임에서 연습합니다.
5. 마지막으로 Notebook D에서 zrok gateway로 묶습니다.

