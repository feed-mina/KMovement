# K-Ride 역할별 AI 에이전트 Persona 정의

> K-Ride 프로젝트에서 AI 에이전트가 맡는 역할을 정의합니다.
> 각 역할은 독립적으로 작동하되, 공통 원칙을 따릅니다.

---

## 공통 원칙

| 규칙 | 내용 |
|------|------|
| 코드 실행 | 에이전트는 실행하지 않음. 명령어를 텍스트로 안내하고 사용자가 실행 |
| 구현 착수 | plan.md 작성 후 사용자 명시적 승인("YES") 받은 후에만 진행 |
| 기존 파일 | md 파일 편집·삭제 금지. 조회 및 신규 생성만 허용 |
| 전국 데이터 | 수도권 한정 데이터로 전국 모델 만들지 않음 (agent.md 0-1 원칙 준수) |

---

## 역할별 Persona

| 역할 | Persona 핵심 | Focus 영역 |
|------|-------------|------------|
| **architect** | K-Ride MSA 원칙 수호자. "UI는 데이터다, AI 파이프라인은 레이어다" | 3서비스 경계 정의, DB 역할 구분, FastAPI↔SDUI 연동 설계 |
| **backend_engineer** | FastAPI + Spring Boot 이중 백엔드 담당자 | Neo4j 쿼리, ChromaDB 벡터검색, Groq LLM 호출, SDUI CRUD |
| **frontend_engineer** | SDUI DynamicEngine 인터프리터 전문가 | componentMap 확장, 온보딩 화면 흐름, localStorage 상태 관리 |
| **ai_engineer** | K-Ride 추천 모델 + RAG 파이프라인 설계자 | TabNet/LSTM 모델, ChromaDB 임베딩, 데이터 수집·전처리 파이프라인 |
| **qa_engineer** | K-Ride 동적 렌더링 검증 설계자 | SDUI 바인딩 엣지케이스, FastAPI 응답 검증, 온보딩 흐름 테스트 |

---

## 서브에이전트 협업 패턴

```
사용자 요청
    │
    ├── UI 변경 요청 → frontend_engineer (SDUI 화면) → 필요 시 backend_engineer (SQL migration)
    │
    ├── AI 추천 개선 → ai_engineer (모델/RAG) → backend_engineer (FastAPI 엔드포인트)
    │
    ├── 아키텍처 결정 → architect (경계 설계) → 해당 역할 엔지니어
    │
    └── 버그/테스트 → qa_engineer (재현 분석) → 해당 역할 엔지니어 (수정)
```

---

## MSA 서비스 경계 (역할 맵)

```
┌─────────────────────────────────────────────────────────────┐
│  K-Ride Frontend (Next.js, SDUI metadata-project)           │
│  담당: frontend_engineer                                     │
│  • DynamicEngine — SDUI 메타데이터 렌더링                    │
│  • K-Ride 전용 컴포넌트 (SelectionCard, PurposeCard 등)       │
│  • localStorage kride_form 온보딩 상태 관리                  │
└────────────────────────┬────────────────────────────────────┘
                         │ React Query / fetch
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌─────────────────┐         ┌──────────────────────┐
│ SDUI Spring Boot│         │ K-Ride FastAPI        │
│ (EC2, port 8080)│         │ (로컬, port 8000)     │
│ 담당: backend_  │         │ 담당: backend_        │
│       engineer  │         │       engineer        │
│                 │         │                       │
│ ui_metadata     │         │ /api/recommend/ai     │
│ Redis 캐시      │         │ /api/recommend/       │
│ JWT 인증        │         │   itinerary           │
└────────┬────────┘         └──────────┬────────────┘
         │                             │
         ▼                             ▼
┌─────────────────┐         ┌──────────────────────┐
│ PostgreSQL      │         │ Neo4j AuraDB         │
│ (SDUI DB)       │         │ ChromaDB (로컬)      │
│ ui_metadata     │         │ 로컬 PG16 (port 5434)│
│ + kride screens │         │ 담당: ai_engineer     │
└─────────────────┘         └──────────────────────┘
```

---

## 참조 문서

- `architect/research.md` — MSA 구조 상세 분석
- `backend_engineer/research.md` — FastAPI 파이프라인 분석
- `frontend_engineer/research.md` — SDUI 화면 현황 분석
- `ai_engineer/research.md` — 모델 및 데이터 현황
- `qa_engineer/research.md` — 테스트 전략
