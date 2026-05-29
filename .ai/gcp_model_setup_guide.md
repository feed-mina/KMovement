# GCP VM 모델 설치 가이드

> 대상 VM: `instance-20260524-023146` (feedmina94)
> 작성일: 2026-05-29

---

## 1. 사전 준비

```bash
# 레포 클론
cd ~
git clone https://github.com/<YOUR_GITHUB_USERNAME>/kride-project.git
cd kride-project

# Python 가상환경 (시스템 Python 오염 방지)
python3 -m venv ~/model-env
source ~/model-env/bin/activate
pip install --upgrade pip
```

---

## 2. TorchServe .mar 빌드

### 2-1. torch-model-archiver 설치

```bash
source ~/model-env/bin/activate
pip install torch-model-archiver torch torchserve
```

### 2-2. .mar 파일 생성

```bash
cd ~/kride-project/torchserve
bash package_models.sh
```

결과:
- `embedder.mar` — 핸들러만 (런타임에 HuggingFace에서 `intfloat/multilingual-e5-small` 자동 다운로드)
- `reranker.mar` — 핸들러만 (런타임에 `cross-encoder/ms-marco-MiniLM-L-6-v2` 자동 다운로드)
- `weather_lstm.mar` — `models/dl/weather_lstm.pt` 필요 (없으면 SKIP)
- `event_ner.mar` — `models/dl/event_classifier/` 필요 (없으면 핸들러만)

### 2-3. 생성 확인

```bash
ls -lh *.mar
# embedder.mar, reranker.mar 최소 2개 생성 확인
```

### 2-4. Docker 이미지 빌드 & 푸시

```bash
cd ~/kride-project/torchserve

# Docker 빌드
docker build -t torchserve-gpu:latest -f Dockerfile .

# Artifact Registry 푸시
gcloud auth configure-docker asia-northeast3-docker.pkg.dev --quiet

PROJECT_ID=$(gcloud config get-value project)
REGISTRY="asia-northeast3-docker.pkg.dev/${PROJECT_ID}/kride-ai"

docker tag torchserve-gpu:latest ${REGISTRY}/torchserve-gpu:latest
docker push ${REGISTRY}/torchserve-gpu:latest

echo "TorchServe 이미지 푸시 완료: ${REGISTRY}/torchserve-gpu:latest"
```

### 2-5. docker-compose로 TorchServe 시작

```bash
cd ~/kride

# docker-compose.prod.yml에 이미 torchserve 서비스 포함 (deploy-gcp.yml 참조)
docker compose -f docker-compose.prod.yml pull torchserve
docker compose -f docker-compose.prod.yml up -d torchserve

# 확인
docker compose -f docker-compose.prod.yml logs torchserve
curl http://localhost:8085/ping
# → {"status": "Healthy"}
```

### 2-6. FastAPI에서 TorchServe 사용 확인

```bash
# FastAPI 환경변수 확인 (docker-compose에 이미 설정됨)
# TORCHSERVE_URL=http://torchserve:8085
# TORCHSERVE_ENABLED=true
# TORCHSERVE_FALLBACK=true

# 임베딩 테스트
curl -X POST http://localhost:8085/predictions/embedder \
  -H "Content-Type: application/json" \
  -d '{"text": ["강릉 해변 여행"]}'
```

---

## 3. 3D Photo Inpainting 설치

### 3-1. 레포 클론 & 의존성 설치

```bash
cd ~
git clone https://github.com/vt-vl-lab/3d-photo-inpainting.git
cd 3d-photo-inpainting

# 가상환경 (별도 권장 — 의존성 충돌 가능)
python3 -m venv ~/3dphoto-env
source ~/3dphoto-env/bin/activate

pip install -r requirements.txt
# 추가: MiDaS 깊이 추정 모델 다운로드
python download.py  # 또는 수동으로 체크포인트 다운로드
```

### 3-2. 체크포인트 다운로드

```bash
# MiDaS 모델 (깊이 추정)
mkdir -p checkpoints
wget -O checkpoints/MiDaS_v2.pt https://github.com/isl-org/MiDaS/releases/download/v2/model-f46da743.pt

# Edge model (3D Photo Inpainting 자체 모델)
# 레포의 README에 따라 다운로드
```

### 3-3. 환경변수 설정

FastAPI 컨테이너 또는 RunPod 환경에 설정:

```bash
# 방법 A: JSON 템플릿 (유연)
export KRIDE_3D_PHOTO_COMMAND_JSON='[
  "/home/feedmina94/3dphoto-env/bin/python",
  "/home/feedmina94/3d-photo-inpainting/main.py",
  "--config", "/home/feedmina94/3d-photo-inpainting/argument.yml",
  "--src_img", "{image}",
  "--output_dir", "{output_dir}"
]'

# 방법 B: 단순 커맨드
export KRIDE_3D_PHOTO_COMMAND="/home/feedmina94/3dphoto-env/bin/python /home/feedmina94/3d-photo-inpainting/main.py --src_img {image} --output_dir {output_dir}"
```

### 3-4. 테스트

```bash
source ~/3dphoto-env/bin/activate
cd ~/3d-photo-inpainting

# 직접 실행 테스트
python main.py --config argument.yml --src_img test_image.jpg --output_dir /tmp/3d_test

# 결과 확인
ls /tmp/3d_test/*.mp4
```

### 3-5. docker-compose에 환경변수 추가

`docker-compose.prod.yml`의 FastAPI 서비스에 추가:
```yaml
environment:
  - KRIDE_3D_PHOTO_COMMAND_JSON=["/home/feedmina94/3dphoto-env/bin/python", ...]
  - KRIDE_WORKER_ALLOW_FALLBACK=true
```

> **참고**: 3D Photo Inpainting이 Docker 컨테이너 밖의 호스트에 설치된 경우,
> FastAPI 컨테이너에서 호스트 명령 실행이 필요합니다.
> 대안: 3D Photo Inpainting도 Docker 이미지로 만들거나, RunPod에 배포.

---

## 4. 검증 체크리스트

### TorchServe
- [ ] `curl http://localhost:8085/ping` → `{"status": "Healthy"}`
- [ ] `curl -X POST http://localhost:8085/predictions/embedder -d '{"text":["test"]}'` → 임베딩 벡터 반환
- [ ] FastAPI 로그에서 `TORCHSERVE_ENABLED=true` 확인
- [ ] fallback 테스트: TorchServe 중지 후 FastAPI가 CPU 모델로 전환되는지 확인

### 3D Photo Inpainting
- [ ] `python main.py --src_img test.jpg --output_dir /tmp/test` → mp4 생성
- [ ] Cloud Gateway에서 `POST /jobs/generate` route=`3d_photo_inpainting_real` → 성공
- [ ] fallback 테스트: 커맨드 실패 시 `3d_photo_light` (ffmpeg zoompan)으로 전환

### 커뮤니티 연동
- [ ] 게시글 상세 → "영상 만들기" → 3개 옵션 모달 표시
- [ ] "스케치 애니메이션" → 스케치 데이터로 RunPod 제출
- [ ] "AI 영상 생성" → 첨부 사진으로 CogVideoX 제출
- [ ] "3D 사진 영상" → 첨부 사진으로 3D Photo Inpainting 제출
