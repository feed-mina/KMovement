# K-Ride .ai 문서 마스터 인덱스

> 최종 수정: 2026-05-29
> kride-project 루트 `.ai` 폴더의 모든 문서 위치와 역할을 안내합니다.
> 기존 파일은 편집 없이 유지됩니다. 역할 기반 구조는 신규 생성된 하위 폴더를 참조하세요.

---

## 역할 기반 문서 (신규 — 2026-05-16 생성)

각 역할 폴더는 `agent.md → research.md → plan.md` 3단계 구조를 따릅니다.

### Architect
| 파일 | 내용 |
|------|------|
| [architect/agent.md](architect/agent.md) | K-Ride MSA 아키텍트 역할 정의 |
| [architect/research.md](architect/research.md) | MSA 3서비스 구조 분석 (kride ML + SDUI Spring Boot + FastAPI) |
| [architect/plan.md](architect/plan.md) | 전체 시스템 개선 계획 및 FOCUS 연동 로드맵 |

### Backend Engineer
| 파일 | 내용 |
|------|------|
| [backend_engineer/agent.md](backend_engineer/agent.md) | FastAPI + Spring Boot 백엔드 담당 역할 정의 |
| [backend_engineer/research.md](backend_engineer/research.md) | FastAPI 엔드포인트 분석, Neo4j/ChromaDB/Groq LLM 파이프라인 |
| [backend_engineer/plan.md](backend_engineer/plan.md) | FOCUS 화면 FastAPI 연동 구현 계획 |

### Frontend Engineer (SDUI)
| 파일 | 내용 |
|------|------|
| [frontend_engineer/agent.md](frontend_engineer/agent.md) | SDUI DynamicEngine 전문가 역할 정의 |
| [frontend_engineer/research.md](frontend_engineer/research.md) | 온보딩 화면 흐름 분석, 컴포넌트 현황 |
| [frontend_engineer/plan.md](frontend_engineer/plan.md) | SDUI 화면 구현 계획 및 남은 작업 |

### AI Engineer (ML/DL/RAG)
| 파일 | 내용 |
|------|------|
| [ai_engineer/agent.md](ai_engineer/agent.md) | K-Ride AI/ML 엔지니어 역할 정의 |
| [ai_engineer/research.md](ai_engineer/research.md) | 모델 현황 (6종), 데이터 범위, RAG 파이프라인 분석 |
| [ai_engineer/plan.md](ai_engineer/plan.md) | AI 개선 로드맵 (모델 고도화, 전국화) |

### QA Engineer
| 파일 | 내용 |
|------|------|
| [qa_engineer/agent.md](qa_engineer/agent.md) | K-Ride QA 엔지니어 역할 정의 |
| [qa_engineer/research.md](qa_engineer/research.md) | 테스트 전략 및 검증 항목 |
| [qa_engineer/plan.md](qa_engineer/plan.md) | QA 계획 및 체크리스트 |

---

## 기존 문서 (편집 없이 유지)

### AI/ML 핵심 문서
| 파일 | 내용 | 줄수 |
|------|------|------|
| [agent.md](agent.md) | AI 에이전트 작업 규칙, 데이터 원칙, 모델 현황 (2026-04-27 최신) | 300 |
| [new_research.md](new_research.md) | K-Ride 2.0 리서치 로그 — 전체 데이터 수집·모델링 히스토리 | 1,499 |
| [project_status_and_plan.md](project_status_and_plan.md) | K-Ride 2.0 현재 상황 분석 & 신규 기획의도 (2026-04-28) | 284 |
| [fastapi_rag_llm_guide_6번부터.md](fastapi_rag_llm_guide_6번부터.md) | FastAPI + RAG + LLM 연동 단계별 가이드 | 928 |
| [guide_ollama_rag.md](guide_ollama_rag.md) | 초보자용 Ollama + RAG 구성 가이드 | 553 |
| [api_troubleshooting_guide.md](api_troubleshooting_guide.md) | FastAPI 테스트 및 실행 오류 분석 | 117 |

### SDUI/프론트엔드 문서
| 파일 | 내용 | 줄수 |
|------|------|------|
| [kride_sdui_screen.md](kride_sdui_screen.md) | SDUI 화면 구현 현황 (Phase 1~4, FastAPI 연동 현황) | 232 |
| [V48__kride_consolidated.sql](V48__kride_consolidated.sql) | V40~V47 통합 멱등 마이그레이션 (pgAdmin 직접 실행) | — |
| [V49__kride_flex_layout.sql](V49__kride_flex_layout.sql) | artist_grid·region_grid flex-wrap 전환 (pgAdmin 직접 실행) | — |
| [kride2.md](kride2.md) | KRIDE 온보딩 화면 UI 구현 현황 (초기 기록) | 378 |
| [sdui_kride.md](sdui_kride.md) | K-Ride PWA 프론트엔드 구현 계획 (SDUI MSA 통합) | 442 |
| [ai-foamy-sparkle.md](ai-foamy-sparkle.md) | K-Ride PWA 구현 계획 (SDUI 통합) | 347 |

### 인프라/아키텍처 문서
| 파일 | 내용 | 줄수 |
|------|------|------|
| [architecture_expand_0520.md](architecture_expand_0520.md) | TorchServe + Celery 아키텍처 설명 (비동기 큐, GPU 서빙, GCP 배포 전략) | 115 |
| [animated_drawings_deployment_runbook.md](animated_drawings_deployment_runbook.md) | AnimatedDrawings 배포 가이드 (Joint 검증, OOM 방지, Fallback 매트릭스) | — |
| [0520_expand_gcp_deploy.md](0520_expand_gcp_deploy.md) | GCP VM 확장 배포 계획 | — |

### EC2 배포 (2026-05-27 추가)
| 파일 | 내용 |
|------|------|
| `.github/workflows/deploy-ec2.yml` | Spring Boot + Next.js + Nginx 배포 (변경 감지, Docker Hub) |
| `.github/workflows/ec2-diagnose.yml` | EC2 진단 및 컨테이너 복구 (workflow_dispatch) |
| `subproject/SDUI/metadata-project/Dockerfile` | Next.js multi-stage standalone 빌드 |

### AI 모델 워커 (`deploy/media_motion/`)
| 파일 | 모델 | 상태 |
|------|------|------|
| `animated_drawings_worker.py` | AnimatedDrawings | Ready |
| `gpt_sovits_worker.py` | GPT-SoVITS TTS | Ready (의존성 핀닝 필수) |
| `cogvideox_real.py` | CogVideoX Image-to-Video | Partial (GPU 필요) |
| `three_d_photo_real.py` | 3D Photo Inpainting | Partial (외부 명령 필요) |
| `cogvideo_fallback.py` | CogVideoX Fallback | Ready (FFmpeg) |
| `three_d_photo_light.py` | 3D Photo Light | Ready (FFmpeg) |
| `tts.py` | gTTS Fallback | Ready |

### Kaggle 배포
| 파일 | 내용 |
|------|------|
| `kaggle/kaggle_server.py` | 노트북 A — Slim FastAPI (추천/챗봇, 모델 직접 로딩, ChromaDB PersistentClient) |
| `kaggle/kride_kaggle.ipynb` | 노트북 A — 의존성 설치, zrok 터널, 서버 실행, API 테스트 |
| `kaggle/media_server.py` | 노트북 B — Media FastAPI (TTS, MusicGen, 3D Photo Inpainting, FFmpeg 합성) |
| `kaggle/kride_media_kaggle.ipynb` | 노트북 B — GPU 전용, zrok 터널, 미디어 파이프라인 테스트 |

### 미디어 프리뷰 서버 (`deploy/cloud_gateway/`)
| 파일 | 내용 |
|------|------|
| `app.py` | Read-only FastAPI (미디어 에셋 서빙, /manifest.json, /media/{id}) |
| `Dockerfile` | python:3.11-slim, 포트 7860 |

### 커뮤니티 ↔ 모델 연동 + TorchServe (2026-05-29)
| 파일 | 내용 |
|------|------|
| [0529_TorchServer&community.md](0529_TorchServer&community.md) | 커뮤니티 스케치→애니메이션 연동 + TorchServe GPU 배포 계획 |
| [research.md](research.md) | 메모 조사 결과 (CPU fallback, user-animation 조인 등) |

### 테스트 & 리뷰 결과
| 파일 | 내용 | 줄수 |
|------|------|------|
| [test_results_community_chatbot.md](test_results_community_chatbot.md) | 커뮤니티 + 챗봇 통합 테스트 결과 (Spring Boot 19 + Jest 9 + pytest 9 = 37 ALL PASSED) | 272 |
| [code_review_0527.md](code_review_0527.md) | 프론트+백엔드+AI 모델 전체 코드 리뷰 — K1~K6, F1~F7, B1~B7 **[전체 수정 완료 2026-05-29]** | — |
| [issues_0529.md](issues_0529.md) | 미해결 이슈 — 구글 캘린더 OAuth + BTS 광화문 점검 (G1~G6) | — |

### 환경/설정 문서
| 파일 | 내용 | 줄수 |
|------|------|------|
| [kride.md](kride.md) | Firebase & 환경 설정 문서 | 1,283 |
| [guide.md](guide.md) | 초기 프로젝트 기획 | 62 |

---

## 참조: SDUI 프로젝트 .ai 구조

SDUI 서브프로젝트의 역할 기반 문서:
- `subproject/SDUI/.ai/INDEX.md` — SDUI .ai 마스터 인덱스
- `subproject/SDUI/.ai/architect/` — SDUI 아키텍처 설계
- `subproject/SDUI/.ai/backend_engineer/` — Spring Boot 백엔드
- `subproject/SDUI/.ai/frontend_engineer/` — DynamicEngine 컴포넌트
- `subproject/SDUI/.ai/qa_engineer/` — SDUI 테스트 전략
- `subproject/SDUI/.ai/maintenance/` — 배포/디버깅 가이드

---

## 변경 이력 (2026-05-29 코드 리뷰 수정)

`code_review_0527.md`에서 발견된 전체 이슈에 대한 수정이 완료되었습니다.

### KRIDE 챗봇 (K1~K6) — 10개 파일
| 이슈 | 상태 | 핵심 변경 |
|------|------|-----------|
| K3 Groq 모델명 | ✅ | `rag_client.py` — `llama-3.3-70b-versatile` |
| K2 진짜 SSE 스트리밍 | ✅ | `rag_client.py` + `fastapi_server.py` — `stream=True` + SSE 포맷 |
| K1 QA→FastAPI | ✅ | `FastApiChatClient.chatSync()` + `/api/chat/qa` 엔드포인트 |
| K5 Security 인증 | ✅ | `SecurityConfig.java` — `permitAll()` → `authenticated()` |
| K6 budget 체인 | ✅ | TS 타입 → buildRequest → Java DTO → Client → Service |
| K4 fallback 개선 | ✅ | "AI 서비스 준비 중" + 질문 에코 |

### 프론트엔드 (F1~F7)
| 이슈 | 상태 | 핵심 변경 |
|------|------|-----------|
| F1 이미지 크기 제한 | ✅ | `CommunityPage.tsx` — 10MB 필터 + alert |
| F2 SSE 타임아웃 | ✅ | `useKrideChatStream.ts` — 30초 AbortController |
| F3 스케치 반응형 | ✅ | `CommunityPage.tsx` — `window.innerWidth` 기반 4:3 |
| F4 마이크 권한 | ⏭️ | 이미 구현됨 (`useAudioRecorder.ts:52-54`) |
| F5 한국어 정규식 | ✅ | `useAIChatLogic.ts` — `\|` 제거 |
| F6 멤버십 에러 | ✅ | `AIChatComponentV2.tsx` — `console.error` 추가 |
| F7 axios 타임아웃 | ✅ | `axios.tsx` — `timeout: 15000` |

### 백엔드 (B1~B7)
| 이슈 | 상태 | 핵심 변경 |
|------|------|-----------|
| B1 DTO 검증 | ✅ | `@NotBlank`/`@Size`/`@Valid` — 3개 DTO + 2개 컨트롤러 |
| B2 업로드 크기 | ✅ | Supabase 10MB + S3 50MB 서버 검증 |
| B3 비밀번호 환경변수 | ✅ | `application.yml` — `${ENV_VAR:default}` 패턴 전환 |
| B4 MIME 검증 | ✅ | Supabase(이미지) + S3(PDF+이미지) |
| B5 커뮤니티 권한 | ⏭️ | 이미 구현됨 (작성자 확인 로직 존재) |
| B6 서킷 브레이커 | ✅ | OpenAI: Resilience4j / Groq: Python CircuitBreaker |
| B7 에러 노출 방지 | ✅ | `GlobalExceptionHandler` — 상세 메시지 제거 |

### 수정된 파일 총 목록 (22개)
**FastAPI (Python)**
1. `src/api/rag_client.py` — K2, K3, B6-Groq
2. `src/api/fastapi_server.py` — K2, K4

**Spring Boot (Java)**
3. `KrideChatService.java` — K1, K6
4. `FastApiChatClient.java` — K1, K6
5. `ChatQueryRequest.java` — K6
6. `SecurityConfig.java` — K5
7. `PostCreateRequest.java` — B1
8. `PostUpdateRequest.java` — B1
9. `ReportRequest.java` — B1
10. `CommunityPostController.java` — B1
11. `PostReportController.java` — B1
12. `SupabaseStorageService.java` — B2, B4
13. `S3Service.java` — B2, B4
14. `GlobalExceptionHandler.java` — B7
15. `OpenAiClient.java` — B6
16. `OpenAiClientV2.java` — B6
17. `build.gradle` — B6 (resilience4j)
18. `application.yml` — B3, B6

**Next.js (TypeScript)**
19. `krideChat.ts` — K6
20. `useKrideChatStream.ts` — K6, F2
21. `useAIChatLogic.ts` — F5
22. `AIChatComponentV2.tsx` — F6
23. `CommunityPage.tsx` — F1, F3
24. `axios.tsx` — F7

---

## 문서 작성 원칙

- 기존 md 파일 **편집 및 삭제 금지** — 조회 및 신규 생성만 가능
- 역할 폴더의 3단계 흐름: `agent.md`(역할 정의) → `research.md`(분석) → `plan.md`(계획)
- plan.md는 사용자 명시적 승인("YES") 후에만 구현 착수
- 코드 실행·라이브러리 설치는 사용자가 직접 수행; 에이전트는 코드 생성과 명령어 안내만 담당
