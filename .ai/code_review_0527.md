# 코드 리뷰 결과 — 2026-05-27

## 범위
프론트엔드 + 백엔드 + AI 모델 코드 전체 (커뮤니티 + 영상 모델링 연계)

---

## 프론트엔드 이슈 (metadata-project)

### HIGH
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| F1 | 이미지 업로드 크기/타입 미검증 | `CommunityPage.tsx` (414행) | 500MB+ 파일 업로드 가능, OOM 위험 |
| F2 | SSE 스트림 타임아웃 없음 | `useSSEStreamV2.ts` (25행) | 서버 응답 없으면 무한 대기 |
| F3 | 스케치 캔버스 640x480 고정 | `CommunityPage.tsx` | 모바일에서 잘림 |
| F4 | 마이크 권한 거부 무반응 | `AudioRecorder.tsx` | 사용자에게 피드백 없음 |

### MEDIUM
| # | 이슈 | 파일 |
|---|------|------|
| F5 | 한국어 감지 정규식 부정확 | `useAIChatLogic.ts` (140행) — 혼합 텍스트에서 오작동 |
| F6 | 멤버십 체크 에러 무시 | `AIChatComponentV2.tsx` (64행) — `.catch(() => {})` |
| F7 | axios 요청 타임아웃 미설정 | `communityService.ts` — 느린 네트워크에서 무한 대기 |

---

## 백엔드 이슈 (SDUI-server)

### CRITICAL
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| B1 | DTO 입력 검증 없음 | `PostCreateRequest.java` 등 | `@NotBlank`/`@Size` 누락 → XSS/리소스 고갈 |
| B2 | 파일 업로드 크기 제한 없음 | `SupabaseStorageService.java` (28행) | DoS 가능 |
| B3 | application.yml 하드코딩 비밀번호 | `application.yml` (12, 42, 61, 71행) | DB/메일/JWT/카카오 키 |
| B4 | 파일 타입 MIME 미검증 | `S3Service.java` (97행) | 확장자만 체크, .exe 등 허용 |

### HIGH
| # | 이슈 | 파일 |
|---|------|------|
| B5 | 커뮤니티 권한 체크 미흡 | Controllers — 관리자 오버라이드 없음, 차단 시스템 없음 |
| B6 | OpenAI 비용 임계값 경고만 | `OpenAiClient.java` (46행) — 서킷 브레이커 없음 |
| B7 | 에러 메시지 정보 노출 | Services — 상세 에러를 클라이언트에 반환 |

---

## AI 모델 이슈 (deploy/media_motion)

### 배포 준비 상태
| 모델 | 상태 | 블로커 |
|------|------|--------|
| AnimatedDrawings | ✅ Ready | Joint 검증 레이어 필요 (사용자 드로잉) |
| GPT-SoVITS TTS | ✅ Ready | 의존성 버전 핀닝 필수 (huggingface_hub==0.23.5 등) |
| CogVideoX | ⚠️ Partial | GPU 필수 (~4GB VRAM), CUDA 사전 빌드 필요 |
| 3D Photo Inpainting | ⚠️ Partial | 외부 명령 설정 필요, 별도 설치 |
| TorchServe | ❌ Blocked | GPU 이미지 레지스트리 미등록 |

### 핵심 이슈
| # | 이슈 | 설명 |
|---|------|------|
| M1 | TorchServe GPU 이미지 미빌드 | Artifact Registry에 없음 → in-process fallback 사용 중 |
| M2 | GPT-SoVITS 의존성 충돌 | Python 3.12 패치 + 6개 패키지 핀닝 필요 |
| M3 | AnimatedDrawings Joint 오류 | 사용자 드로잉에서 `right_shoulder` 등 누락 시 AssertionError |
| M4 | Kaggle OOM | 4개 모델 동시 로딩 시 커널 재시작 (CogVideoX 4GB + AD 2GB + TTS 2GB) |

### 미구현 (Phase 4)
- 커뮤니티 스케치 → AnimatedDrawings 엔드포인트
- 커뮤니티 사진 → 영상 생성 큐
- Job 상태 폴링 + 결과 다운로드

---

## 권장 우선순위

### P0 — 즉시 수정
1. B1: DTO 검증 어노테이션 추가
2. B2/F1: 파일 업로드 크기 제한 (클라이언트 10MB + 서버 50MB)
3. B3: application.yml 하드코딩 비밀번호 → 환경변수 only

### P1 — 배포 전
4. F2: SSE 타임아웃 30초 추가
5. B4: MIME 타입 검증 추가
6. F3: 스케치 캔버스 반응형

### P2 — 기능 추가 시
7. M3: AnimatedDrawings Joint 검증 + fallback 매트릭스
8. M2: GPT-SoVITS 격리 환경 (Docker/conda)
9. 커뮤니티 ↔ 모델 연동 엔드포인트

---

## KRIDE 챗봇 이슈 (2026-05-28 추가)

### CRITICAL
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| K3 | Groq 모델명 비표준 | `src/api/rag_client.py:9` | `"openai/gpt-oss-120b"` → Groq 표준 모델 아님 → `llama-3.3-70b-versatile`로 교체 필요 |

### HIGH
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| K1 | QA 비스트리밍 하드코딩 | `KrideChatService.java:127-132` | `handleQa()`가 AI 호출 없이 고정 문자열 반환 |
| K2 | 가짜 스트리밍 | `fastapi_server.py:1121-1136` | `generate_chat_answer()` 완료 후 단일 `yield` — 토큰 단위 스트리밍 아님 |
| K5 | Security 불일치 | `page.tsx:22` / `SecurityConfig.java:118` | `KRIDE_CHAT` 프론트 보호 vs 백엔드 `permitAll()` |
| K6 | budget 파라미터 누락 | 프론트~FastAPI 전체 체인 | `KrideForm.budget` 존재하나 전달 안 함, 항상 디폴트 사용 |

### MEDIUM
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| K4 | HAS_AI=False 정적 응답 | `fastapi_server.py:46-57` | AI 모듈 미로드 시 메시지 무관 고정 응답 |

### 수정 대상 파일 (8개)
1. `src/api/rag_client.py` — K2(스트리밍 함수), K3(모델명)
2. `src/api/fastapi_server.py` — K2(스트리밍 엔드포인트), K4(fallback)
3. `KrideChatService.java` — K1(QA AI 호출), K6(budget)
4. `FastApiChatClient.java` — K1(chatSync), K6(budget)
5. `ChatQueryRequest.java` — K6(budget 필드)
6. `SecurityConfig.java` — K5(authenticated)
7. `krideChat.ts` — K6(budget 타입)
8. `useKrideChatStream.ts` — K6(budget 빌더)

### 수정 계획 상세
→ `.claude/plans/wondrous-greeting-rossum.md` 참조

---

## KRIDE 챗봇 이슈 (2026-05-28 추가)

### CRITICAL
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| K3 | Groq 모델명 비표준 | `src/api/rag_client.py:9` | `"openai/gpt-oss-120b"` → Groq 표준 모델 아님, API 호출 실패 가능 → `llama-3.3-70b-versatile`로 교체 |

### HIGH
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| K1 | QA 비스트리밍 하드코딩 | `KrideChatService.java:127-132` | `handleQa()`가 AI 호출 없이 `"죄송합니다..."` 고정 문자열 반환 |
| K2 | 가짜 스트리밍 | `fastapi_server.py:1121-1136` | `generate_chat_answer()` 완료 후 단일 `yield` — 토큰 단위 스트리밍 아님 |
| K5 | Security 불일치 | Frontend `page.tsx:22` / `SecurityConfig.java:118` | `KRIDE_CHAT` 프론트 보호(로그인 필수) vs 백엔드 `permitAll()` — API 직접 호출로 우회 가능 |
| K6 | budget 파라미터 누락 | 프론트~FastAPI 전체 체인 | `KrideForm.budget` 존재하나 `buildRequest()` → `ChatQueryRequest` → `FastApiChatClient` 전달 안 함, 항상 디폴트(3만~200만) 사용 |

### MEDIUM
| # | 이슈 | 파일 | 설명 |
|---|------|------|------|
| K4 | HAS_AI=False 정적 응답 | `fastapi_server.py:46-57` | AI 모듈 import 실패 시 `generate_chat_answer = lambda: "K-Ride assistant is ready."` — 사용자 메시지와 무관한 고정 응답 |

### 수정 계획 (상세)
→ `.claude/plans/wondrous-greeting-rossum.md` 참조

### 수정 대상 파일 (11개)
1. `src/api/rag_client.py` — K2(스트리밍 함수 추가), K3(모델명 교체)
2. `src/api/fastapi_server.py` — K2(스트리밍 엔드포인트), K3(import), K4(fallback 개선)
3. `subproject/.../service/KrideChatService.java` — K1(QA AI 호출), K6(budget 전달)
4. `subproject/.../service/FastApiChatClient.java` — K1(chatSync 추가), K6(budget 파라미터)
5. `subproject/.../dto/ChatQueryRequest.java` — K6(budget 필드)
6. `subproject/.../config/SecurityConfig.java` — K5(authenticated로 변경)
7. `metadata-project/lib/types/krideChat.ts` — K6(budget 타입)
8. `metadata-project/lib/hooks/useKrideChatStream.ts` — K6(budget 빌더), F2(30초 타임아웃)
9. `metadata-project/services/axios.tsx` — F7(timeout: 15000)
10. `metadata-project/components/community/CommunityPage.tsx` — F1(10MB 크기 제한)

### [완료] 수정 적용 — 2026-05-28
- K3 ✅ Groq 모델명 `llama-3.3-70b-versatile`로 교체
- K2 ✅ `generate_chat_answer_stream()` + SSE 포맷(`data: {"content":"..."}\n\n` + `[DONE]`)
- K1 ✅ `handleQa()` → `fastApiClient.chatSync()` + FastAPI `/api/chat/qa` 엔드포인트
- K5 ✅ `permitAll()` → `authenticated()`
- K6 ✅ budget 파라미터 프론트~Spring~FastAPI 전체 체인 관통
- F2 ✅ SSE 스트림 30초 AbortController 타임아웃
- F7 ✅ axios 인스턴스 timeout: 15000
- F1 ✅ 이미지 업로드 10MB 크기 제한 + 사용자 알림
- K4 ✅ HAS_AI=False fallback: 사용자 질문 에코 + "AI 서비스 준비 중" 메시지

### [완료] 추가 수정 적용 — 2026-05-29
- F3 ✅ 스케치 캔버스 반응형 (640x480 고정 → `window.innerWidth` 기반 4:3 비율)
- F4 ⏭️ 이미 구현됨 (`useAudioRecorder.ts:52-54` alert 피드백 존재)
- F5 ✅ 한국어 감지 정규식 수정 (`/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/` → `/[ㄱ-ㅎㅏ-ㅣ가-힣]/`)
- F6 ✅ 멤버십 체크 에러 무시 → `console.error` 로깅 추가
- B1 ✅ DTO 검증 어노테이션 (`@NotBlank`, `@Size`, `@Valid`) — PostCreateRequest, PostUpdateRequest, ReportRequest + 컨트롤러
- B2 ✅ Supabase 업로드 10MB 크기 제한 + S3 이력서 50MB 크기 제한
- B4 ✅ MIME 타입 검증 — Supabase(이미지만), S3(PDF+이미지만)
- B5 ⏭️ 이미 구현됨 (`CommunityPostService.updatePost/deletePost`에서 작성자 확인)
- B7 ✅ 에러 메시지 정보 노출 방지 — NPE/Generic Exception 에서 상세 메시지 제거

### [완료] B3 + B6 수정 적용 — 2026-05-29
- B3 ✅ application.yml 하드코딩 비밀번호 → `${ENV_VAR:default}` 패턴 전환 (DB, Mail, JWT, Kakao, FastAPI)
  - ⚠️ Gmail 앱 비밀번호(`xbfk...`)는 Git 히스토리에 노출됨 → Google 계정에서 로테이션 필요
- B6 ✅ OpenAI Resilience4j 서킷 브레이커 + 비용 차단
  - `build.gradle`: resilience4j-spring-boot3 + spring-boot-starter-aop 의존성 추가
  - `application.yml`: resilience4j circuitbreaker + ratelimiter 설정 (openai 인스턴스)
  - `OpenAiClient.java`: `@CircuitBreaker` + `@RateLimiter` + `checkCostLimit()` + fallback 메서드
  - `OpenAiClientV2.java`: 동일 패턴 적용 (STT, Chat, TTS, Translate, Expression 전체)
  - `rag_client.py`: Python 자체 CircuitBreaker 클래스 구현 (Groq API 4개 함수 보호)

### 잔여 참고사항
- B3 Gmail 앱 비밀번호 로테이션은 Google 계정에서 수동 처리 필요
- Resilience4j 설정 튜닝: `failure-rate-threshold`, `wait-duration-in-open-state` 등 운영 중 조정 가능
