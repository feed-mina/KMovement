# 커뮤니티 ↔ 모델 연동 + TorchServe GPU 이미지 배포

> 최종 수정: 2026-05-29 — Phase 1~4 구현 완료, .mar 빌드 및 배포 완료, GCP 인프라 디버깅 완료

---

## 전체 작업 타임라인

### Phase 1: 커뮤니티 ↔ AnimatedDrawings 연동 (첫 커밋)

**커밋**: `46ae39e8` — `feat: 커뮤니티 스케치 → 애니메이션 연동 → TorchServe GPU 배포 설정`

| 단계 | 작업 | 상태 |
|------|------|------|
| A1 | RunPod `animated_drawings_worker` 라우트 추가 | ✅ |
| A2 | V55 `community_animation_jobs` 마이그레이션 | ✅ |
| A3 | Spring Backend API 4개 파일 (Controller/Service/Entity/Repository) | ✅ |
| A4 | 프론트엔드 "애니메이션 만들기" 버튼 + 3초 폴링 | ✅ |
| A5 | Cloud Gateway — 변경 불필요 (이미 구현됨) | ✅ |
| B4 | deploy-gcp.yml TorchServe 컨테이너 + `TORCHSERVE_ENABLED=true` | ✅ |

### Phase 2: 영상 생성 route 분기 (CogVideoX / 3D Photo 추가)

**커밋**: `e786f963` + `fdb9fc4c` — `feat: 영상 생성 route 분기 (스케치/CogVideoX/3D Photo)`

| 작업 | 내용 | 상태 |
|------|------|------|
| AnimationService route 지원 | `ALLOWED_ROUTES` 검증 (3개: animated_drawings, cogvideox_real, 3d_photo_inpainting_real) | ✅ |
| AnimationController route 파라미터 | `body.get("route")` 수신, 기본값 `animated_drawings_worker` | ✅ |
| communityService.ts | `submitAnimation(postId, imageBase64, route)` | ✅ |
| CommunityPage.tsx | "영상 만들기" → 3개 옵션 모달 (스케치/AI영상/3D사진) | ✅ |
| runpod_handler.py | `3d_photo_inpainting_real` 라우트 + import 추가 | ✅ |

**영상 생성 분기 구조**:
```
게시글 상세 → "영상 만들기" 클릭
    └─ 모달: 3개 옵션
         ├─ 스케치 애니메이션     → localStorage 스케치 → route: animated_drawings_worker
         ├─ AI 영상 생성          → 첨부 사진 1번째    → route: cogvideox_real
         └─ 3D 사진 영상          → 첨부 사진 1번째    → route: 3d_photo_inpainting_real
              ↓
    POST /api/v1/community/posts/{postId}/animate { imageBase64, route }
              ↓
    AnimationService → Cloud Gateway /jobs/runpod → RunPod 제출
              ↓
    3초 폴링 GET /animate/status → 완료 시 <video> 인라인 재생
```

### Phase 3: TorchServe .mar 빌드 및 배포

**커밋**: `efb8a5ac` — `chore: TorchServe .mar 파일 3개 추가` (GCP VM에서 커밋)

| 작업 | 내용 | 상태 |
|------|------|------|
| GCP VM 레포 클론 | `git clone` → `~/kride-project` | ✅ |
| python3-venv 설치 | `sudo apt install python3.11-venv` | ✅ |
| torch-model-archiver 설치 | `pip install torch-model-archiver torch` | ✅ |
| .mar 빌드 | `bash package_models.sh` → 3개 생성 | ✅ |
| Git 푸시 | `git add -f *.mar` → GitHub PAT(repo 권한) 사용 | ✅ |
| GitHub Actions 자동 빌드 | `torchserve/` 변경 감지 → Docker 빌드 & Artifact Registry 푸시 | ✅ 트리거됨 |

**.mar 빌드 결과**:
```
embedder.mar   — 1.3KB (핸들러만, 런타임 HuggingFace 다운로드)
reranker.mar   — 1.2KB (핸들러만, 런타임 HuggingFace 다운로드)
event_ner.mar  — 1.5KB (핸들러만, 런타임 다운로드)
weather_lstm   — SKIP (가중치 파일 models/dl/weather_lstm.pt 없음)
```

### Phase 3.5: 빌드 에러 수정

**커밋**: `fix: startAnimPolling 선언 순서 수정`

- **문제**: `CommunityPage.tsx`에서 `startAnimPolling`이 선언 전에 `useEffect`에서 사용됨 → TypeScript 컴파일 에러
- **해결**: `useCallback(startAnimPolling)`을 `useEffect`보다 위로 이동
- **원인**: block-scoped variable (`const`)는 hoisting 안 됨

### Phase 4: Nginx 라우팅 수정 + GCP 인프라 디버깅

#### 4-1. Nginx `/api/kride/` 라우팅 수정

**문제**: `https://yerin.duckdns.org/api/kride/recommend/itinerary` 요청이 Spring Boot(8080)로 가서 404
**원인**: Nginx `location /api/` 규칙이 `/api/kride/`도 매칭. Next.js(3000)로 가야 하는데 Spring Boot로 프록시됨
**해결**: `/api/kride/` location 블록을 `/api/` 보다 먼저 배치 (longer prefix 우선 매칭)
**수정 파일**:
- `.github/workflows/deploy-ec2.yml` — Nginx config에 `/api/kride/` → `localhost:3000` 추가
- `.github/workflows/ec2-fix-ssl.yml` — 동일 수정

#### 4-2. GCP FastAPI 빈 itinerary 디버깅

**증상**: `POST /api/recommend/itinerary` → `{"itinerary":[],"mapData":{"markers":[]},"source_pois":[]}`

**FastAPI 로그 분석 결과 — 4가지 실패 원인:**

| # | 실패 항목 | 에러 메시지 | 원인 |
|---|----------|------------|------|
| 1 | Neo4j (artist_pois, region_pois) | `Failed to DNS resolve address e6e5a79c.databases.neo4j.io:7687` | Neo4j Aura 인스턴스 만료/삭제 |
| 2 | ChromaDB | `chroma_pois: 0건` | 데이터 미적재 또는 쿼리 불일치 |
| 3 | Supabase fallback | `[Errno -2] Name or service not known` | Docker 내부 DNS 해석 실패 |
| 4 | Groq (itinerary 생성) | `Error code: 401 - Invalid API Key` | API Key 무효 |

#### 4-3. Neo4j Aura 인스턴스 변경

- **기존**: `e6e5a79c.databases.neo4j.io` → DNS 해석 불가 (삭제/만료)
- **신규**: `a1880d39.databases.neo4j.io` → ping 성공 확인
- **조치**: GitHub Secrets `NEO4J_URI` 값을 `neo4j+s://a1880d39.databases.neo4j.io`로 변경 ✅

#### 4-4. GCP VM Docker DNS 설정

**문제**: Docker 컨테이너 내부에서 외부 도메인(neo4j.io, supabase.co 등) DNS 해석 실패
**원인**: GCP VM의 `/etc/resolv.conf`가 메타데이터 DNS(`169.254.169.254`)만 사용
**해결**: `/etc/docker/daemon.json`에 Google DNS 추가

```json
{
    "runtimes": {
        "nvidia": {
            "args": [],
            "path": "nvidia-container-runtime"
        }
    },
    "dns": ["8.8.8.8", "8.8.4.4"]
}
```

- `sudo systemctl restart docker` → 컨테이너 재생성 필요
- **결과**: 호스트 자체에서는 DNS 정상 (`google.com`, `databases.neo4j.io` ping 성공), 다만 `e6e5a79c` 서브도메인은 인스턴스 삭제로 불가

#### 4-5. deploy-gcp.yml TorchServe 빌드 개선

**문제**: TorchServe GPU 이미지가 Artifact Registry에 미등록 → `docker compose pull` 전체 실패 → FastAPI 등 모든 서비스 배포 불가
**해결**:
1. `--ignore-pull-failures` 추가 — TorchServe pull 실패해도 나머지 서비스 배포 계속
2. TorchServe 변경 감지 로직 개선 — Registry에 이미지 없으면 무조건 빌드
3. `TORCHSERVE_FALLBACK=true`로 TorchServe 없어도 CPU 자동 전환

**docker-compose.prod.yml 위치**: `/home/Samsung/kride/docker-compose.prod.yml` (GitHub Actions가 생성)

#### 4-6. 미완료 — 재배포 진행 중

- GitHub Secrets 업데이트 완료: `NEO4J_URI` ✅
- deploy-gcp.yml 수정 완료 (로컬, 커밋/푸시 대기)
- GitHub Actions "Deploy AI Services to GCP" 수동 실행 시도 → "Failed to queue" 발생
- **다음**: deploy-gcp.yml 커밋 & push → 자동 트리거로 재배포

---

## Context (배경)

커뮤니티 페이지에 스케치 캔버스 UI가 존재하고, AnimatedDrawings 워커도 구현되어 있으나 **연결이 안 된 상태**. TorchServe는 Dockerfile/핸들러가 존재하지만 `.mar` 미생성, Artifact Registry 미등록. CPU fallback으로 동작 중.

// [메모] CPU fallback 어떻게 동작하는지 추가로 확인 필요
> **[조사 완료]** `src/api/torchserve_client.py`에 2단계 제어:
> - `TORCHSERVE_ENABLED=false` → TorchServe 건너뛰고 즉시 로컬 CPU 모델 사용
> - `TORCHSERVE_FALLBACK=true` → TorchServe 장애 시 자동으로 CPU 전환 (silent)
> - 4개 모델(embedder, reranker, weather_lstm, event_ner) 모두 dual path 구현
> - 현재 배포: `TORCHSERVE_ENABLED=false` (항상 CPU). 로컬 모델은 lazy-load.
> - 상세: `.ai/research.md` 참조

// [메모] user테이블과 조인 가능하게끔 user_id 추가 또는 user 테이블과 animation 테이블을 같이 묶는 테이블 추가하기
> **[조사 완료]** `community_post.author_sqno → users.user_sqno` 이미 존재.
> 별도 `user_id` 불필요 — `post_id`로 조인 가능.

---

## 변경된 파일 총 목록 (14개)

### Python (RunPod)
1. `deploy/media_motion/runpod_handler.py` — animated_drawings + 3d_photo_inpainting_real 라우트, import, handler 분기

### SQL (마이그레이션)
2. `SDUI-server/.../db/migration/V55__community_animation_jobs.sql` — 신규 테이블

### Java (Spring Boot)
3. `domain/community/domain/AnimationJob.java` — JPA 엔티티 (신규)
4. `domain/community/domain/AnimationJobRepository.java` — Spring Data JPA (신규)
5. `domain/community/service/AnimationService.java` — RunPod 제출 + 상태 폴링 + route 분기 (신규)
6. `domain/community/controller/AnimationController.java` — REST API + route 파라미터 (신규)

### TypeScript (Next.js)
7. `metadata-project/services/communityService.ts` — submitAnimation(route), getAnimationStatus
8. `metadata-project/components/community/CommunityPage.tsx` — 3개 옵션 모달, 폴링, 영상 재생

### GitHub Actions
9. `.github/workflows/deploy-gcp.yml` — TorchServe 빌드 개선 + pull 실패 허용 + TORCHSERVE_ENABLED=true
10. `.github/workflows/deploy-ec2.yml` — Nginx `/api/kride/` → Next.js 라우팅 추가
11. `.github/workflows/ec2-fix-ssl.yml` — Nginx `/api/kride/` → Next.js 라우팅 추가

### TorchServe (.mar)
12. `torchserve/embedder.mar` — 임베딩 모델 핸들러
13. `torchserve/reranker.mar` — 리랭킹 모델 핸들러
14. `torchserve/event_ner.mar` — 이벤트 분류 핸들러

---

## 미디어 모델 현황

| 모델 | 역할 | GPU 필요 | RunPod | GCP | Fallback |
|------|------|----------|--------|-----|----------|
| **AnimatedDrawings** | 스케치 → 캐릭터 애니메이션 | CPU (OSMesa) | ✅ | 환경변수 필요 | 없음 |
| **CogVideoX** | 사진 → AI 시네마틱 영상 | GPU (CUDA) | ✅ | GPU 필요 | ffmpeg pan/zoom |
| **3D Photo Inpainting** | 사진 → 3D 깊이 영상 | 외부 커맨드 | ✅ | 설치 필요 | ffmpeg zoompan |
| **GPT-SoVITS** | 텍스트 → 한국어 음성 | GPU 선호 | ✅ | 설치 필요 | gTTS |
| **MusicGen** | 텍스트 → BGM | GPU 필수 | ✅ | 설치 필요 | 사인파 BGM |

### TorchServe 모델 (ML 추론, 별도 파이프라인)

| 모델 | .mar | 상태 | 비고 |
|------|------|------|------|
| `embedder` | ✅ 생성 | 런타임 HF 다운로드 | intfloat/multilingual-e5-small |
| `reranker` | ✅ 생성 | 런타임 HF 다운로드 | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| `event_ner` | ✅ 생성 | 런타임 HF 다운로드 | zero-shot classification |
| `weather_lstm` | ❌ SKIP | 가중치 파일 없음 | models/dl/weather_lstm.pt 필요 |

---

## 트러블슈팅 기록

### 1. GCP VM 디스크 부족 (git clone 실패)
- **증상**: `fatal: write error: No space left on device`
- **해결**: `docker system prune -af` → 12GB→17GB 확보
- **참고**: NVIDIA installer (300MB) 삭제도 가능하나 미실시

### 2. python3-venv 미설치
- **증상**: `ensurepip is not available`
- **해결**: `sudo apt install python3.11-venv -y`

### 3. .gitignore에서 .mar 차단
- **증상**: `git add *.mar` → `The following paths are ignored`
- **해결**: `git add -f *.mar` (강제 추가)

### 4. GitHub PAT 권한 부족
- **증상**: `remote: Permission denied` / `403`
- **해결**: PAT 재생성 시 `repo` 체크박스 선택

### 5. Docker 빌드 디스크 부족
- **증상**: `no space left on device` (TorchServe GPU 이미지 10GB+)
- **해결**: Docker 빌드를 GitHub Actions에 위임 (방법 B)

### 6. startAnimPolling 선언 순서 에러
- **증상**: `Block-scoped variable 'startAnimPolling' used before its declaration`
- **해결**: `useCallback` 선언을 `useEffect`보다 위로 이동

### 7. git push rejected (non-fast-forward)
- **증상**: GCP VM 커밋이 먼저 push되어 로컬 브랜치가 뒤처짐
- **해결**: `git pull origin main` 후 `git push`

### 8. Nginx `/api/kride/` → Spring Boot 404
- **증상**: `/api/kride/recommend/itinerary` → Spring Boot 404 (Next.js로 가야 함)
- **원인**: Nginx `location /api/`이 `/api/kride/`도 매칭
- **해결**: `/api/kride/` location 블록 추가 (longer prefix 우선 매칭)

### 9. Neo4j Aura 인스턴스 만료
- **증상**: `Failed to DNS resolve address e6e5a79c.databases.neo4j.io` → POI 0건
- **원인**: Free tier 인스턴스 자동 삭제/만료
- **해결**: 새 인스턴스 `a1880d39.databases.neo4j.io` 확인, GitHub Secrets `NEO4J_URI` 업데이트

### 10. GCP Docker DNS 해석 실패
- **증상**: 컨테이너 내부에서 외부 도메인(neo4j.io, supabase.co) 해석 불가
- **원인**: `/etc/resolv.conf`가 GCP 메타데이터 DNS(`169.254.169.254`)만 사용
- **해결**: `/etc/docker/daemon.json`에 `"dns": ["8.8.8.8", "8.8.4.4"]` 추가 후 Docker 재시작

### 11. TorchServe 이미지 미등록으로 전체 배포 실패
- **증상**: `docker compose pull` → TorchServe 이미지 not found → 전체 실패
- **해결**: `--ignore-pull-failures` 추가 + Registry에 이미지 없으면 자동 빌드 로직 추가

### 12. docker-compose.prod.yml 위치 혼동
- **증상**: `~/kride/docker-compose.prod.yml` not found
- **원인**: GitHub Actions가 다른 사용자(`Samsung`)로 SSH 접속하여 `/home/Samsung/kride/`에 생성
- **해결**: `docker compose ls`로 실제 경로 확인 → `/home/Samsung/kride/docker-compose.prod.yml`

---

## 향후 과제

| 과제 | 내용 | 우선순위 |
|------|------|----------|
| **deploy-gcp.yml 커밋 & push** | TorchServe 빌드 개선 + pull 실패 허용 → 자동 재배포 트리거 | **긴급** |
| **Groq API Key 확인/갱신** | FastAPI 로그에서 401 Invalid API Key → GitHub Secrets 확인 | **긴급** |
| **Supabase 연결 확인** | DNS는 해결됐으나 Supabase URL/Key 유효성 확인 필요 | **높음** |
| **ChromaDB 데이터 적재** | `chroma_pois: 0건` — 데이터 없거나 collection 불일치 | **높음** |
| 3D Photo Inpainting 실제 배포 | GCP VM에 `vt-vl-lab/3d-photo-inpainting` 설치 + `KRIDE_3D_PHOTO_COMMAND` 설정 | 중 |
| weather_lstm .mar | `models/dl/weather_lstm.pt` 가중치 확보 후 재빌드 | 낮 |
| DB 백업 보호 | pg_dump 크론잡 또는 Supabase 자동 백업 | 중 |
| 완료 알림 전송 | 카카오 알림톡 / Slack / Discord Webhook | 낮 |
| TorchServe 첫 요청 지연 | Docker 빌드 시 HuggingFace 모델 사전 다운로드 (warm cache) | 낮 |

---

## 관련 문서

- `.ai/research.md` — 메모 조사 결과 (CPU fallback, user-animation 조인 등)
- `.ai/gcp_model_setup_guide.md` — GCP VM TorchServe/3D Photo 설치 가이드
- `.ai/INDEX.md` — 전체 문서 인덱스
