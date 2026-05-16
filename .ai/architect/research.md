# K-Ride MSA 아키텍처 분석

> 분석일: 2026-05-16
> 원본 참조: `.ai/sdui_kride.md`, `.ai/new_research.md`, `.ai/kride_sdui_screen.md`

---

## 1. 전체 MSA 구조 (3서비스)

```
┌─────────────────────────────────────────────────────────────────┐
│  K-Ride Frontend (Next.js 14, metadata-project)                 │
│  경로: subproject/SDUI/metadata-project/                         │
│                                                                  │
│  DynamicEngine — SDUI 메타데이터를 React 컴포넌트로 렌더링        │
│  componentMap — component_type → React 컴포넌트 매핑             │
│  K-Ride 전용 컴포넌트: SelectionCard, PurposeCard,              │
│                        KrideNextButton, KrideWarningToast        │
│  localStorage['kride_form'] — 온보딩 상태 관리                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ React Query / fetch (Next.js proxy /api/*)
          ┌──────────────┴────────────────┐
          ▼                               ▼
┌──────────────────────┐     ┌──────────────────────────┐
│ SDUI Spring Boot     │     │ K-Ride FastAPI           │
│ EC2, port 8080       │     │ 로컬/배포, port 8000      │
│ 경로: SDUI-server/   │     │ 경로: src/api/           │
│                      │     │ fastapi_server.py        │
│ GET /api/ui/{screenId}│     │                          │
│ Redis 캐시 (1hr)     │     │ POST /api/recommend/ai   │
│ JWT 인증             │     │ POST /api/recommend/     │
│ Flyway 마이그레이션  │     │   itinerary              │
└──────────┬───────────┘     └────────────┬─────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐     ┌──────────────────────────┐
│ PostgreSQL (SDUI DB) │     │ Neo4j AuraDB             │
│ docker port 5433     │     │ 아티스트 촬영지 지식그래프 │
│                      │     │                          │
│ ui_metadata          │     │ ChromaDB (로컬)           │
│ query_master         │     │ 목적 벡터검색             │
│ user, role, auth     │     │                          │
│ + K-Ride 화면 추가   │     │ PG16 (로컬, port 5434)   │
└──────────────────────┘     │ POI 960,000건+           │
                             │ 날씨, 안전, 맛집, 문화    │
                             └──────────────────────────┘
```

---

## 2. DB 역할 구분 (혼동 금지)

| DB | 포트 | 내용 | 담당 레이어 |
|----|------|------|------------|
| PostgreSQL (Docker) | 5433 | SDUI 메타데이터 (`ui_metadata`, `query_master`), 사용자 인증 | SDUI Spring Boot |
| PostgreSQL 16 (로컬) | 5434 | K-Ride ML DB — POI 960,000건, 날씨, 안전, 자전거도로 | FastAPI / ML |
| Neo4j AuraDB | cloud | 아티스트-촬영지 지식 그래프 | FastAPI |
| ChromaDB | 로컬 | 목적(purpose) 벡터 임베딩 검색 | FastAPI |

---

## 3. 데이터 흐름 (온보딩 → 추천 → 화면)

```
[온보딩 화면 흐름]
INTRO1 (여행 기간, SET_DURATION)
  → INTRO2 (아티스트 선택, TOGGLE_ARTIST)
  → INTRO3 (지역 선택, TOGGLE_REGION)
  → INTRO4 (목적 선택, SET_PURPOSES)
  → INTRO5 (예산, GOTO_MY_LIST)
  → MY_LIST (요약)
  → [AI 버튼 클릭] GOTO_FOCUS
  → FOCUS (지도 + 일정)

[localStorage 저장 — kride_form]
{
  "duration": "당일치기",
  "selectedArtists": ["BTS"],
  "selectedRegions": ["서울"],
  "purposes": ["kculture"],
  "budget": { "min": 500000, "max": 2000000 }
}

[GOTO_FOCUS 액션 — 미구현]
useBusinessActions.tsx의 GOTO_FOCUS 케이스에서:
1. localStorage['kride_form'] 읽기
2. POST http://localhost:8000/api/recommend/itinerary 호출
3. 응답 { itinerary, mapData } → FOCUS 페이지 pageData로 주입
```

---

## 4. FastAPI 추천 파이프라인

```
Neo4j (아티스트 촬영지 POI) ──┐
Neo4j (지역 POI)              ├─→ 합산 + 중복제거 → Groq LLM → 일정 JSON
ChromaDB (목적 벡터검색)      ┘       ↑
                              intfloat/multilingual-e5-small 임베딩
```

**요청 형식 (`POST /api/recommend/itinerary`):**
```json
{
  "duration": "당일치기",
  "artists": ["BTS", "BLACKPINK"],
  "regions": ["서울"],
  "purposes": ["kculture", "food"],
  "budget": { "min": 500000, "max": 2000000 }
}
```

**응답 형식:**
```json
{
  "itinerary": [
    {
      "day": 1,
      "morning": { "places": [{"name": "...", "address": "...", "tip": "..."}] },
      "afternoon": { "places": [...] }
    }
  ],
  "mapData": { "markers": [{"name": "...", "lat": 37.55, "lon": 126.98}] },
  "source_pois": [...]
}
```

---

## 5. SDUI 핵심 원칙 (K-Ride 적용)

- `ui_metadata` 테이블의 값만 바꾸면 UI가 즉시 바뀜 (클라이언트 재배포 불필요)
- `component_type` → `componentMap` → React 컴포넌트 렌더링
- `group_id` / `parent_group_id`로 트리 구조 구성
- `css_class`에 `grid`/`flex` 키워드가 있으면 DynamicEngine이 direction 클래스를 추가하지 않음 (CSS cascade 충돌 방지)
- Flyway: V40(초기 화면) → V41(data source) → V42(next 버튼) → V43(레이아웃) → V44/V45(버그 픽스, 미배포)

---

## 6. 미해결 아키텍처 과제

| 과제 | 현황 | 우선순위 |
|------|------|---------|
| FOCUS ↔ FastAPI 연동 | `GOTO_FOCUS` 액션에서 FastAPI 미호출 | 🔴 높음 |
| FastAPI 배포 환경 | 현재 로컬(port 8000)만 구성, EC2 미배포 | 🟡 중간 |
| Neo4j 데이터 최신화 | 아티스트 촬영지 1,073건 (2026-04-27 기준) | 🟢 낮음 |
| 전국 POI 추천 모델 | 수도권 한정 데이터로 학습됨 | 🟢 낮음 |
