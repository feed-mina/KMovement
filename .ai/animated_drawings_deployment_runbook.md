# AnimatedDrawings Kaggle Deployment Runbook

## Scope

This runbook covers the Kaggle deployment path for the K-Ride AnimatedDrawings demo:

- render six pre-rigged doodle characters with six motions
- convert the successful GIFs into a sequential MP4 to avoid notebook OOM
- mix the sequential animation MP4 with MusicGen BGM and optional GPT-SoVITS TTS
- log individual GIFs, final MP4s, stdout, stderr, metrics, and params to DagsHub MLflow
- expose a static demo page or FastAPI endpoint through zrok

The stable deployment path should prefer pre-rigged characters from:

```text
/kaggle/working/AnimatedDrawings/examples/characters/char1
/kaggle/working/AnimatedDrawings/examples/characters/char2
/kaggle/working/AnimatedDrawings/examples/characters/char3
/kaggle/working/AnimatedDrawings/examples/characters/char4
/kaggle/working/AnimatedDrawings/examples/characters/char5
/kaggle/working/AnimatedDrawings/examples/characters/char6
```

For public demos, avoid running TorchServe unless the feature specifically requires image-to-annotation from a user-uploaded drawing. The pre-rigged path is faster and much more reliable for Kaggle `Save Version`.

The current preferred demo artifact is MP4, not GIF:

```text
/kaggle/working/six_doodle_actions_fallback/combined_sequential.mp4
/kaggle/working/animation_with_musicgen.mp4
/kaggle/working/animation_musicgen_tts_final.mp4
```

GIFs are still useful as intermediate debug artifacts, but they should not be embedded all at once in the notebook output.

## Model-Less Deployment First

The next deployment should intentionally exclude live model inference. Treat the current generated media as static, versioned assets and deploy only the preview/download experience first.

Why:

- Kaggle GPU sessions are temporary and fragile for long-running model servers
- GPT-SoVITS, MusicGen, AnimatedDrawings, and CogVideoX have conflicting dependency stacks
- zrok is best used first as a read-only demo tunnel
- the frontend/API contract can be stabilized before model runtime work resumes

### Deployable Assets

Local verified assets currently live under:

```text
D:\kride-project\report\finally-deploy-yerin.ipynb
D:\kride-project\report\meta_combined_6.mp4
D:\kride-project\report\meta_combined_6_Musicgen.mp4
D:\kride-project\report\meta_combined_6_Musicgen_tts_success.mp4
D:\kride-project\report\tts_torchaudito_1.wav
D:\kride-project\report\tts_torchaudito_2.wav
D:\kride-project\report\tts_torchaudito_3.wav
D:\kride-project\report\tts_torchaudito_4.wav
D:\kride-project\report\tts_torchaudito_5.wav
```

For the first deployment, use these as fixed demo artifacts:

```text
animation only      -> meta_combined_6.mp4
animation + BGM     -> meta_combined_6_Musicgen.mp4
animation + BGM+TTS -> meta_combined_6_Musicgen_tts_success.mp4
TTS samples         -> tts_torchaudito_*.wav
```

Do not trigger model generation from this deployment. The first goal is to verify:

```text
frontend page loads
video/audio assets stream correctly
download links work
health endpoint works
DagsHub run records deployment metadata
zrok URL works while the session is alive
```

### Model-Less API Surface

Use a small read-only FastAPI app or static page:

```text
GET /health
GET /
GET /video/animation
GET /video/animation-bgm
GET /video/full
GET /audio/tts/{index}
GET /manifest.json
```

`/manifest.json` should describe the assets and later become the frontend contract:

```json
{
  "mode": "static-demo",
  "modeling_enabled": false,
  "videos": {
    "animation": "/video/animation",
    "animation_bgm": "/video/animation-bgm",
    "full": "/video/full"
  },
  "tts_samples": [
    "/audio/tts/1",
    "/audio/tts/2",
    "/audio/tts/3",
    "/audio/tts/4",
    "/audio/tts/5"
  ]
}
```

### Model Attachment Contract

When modeling is added later, keep the public contract stable and only change the backend mode:

```text
MEDIA_MODE=static-demo      serve existing files only
MEDIA_MODE=ffmpeg-local     allow local FFmpeg remixes only
MEDIA_MODE=model-worker     enqueue model generation jobs
MEDIA_MODE=remote-model     call a remote GPU worker
```

Add generation endpoints only after the static deployment is healthy:

```text
POST /jobs/animation
POST /jobs/tts
POST /jobs/final-video
GET  /jobs/{job_id}
GET  /jobs/{job_id}/download
```

Each job response should be compatible with the static asset manifest:

```json
{
  "job_id": "uuid",
  "status": "completed",
  "mode": "model-worker",
  "result": {
    "full": "/jobs/uuid/download"
  },
  "fallback_used": false,
  "error": null
}
```

This lets the frontend work with static demo assets now and generated model assets later.

## Current Stable Result

The six-action batch can successfully log to DagsHub:

```text
Experiment: animated-drawings-six-actions
Run example: 031eb2deafcb4c8e84da3aaa286ce857
Tracking URI: https://dagshub.com/myelin24m/Kride.mlflow
```

Known successful combinations:

```text
char1 + dab + fair1_ppf
char2 + wave_hello + fair1_ppf
char3 + jumping + fair1_ppf
char4 + jumping_jacks + cmu1_pfp
```

## Known Failure: Missing Required Runtime Joint

### Symptom

Some character and motion/retarget combinations fail with:

```text
AssertionError: Could not find joint1 in runtime check: right_shoulder
```

Observed examples:

```text
/kaggle/working/six_doodle_actions/05_zombie/render_stderr.txt
/kaggle/working/six_doodle_actions/06_jesse_dance/render_stderr.txt
```

Example trace:

```text
File ".../animated_drawing.py", line 284, in _modify_retargeting_cfg_for_character
    assert False, msg
AssertionError: Could not find joint1 in runtime check: right_shoulder
```

### Meaning

This is not a server failure. It means the selected character annotation does not contain the joint required by the selected retarget configuration. In this case the retarget config expects `right_shoulder`, but the character's `char_cfg.yaml` does not provide that runtime joint.

This can happen with:

- auto-generated user doodle annotations
- pre-rigged examples with non-standard skeletons
- characters generated from partial bodies, cropped bodies, ambiguous limbs, or failed pose detection
- motion/retarget pairs that assume a richer skeleton than the character has

### User-Facing Behavior

Treat this as an input compatibility issue, not a crash.

Recommended product response:

```text
This character could not support the selected motion because one or more required joints were missing. We applied a compatible fallback motion instead.
```

Do not show Python stack traces to users. Persist the raw traceback to `render_stderr.txt` and MLflow artifacts for debugging.

## Deployment Handling Policy

### 1. Validate Joints Before Rendering

Before launching `annotations_to_animation.py`, inspect each character's `char_cfg.yaml`. If a requested retarget requires joints that are missing, do not attempt the render.

Minimum runtime check for fair1 humanoid motions:

```text
right_shoulder
left_shoulder
right_elbow
left_elbow
right_hip
left_hip
right_knee
left_knee
```

If any required joint is absent, mark the candidate motion as incompatible.

### 2. Try Fallbacks in Order

For each user character:

1. try requested motion and retarget
2. try the same motion with a safer retarget if available
3. try a conservative fallback motion such as `wave_hello` or `dab`
4. if still incompatible, use a known-good pre-rigged demo character
5. if all animation fails, return a static preview card and explain that the doodle needs clearer limbs

Suggested safe fallback matrix:

```text
dab.yaml           -> fair1_ppf.yaml
wave_hello.yaml    -> fair1_ppf.yaml
jumping.yaml       -> fair1_ppf.yaml
jumping_jacks.yaml -> cmu1_pfp.yaml
zombie.yaml        -> fair1_ppf.yaml, fallback to char1 if user character fails
jesse_dance.yaml   -> mixamo_fff.yaml, fallback to char2 if user character fails
```

### 3. Record Every Attempt

For each render attempt, log:

```text
character_id
character_source
requested_motion
requested_retarget
actual_motion
actual_retarget
fallback_used
render_return_code
success
missing_joint
stderr_artifact_path
gif_artifact_path
```

This makes DagsHub useful for debugging user failures after deployment.

### 4. Batch Rendering Should Be Partial-Success

The six-action batch should not fail the whole job because one render failed.

Expected batch behavior:

```text
4/6 succeeded, 2/6 failed
combined sequential MP4 includes the successful renders in order
failed cells show a short compatibility message
DagsHub logs all outputs and failed stderr files
```

For a public demo, prefer replacing failed cells with fallback renders so that the page always has six visible animations.

## Kaggle OOM Safety Policy

Kaggle OOM failures have mostly come from GIF-heavy notebook display and from keeping multiple large models in memory.

Avoid:

- embedding six GIFs as base64 HTML at once
- building a combined GIF by storing all frames in a Python list
- uploading the entire render directory with every attempt folder and frame-like artifact
- loading BLIP-2, GPT-SoVITS, MusicGen, AnimatedDrawings, and CogVideoX in one long-lived process

Prefer:

- print individual GIF paths instead of displaying all GIFs
- convert GIFs to small MP4 segments and concatenate with FFmpeg
- upload only final MP4s, selected individual GIFs, `render_summary.json`, and logs
- run heavy models in separate cells or subprocesses and release memory between phases

Recommended memory release after model use:

```python
del model, processor, inputs, audio_values
gc.collect()
if torch.cuda.is_available():
    torch.cuda.empty_cache()
```

If Kaggle shows an OOM error page, restart the session before continuing. Do not continue importing models in the same broken kernel.

## Final Media Assembly Plan

The final demo should be assembled in three independent local steps:

```text
1. AnimatedDrawings fallback batch
   -> /kaggle/working/six_doodle_actions_fallback/combined_sequential.mp4

2. MusicGen BGM generation and mix
   -> /kaggle/working/animation_with_musicgen.mp4

3. GPT-SoVITS TTS generation and final mix
   -> /kaggle/working/animation_musicgen_tts_final.mp4
```

The FFmpeg mix for the full artifact should use the animation as the video base:

```text
combined_sequential.mp4 + final_tts_Vlog_Opening_Excited.wav + musicgen_travel_bgm.wav
  -> animation_musicgen_tts_final.mp4
```

Use absolute paths for generated audio to avoid `chdir()` confusion:

```text
/kaggle/working/final_tts_Vlog_Opening_Excited.wav
/kaggle/working/musicgen_travel_bgm.wav
/kaggle/working/animation_musicgen_tts_final.mp4
```

Do not save TTS only as a relative path inside `/kaggle/working/GPT-SoVITS`; later mix cells expect the file under `/kaggle/working`.

## Dependency Pinning Notes

For the GPT-SoVITS + MusicGen Kaggle runtime, the stable pin set is:

```text
huggingface_hub==0.23.5
transformers==4.45.2 or 4.46.3
tokenizers==0.20.3
peft==0.11.1
accelerate==0.33.0
click==8.1.7
typer==0.12.5
fsspec==2025.3.0
numpy==1.26.4
pandas==2.1.4
```

Install the final pin set after other dependencies, then restart the Kaggle session. Warnings about unrelated Kaggle packages requiring NumPy 2.x or newer pandas can be ignored for this pipeline if the above versions are correct.

Python 3.12 compatibility patches must run before importing `inference_webui`:

```python
import pkgutil, importlib.machinery

if not hasattr(pkgutil, "ImpImporter"):
    pkgutil.ImpImporter = type("ImpImporter", (), {})

if not hasattr(importlib.machinery.FileFinder, "find_module"):
    def _find_module(self, fullname, path=None):
        spec = self.find_spec(fullname)
        return spec.loader if spec else None
    importlib.machinery.FileFinder.find_module = _find_module
```

Known error and fix:

```text
ImportError: cannot import name 'LocalEntryNotFoundError' from 'huggingface_hub.errors'
```

This means `peft` and `huggingface_hub` are mismatched. Reinstall the pin set above and restart.

### TorchVision and Torchaudio Split

Kaggle's current Python 3.12 GPU image can contain a broken `torch` / `torchvision` pair. The observed failure is:

```text
RuntimeError: operator torchvision::nms does not exist
```

For the TTS + MusicGen path, do not rely on `torchvision`. It is not required by GPT-SoVITS, MusicGen audio generation, or FFmpeg mixing. If this error appears, uninstall `torchvision` and prevent Transformers from trying image-processing imports before importing `transformers`, `peft`, or `inference_webui`:

```python
import os
os.environ["TRANSFORMERS_NO_TORCHVISION"] = "1"
os.environ["TRANSFORMERS_NO_IMAGE_PROCESSING"] = "1"
```

However, GPT-SoVITS imports `torchaudio`, so do not remove `torchaudio` permanently. If `torchaudio` was removed while debugging `torchvision`, restore only `torchaudio`:

```python
!pip install -q --no-cache-dir torchaudio --index-url https://download.pytorch.org/whl/cu130
```

Then verify without importing `torchvision`:

```python
import torch
import torchaudio

print("torch:", torch.__version__)
print("torchaudio:", torchaudio.__version__)
```

If the `cu130` index does not provide a compatible wheel, try plain PyPI:

```python
!pip install -q --no-cache-dir torchaudio
```

Do not run `import torchvision` as a health check in this runtime. It can re-trigger the `torchvision::nms` error and is not needed for this pipeline.

### Torchaudio TorchCodec Fallback

Recent `torchaudio` versions may route `torchaudio.load()` through `torchcodec`. In the Kaggle Python 3.12 GPU runtime this can fail with:

```text
RuntimeError: Could not load libtorchcodec
```

This failure has appeared while GPT-SoVITS reads the reference WAV:

```text
audio, sr0 = torchaudio.load(filename)
```

For our pipeline the reference audio is a plain WAV generated by FFmpeg, so `soundfile` is sufficient. Patch `torchaudio.load` after importing `inference_webui` and before calling `get_tts_wav()`:

```python
import torch
import torchaudio
import soundfile as sf

def safe_torchaudio_load(filename, *args, **kwargs):
    audio, sr = sf.read(filename, always_2d=True)
    audio = torch.from_numpy(audio.T).float()
    return audio, sr

torchaudio.load = safe_torchaudio_load
print("torchaudio.load patched to soundfile")
```

This changes the reference WAV path from:

```text
GPT-SoVITS -> torchaudio.load -> torchcodec -> libtorchcodec failure
```

to:

```text
GPT-SoVITS -> torchaudio.load -> soundfile.read -> WAV tensor
```

Keep `torchaudio` installed because GPT-SoVITS imports it, but bypass `torchcodec` for loading the known-good WAV files.

Recommended split:

```text
TTS/MusicGen runtime:
  keep torchaudio
  avoid torchvision
  set TRANSFORMERS_NO_TORCHVISION=1

CogVideoX/diffusers runtime:
  use a separate notebook or environment
  install the torch/torchvision/diffusers stack required by CogVideoX

AnimatedDrawings TorchServe runtime:
  use the conda ad_env environment
  keep torch 1.13.1 + mmcv/mmpose/mmdet isolated from Kaggle base Python
```

Do not attempt to make GPT-SoVITS, CogVideoX, AnimatedDrawings TorchServe, and the Kaggle base notebook share one global Python dependency set.

## zrok Deployment Notes

zrok exposes a running Kaggle process through a public URL. It is suitable for demos, not permanent hosting. The share stops when the Kaggle session or zrok process stops.

Required Kaggle Secrets:

```text
DAGSHUB_TOKEN
ZROK_TOKEN
```

Recommended first deployment:

1. render the six-action batch
2. create `/kaggle/working/six_doodle_actions_fallback/combined_sequential.mp4`
3. optionally create `/kaggle/working/animation_with_musicgen.mp4`
4. optionally create `/kaggle/working/animation_musicgen_tts_final.mp4`
5. serve the generated files with FastAPI
6. run `zrok share public http://127.0.0.1:7860 --headless`

This is more stable than exposing a long-running API while the rendering stack is still being hardened.

FastAPI through zrok should be the second step after static demo success.

### Recommended FastAPI Surface

Keep the first zrok deployment read-only:

```text
GET /                      HTML preview page
GET /health                file existence status
GET /video/animation       combined_sequential.mp4
GET /video/animation-bgm   animation_with_musicgen.mp4
GET /video/full            animation_musicgen_tts_final.mp4
```

Generation endpoints should be added only after the read-only preview is stable:

```text
POST /generate/animation   render fallback batch
POST /generate/final       mix animation + BGM + TTS
GET  /status/{job_id}      polling endpoint
GET  /download/{job_id}    result download
```

For Kaggle demos, generation jobs should run one at a time. A single worker is safer than concurrent requests.

### zrok Binary Extraction Note

Recent zrok release archives may unpack the executable as either `zrok` or `zrok2`. The installer cell should search for both names after extracting:

```text
zrok
zrok2
```

If the installer cannot find either executable, print the extracted file list before failing. This avoids the previous failure:

```text
FileNotFoundError: zrok executable not found after extraction
```

### DagsHub Artifact Policy

For deployment runs, log only high-signal artifacts:

```text
combined_video/combined_sequential.mp4
final_video/animation_musicgen_tts_final.mp4
summary/render_summary.json
logs/error_log.txt
individual_gifs/*.gif
```

Avoid `mlflow.log_artifacts(str(ROOT_OUTPUT))` for large attempt folders during public demos. It can upload too much data and increase memory pressure.

Suggested MLflow fields:

```text
params:
pipeline_version
selected_motion
fallback_used
fallback_reason
tts_text
bgm_prompt

metrics:
animation_seconds
tts_seconds
bgm_seconds
ffmpeg_seconds
success_count
```

## Deployment Phases

### Phase 1: Read-Only Result Server

Goal: expose already generated MP4s through zrok.

Do this first because it has the lowest OOM risk.

```text
combined_sequential.mp4
animation_with_musicgen.mp4
animation_musicgen_tts_final.mp4
```

### Phase 2: Final-Mix API

Goal: expose a button/API that runs only FFmpeg mixing.

Inputs must already exist:

```text
combined_sequential.mp4
musicgen_travel_bgm.wav
final_tts_Vlog_Opening_Excited.wav
```

This is safe because FFmpeg is much lighter than model inference.

### Phase 3: Animation Generation API

Goal: accept a doodle or use pre-rigged characters, then run `render_with_fallback`.

Rules:

- one job at a time
- subprocess for render execution
- partial-success output
- no all-GIF notebook display

### Phase 4: Full Pipeline API

Goal:

```text
doodle upload -> animation -> TTS -> BGM -> final MP4
```

Do not keep every model in one process. Use subprocesses or separate cells/workers for each heavy phase.

### Phase 5: Community Sketch Integration

The frontend community sketch feature should hand off a saved canvas image to the doodle pipeline. The first backend contract can be simple:

```text
POST /generate/animation
multipart:
  image: sketch.png
  motion: wave_hello
```

The response should include a `job_id`, then the frontend polls `/status/{job_id}` until the final media is ready.

Current frontend handoff state:

- `components/community/CommunityPage.tsx` has a modal sketch pad on the community write/modify form.
- Saving the sketch converts the canvas to a PNG `File`, adds it to the community image attachments, and stores a handoff payload in `localStorage`.
- Existing community detail images can also be marked as doodle input from the `낙서로 보내기` button.
- The handoff key is `kride:doodle-source`.

Payload examples:

```json
{
  "kind": "community-sketch",
  "filename": "kride-doodle-sketch-1779770000000.png",
  "dataUrl": "data:image/png;base64,...",
  "createdAt": "2026-05-26T09:00:00.000Z"
}
```

```json
{
  "kind": "community-image",
  "sourceUrl": "https://...",
  "originalName": "my_character.png",
  "createdAt": "2026-05-26T09:00:00.000Z"
}
```

The next page that owns the doodle/animation workflow should read `localStorage["kride:doodle-source"]`, show a preview, and submit either the `dataUrl` as a PNG upload or the `sourceUrl` as a remote image fetch request.

## Kaggle Save Version Checklist

Before clicking `Save Version`:

- no `getpass.getpass()` in deployment cells
- `DAGSHUB_TOKEN` exists in Kaggle Secrets or code falls back to local MLflow
- `ZROK_TOKEN` exists if zrok sharing is part of the run
- no manual upload-only paths such as `/kaggle/working/my_character.png`
- no required dependency on a live interactive session
- no duplicate `git clone`, `apt-get`, or `pip install` cells
- render uses `/kaggle/working/miniconda/envs/ad_env/bin/python` when using TorchServe/OSMesa
- partial failures do not abort the whole batch

## CI/CD 배포 기록 (2026-05-27)

### 배포 대상
- **AWS EC2**: SDUI Spring Boot 백엔드 (GitHub Actions → Docker Hub → SSH)
- **GCP VM**: FastAPI + Celery + ChromaDB + Redis (GitHub Actions → Artifact Registry → SSH → docker-compose)
- **Media Preview**: 모델 없이 사전 생성된 MP4/WAV 서빙 (deploy/ 폴더)

### 최종 상태

| 대상 | 상태 | 비고 |
|------|------|------|
| AWS EC2 (SDUI) | ✅ 성공 | `sdui-backend:8080` — `43.201.237.68:8080` |
| GCP VM (AI Services) | ✅ 성공 | FastAPI + ChromaDB + Redis + Celery — `34.64.221.240:8000` |

---

### AWS EC2 인프라 정보
- Elastic IP: `43.201.237.68`
- 사용자: `ubuntu`
- 컨테이너: `sdui-backend` (포트 8080)
- 이미지: Docker Hub (`sdui-app:main`)
- 네트워크: `sdui-network` (Redis, PostgreSQL 연동)

### GCP VM 인프라 정보
- Instance: `instance-20260524-023146` (asia-northeast3-a)
- IP: `34.64.221.240`
- GPU: NVIDIA L4 (24GB), CUDA 12.4, Driver 550.54.15
- Docker 29.5.2, Compose v5.1.4
- 디스크: 30GB (10GB에서 확장)
- 사용자: `Samsung`
- Artifact Registry: `asia-northeast3-docker.pkg.dev`

---

### 해결된 이슈 (전체 트러블슈팅 로그)

#### 1. GCP VM SSH 접속 실패 — `insufficient authentication scopes`
- **증상**: `gcloud compute ssh` 실행 시 인증 스코프 에러
- **원인**: 로컬 gcloud 인증이 만료/부족
- **수정**: `gcloud auth login` 재인증

#### 2. Gradle wrapper jar 누락 — `Unable to access jarfile gradle-wrapper.jar`
- **증상**: GitHub Actions에서 `./gradlew clean build` 실패
- **원인**: 루트 `.gitignore`에 `*.jar` 패턴 → `gradle-wrapper.jar`가 git에서 제외
- **수정**: `git add -f subproject/SDUI/SDUI-server/gradle/wrapper/gradle-wrapper.jar`

#### 3. Gradle wrapper properties 누락 — `gradle-wrapper.properties does not exist`
- **증상**: wrapper jar 추가 후에도 Gradle 빌드 실패
- **원인**: `subproject/SDUI/.gitignore:66`에 `gradle/` 디렉토리 ignore 규칙
- **수정**: `git add -f subproject/SDUI/SDUI-server/gradle/wrapper/gradle-wrapper.properties`

#### 4. Git LFS fetch 실패 — `Object does not exist on the server` (404)
- **증상**: `actions/checkout`에서 LFS 파일 다운로드 실패
- **원인**: `route_graph.pkl` 등 LFS 객체 누락 (용량 초과 또는 미업로드)
- **수정**: `lfs: true` 및 `git lfs pull` 단계 제거 (SDUI Spring Boot 빌드에 LFS 불필요)

#### 5. `actions/setup-java@v4` 다운로드 실패 (404)
- **증상**: JDK 17 설정 단계에서 캐시 관련 오류
- **원인**: `cache: gradle` 옵션이 GitHub Actions SHA 캐시 불일치 유발
- **수정**: `cache: gradle` 옵션 제거

#### 6. `appleboy/ssh-action` SSH 키 파싱 실패 — `ssh: no key found`
- **증상**: EC2/GCP 배포 단계에서 SSH 인증 실패
- **원인**: ed25519 OPENSSH 형식 키를 appleboy가 파싱 못함
- **수정 시도**: RSA 4096 PEM 키 생성 → 여전히 불안정
- **최종 수정**: `appleboy/ssh-action` 제거, 직접 `ssh -i ~/.ssh/deploy_key` 방식으로 교체 (EC2, GCP 모두)

#### 7. EC2 SSH `Permission denied (publickey)` — 다중 원인
- **증상**: GitHub Actions에서 EC2 SSH 접속 시 인증 실패
- **원인 1**: `AWS_HOST` 시크릿에 잘못된 IP 저장 (프라이빗 IP 사용) → Elastic IP `43.201.237.68`로 수정
- **원인 2**: `AWS_USERNAME` 시크릿 값 오류 → `ubuntu`로 수정
- **원인 3**: EC2 `authorized_keys`에 공개키가 줄바꿈으로 깨져 등록됨 → 단일 행으로 재등록
- **원인 4**: `NEW_PUBLIC_KEY_HERE` 리터럴 텍스트가 authorized_keys에 남아있음 → 정리

#### 8. GCP Credentials base64 디코딩 실패 — `base64: invalid input`
- **증상**: EC2 배포 중 GCP credentials JSON 디코딩 에러
- **원인**: `GCP_CREDENTIALS_JSON`을 SSH env로 전달 시 base64 데이터 깨짐
- **수정**: SSH env 전달 대신 `scp`로 파일 직접 전송 후 volume mount

#### 9. GCP Artifact Registry push 실패 — `Permission denied uploadArtifacts`
- **증상**: Docker push 시 Artifact Registry 권한 부족
- **원인**: `GCP_SA_KEY` 시크릿에 저장된 서비스 계정 키 만료/무효
- **수정**: `github-actions-sa` 서비스 계정의 새 키 생성 후 `GCP_SA_KEY` 시크릿 재설정

#### 10. GCP Deploy SSH 타임아웃 — `Connection timed out`
- **증상**: Artifact Registry push 성공 후 VM 배포 단계에서 SSH 타임아웃
- **원인**: `GCP_VM_HOST` 시크릿에 잘못된 IP 저장 (5/24 설정 이후 미갱신)
- **수정**: `GCP_VM_HOST`를 `34.64.221.240`으로, `GCP_VM_USER`를 `Samsung`으로 재설정

#### 11. TorchServe 이미지 not found — `torchserve-gpu:latest: not found`
- **증상**: `docker compose pull`에서 TorchServe 이미지 다운로드 실패
- **원인**: TorchServe 이미지는 `torchserve/` 변경 시에만 빌드되므로, Artifact Registry에 한 번도 push된 적 없음
- **수정**: docker-compose에서 TorchServe 서비스 제거, FastAPI/Celery의 TorchServe 의존성 해제 (`TORCHSERVE_ENABLED=false`)

#### 12. GCP VM 디스크 공간 부족 — `no space left on device`
- **증상**: Docker 이미지 pull 중 파일시스템 쓰기 실패
- **원인**: 기본 디스크 10GB, scipy/torch 등 대용량 라이브러리 포함 이미지
- **수정**: `gcloud compute disks resize` → 30GB 확장 + `growpart` + `resize2fs` (growpart는 `apt install cloud-guest-utils` 필요)

#### 13. ChromaDB 헬스체크 실패 — `curl: executable file not found`
- **증상**: ChromaDB 컨테이너가 `unhealthy` 상태 → FastAPI 시작 차단
- **원인**: `chromadb/chroma:latest` 이미지에 `curl` 미설치
- **수정 1차**: 헬스체크를 `curl` → `python3 -c "import urllib.request; ..."` 로 변경
- **수정 2차**: `CMD` → `CMD-SHELL` + `python3 urllib` 시도 → `python3`도 미설치로 실패
- **수정 3차 (최종)**: `bash -c 'echo > /dev/tcp/localhost/8000'` 방식으로 해결. ChromaDB 이미지에는 `curl`, `wget`, `python3` 모두 없고 `bash`만 사용 가능. `timeout: 10s`, `start_period: 30s`

---

### 워크플로우 파일 변경 이력

**deploy-ec2.yml:**
- `lfs: true` 제거
- `Pull LFS model assets` 단계 제거
- `cache: gradle` 제거
- `appleboy/ssh-action` → 직접 SSH (`ssh -i ~/.ssh/deploy_key`) 교체
- `workflow_dispatch` 트리거 추가
- GCP credentials 전달: SSH env → `scp` 파일 전송 방식
- deploy script: sed placeholder 치환 방식

**deploy-gcp.yml:**
- `workflow_dispatch` 트리거 추가
- `appleboy/ssh-action` → 직접 SSH 교체
- deploy script: sed placeholder 치환 방식
- TorchServe 서비스 제거 (docker-compose)
- FastAPI: `TORCHSERVE_ENABLED=false`, `TORCHSERVE_FALLBACK=true`
- ChromaDB 헬스체크: `curl` → `python3 urllib`
- `version: '3.8'` 제거 (Docker Compose 경고 방지)

### GitHub Secrets 등록 현황 (2026-05-27 기준)

| Secret | 용도 | 최종 업데이트 |
|--------|------|---------------|
| `AWS_KEY` | EC2 SSH 프라이빗 키 (RSA PEM) | 05-26 |
| `AWS_HOST` | EC2 Elastic IP (`43.201.237.68`) | 05-27 |
| `AWS_USERNAME` | EC2 SSH 사용자 (`ubuntu`) | 05-27 |
| `GCP_SA_KEY` | GCP 서비스 계정 키 (Artifact Registry push) | 05-27 |
| `GCP_VM_SSH_KEY` | GCP VM SSH 프라이빗 키 (`google_compute_engine`) | 05-26 |
| `GCP_VM_HOST` | GCP VM IP (`34.64.221.240`) | 05-27 |
| `GCP_VM_USER` | GCP VM 사용자 (`Samsung`) | 05-27 |
| 기타 | DB, API keys, OAuth 등 | 05-24 |

### 잔여 작업

| # | 작업 | 상태 |
|---|------|------|
| 1 | ~~ChromaDB 헬스체크 수정 커밋 & 푸시 → GCP 재배포~~ | ✅ 완료 |
| 2 | TorchServe 이미지 첫 빌드 & 푸시 (Phase 2) | 미시작 |
| 3 | TorchServe 모델 파일 (`*.mar`) VM 배치 | 미시작 |
| 4 | EC2 PostgreSQL (`sdui-db`) 컨테이너 상태 확인 | 미확인 |
| 5 | 보안: 채팅에 노출된 SSH 키, SA 키, HF 토큰 로테이션 | 권장 |

## Preferred Next Implementation

Add a small compatibility layer around rendering:

```text
render_with_fallback(character, requested_motion)
  -> validate required joints
  -> run compatible render
  -> retry fallback matrix
  -> return structured result
```

This layer should return:

```json
{
  "success": true,
  "fallback_used": false,
  "gif_path": "...",
  "motion": "dab",
  "retarget": "fair1_ppf",
  "error_type": null,
  "missing_joint": null
}
```

For missing joint failures:

```json
{
  "success": false,
  "fallback_used": true,
  "gif_path": null,
  "motion": "zombie",
  "retarget": "fair1_ppf",
  "error_type": "missing_joint",
  "missing_joint": "right_shoulder"
}
```
