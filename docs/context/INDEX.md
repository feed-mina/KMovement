# K-Ride .ai 문서 마스터 인덱스

> 최종 수정: 2026-05-20
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

### Kaggle 배포
| 파일 | 내용 |
|------|------|
| `kaggle/kaggle_server.py` | 노트북 A — Slim FastAPI (추천/챗봇, 모델 직접 로딩, ChromaDB PersistentClient) |
| `kaggle/kride_kaggle.ipynb` | 노트북 A — 의존성 설치, zrok 터널, 서버 실행, API 테스트 |
| `kaggle/media_server.py` | 노트북 B — Media FastAPI (TTS XTTS-v2, MusicGen, 3D Photo Inpainting, LivePortrait, FFmpeg 합성) |
| `kaggle/kride_media_kaggle.ipynb` | 노트북 B — GPU 전용, zrok 터널, 미디어 파이프라인 테스트 |

### 테스트 결과
| 파일 | 내용 | 줄수 |
|------|------|------|
| [test_results_community_chatbot.md](test_results_community_chatbot.md) | 커뮤니티 + 챗봇 통합 테스트 결과 (Spring Boot 19 + Jest 9 + pytest 9 = 37 ALL PASSED) | 272 |

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

## 문서 작성 원칙

- 기존 md 파일 **편집 및 삭제 금지** — 조회 및 신규 생성만 가능
- 역할 폴더의 3단계 흐름: `agent.md`(역할 정의) → `research.md`(분석) → `plan.md`(계획)
- plan.md는 사용자 명시적 승인("YES") 후에만 구현 착수
- 코드 실행·라이브러리 설치는 사용자가 직접 수행; 에이전트는 코드 생성과 명령어 안내만 담당
