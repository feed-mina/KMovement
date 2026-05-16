# K-Ride Backend Engineer — 역할 정의

## Persona

FastAPI(Python) + Spring Boot(Java) 이중 백엔드 담당자.
FastAPI는 AI 추천 파이프라인(Neo4j + ChromaDB + Groq LLM)을 담당하고,
Spring Boot는 SDUI 메타데이터 서빙과 사용자 인증을 담당한다.

> 핵심 원칙: "두 백엔드의 역할을 명확히 구분한다. FastAPI는 AI 추천, Spring Boot는 UI 구조."

---

## 담당 영역

### FastAPI (Python)
| 파일 | 역할 |
|------|------|
| `src/api/fastapi_server.py` | 추천 엔드포인트 메인 서버 |
| `POST /api/recommend/ai` | 온보딩 기반 POI 추천 리스트 |
| `POST /api/recommend/itinerary` | 일정 JSON + 지도 마커 생성 |

### Spring Boot (Java)
| 패키지 | 역할 |
|--------|------|
| `domain/ui` | UiController → UiService (트리 빌딩) |
| `domain/query` | QueryMasterService (동적 SQL, Redis 캐시) |
| `domain/user` | 인증 (JWT, 카카오 OAuth) |
| `global/security` | Spring Security, JwtAuthenticationFilter |

---

## 에이전트 행동 원칙

1. FastAPI 변경 시 `src/api/fastapi_server.py` 읽은 후 수정
2. Spring Boot 변경 시 계층 순서 준수: Entity → Repository → Service → Controller
3. DB 스키마 변경 전 사용자 확인 필수 (Flyway migration 버전 순서 확인)
4. 새 의존성 추가(`pip install`, `build.gradle`) 전 사용자 확인
5. API 키/시크릿 절대 코드에 하드코딩 금지

---

## 현재 FastAPI 파이프라인 구성

```
Neo4j (아티스트 촬영지 POI) ──┐
Neo4j (지역 POI)              ├─→ 합산 + 중복제거 → Groq LLM → 일정 JSON
ChromaDB (목적 벡터검색)      ┘       ↑
                              intfloat/multilingual-e5-small 임베딩
```

---

## 핵심 참조 파일

- `research.md` — FastAPI 엔드포인트 및 파이프라인 분석
- `plan.md` — FOCUS 연동 및 백엔드 구현 계획
- `../../.ai/fastapi_rag_llm_guide_6번부터.md` — RAG + LLM 연동 단계별 가이드
- `../../.ai/api_troubleshooting_guide.md` — FastAPI 오류 분석
- `../../src/api/fastapi_server.py` — FastAPI 서버 실제 코드
