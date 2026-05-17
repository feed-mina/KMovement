# K-Ride MSA 아키텍처 분석

> 분석일: 2026-05-16 | 최종 업데이트: 2026-05-17 (V49 flex-wrap 레이아웃 / DynamicEngine 개선)
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
│ 로컬 dev / EC2 prod  │     │ 로컬 port 8001           │
│ 경로: SDUI-server/   │     │ 경로: src/api/           │
│                      │     │ fastapi_server.py        │
│ GET /api/ui/{screenId}│     │                          │
│ Redis 캐시 (1hr)     │     │ POST /api/recommend/ai   │
│ JWT 인증             │     │ POST /api/recommend/     │
│ Flyway 마이그레이션  │     │   itinerary              │
└──────────┬───────────┘     └────────────┬─────────────┘
           │                              │
     ┌─────┴──────┐               ┌───────┴────────────────┐
     ▼(local)  ▼(EC2)             ▼                        ▼
┌──────────┐ ┌────────┐    ┌─────────────┐      ┌──────────────────┐
│ PG 18    │ │ PG 15  │    │ PG 16       │      │ Neo4j AuraDB     │
│ 노트북   │ │ Docker │    │ 노트북      │      │ cloud            │
│ :5432    │ │ :5434  │    │ (별도 포트) │      │ 아티스트 촬영지   │
│ SDUI_TD  │ │SDUI_TD │    │ kride DB    │      │ 지식그래프        │
└──────────┘ └────────┘    │ poi,        │      └──────────────────┘
                           │ artist_poi  │      ┌──────────────────┐
                           │ 960,000건+  │      │ Supabase (cloud) │
                           └─────────────┘      │ (용도 확인 필요)  │
                                                └──────────────────┘
                                                ┌──────────────────┐
                                                │ ChromaDB (로컬)  │
                                                │ 목적 벡터 검색   │
                                                └──────────────────┘
```

---

## 2. DB 역할 구분 (혼동 금지)

### 로컬 개발 환경

| DB | 버전 | 포트 | DB명 | user / pw | 내용 | 담당 |
|----|------|------|------|-----------|------|------|
| PostgreSQL | **18** (노트북 직접 설치) | **5432** | `SDUI_TD` | postgres / 1234 | ui_metadata, query_master, users, content 등 SDUI 전체 | Spring Boot (local 프로파일) |
| PostgreSQL | **16** (노트북 직접 설치) | 별도 (미확인) | kride DB | 미확인 | poi, artist_poi 등 K-Ride ML 데이터 960,000건+ | FastAPI |
| Neo4j AuraDB | cloud | — | — | — | 아티스트-촬영지 지식 그래프 | FastAPI |
| Supabase | cloud | — | — | — | 용도 미확인 | FastAPI (추정) |
| ChromaDB | 로컬 | — | — | — | 목적(purpose) 벡터 임베딩 검색 | FastAPI |

### EC2 프로덕션 환경 (정보 불완전 — 확인 필요)

| DB | 버전 | 포트 | 내용 | 비고 |
|----|------|------|------|------|
| PostgreSQL | 15 (Docker) | 5434 | SDUI_TD — 테스트용 / DB명: SDUI_TD, user: mina / pw: password | docker-compose.yml 기준 |
| PostgreSQL | 미확인 | 미확인 | 실제 운영 DB | EC2에 2개 DB 존재, 상세 정보 확인 필요 |

**application.yml 프로파일 분기:**

| 프로파일 | 연결 대상 | 비고 |
|---------|----------|------|
| `local` | localhost:5432 / SDUI_TD / postgres / 1234 | 노트북 PG18 직접 연결 |
| `prod` | 환경변수 `${SPRING_DATASOURCE_*}` | EC2 배포 시 주입 |
| base(`application.yml`) | localhost:5432 / testdb / postgres / 1234 | 기본값 (실사용 X) |

> ⚠️ **pgAdmin에서 V49 SQL 실행 시 → localhost:5432 / SDUI_TD 에 연결할 것**

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
- REPEATER(`ref_data_id` 있는 GROUP)에서 `css_class`에 `grid` **또는 `flex-wrap`** 키워드가 있으면 외부 wrapper div 하나로 묶어 container로 동작 — 2026-05-17 수정
  - `grid` 단독 → Tailwind `display:grid` 기반 (정적 CSS 파일에 정의된 경우)
  - `flex-wrap` → KRIDE.css `display:flex; flex-wrap:wrap` 기반 (동적 다열 아이템용)
  - **Tailwind v4 주의:** DB에서 런타임 주입되는 `grid-cols-*` 같은 Tailwind 유틸리티 클래스는 소스 스캔에서 누락되어 CSS 규칙 미생성 → 정적 CSS 파일로 대체할 것
- `group_direction: ROW` → `flex-row-layout` / `COLUMN` → `flex-col-layout` (direction 클래스)
- Flyway: V40→V41→V42→V43→V44→V45→V46→V47 배포 완료 / V48·V49는 pgAdmin 직접 적용 (로컬 개발)

---

## 6-2. KRIDE 다열 레이아웃 설계 결정 — 2026-05-17 [변경]

**문제:** INTRO2(아티스트 3열), INTRO3(지역 4열) → Tailwind `grid-cols-*` 동적 클래스로 구현 시도했으나 CSS 미생성으로 1열 고착

**최종 결정:** 정적 CSS(`app/styles/KRIDE.css`) + `flex-wrap` 키워드 신호 방식

```
DB css_class          DynamicEngine             KRIDE.css
──────────────        ─────────────────         ─────────────────────────
'kride-artist-grid    flex-wrap 감지             .kride-artist-grid {
 flex-wrap'      →    → wrapper div 생성    →      display: flex;
                      → 아이템 N개 내부            flex-wrap: wrap;
                                                   gap: 1.5rem;
                                                 }
                                                 .kride-artist-grid > div {
                                                   width: calc((100% - 3rem)/3);
                                                 }
```

**기존 화면 영향 없음:** MAIN_PAGE 등은 정적 CSS 파일(`MAIN_PAGE.css`)에서 grid 정의 → Tailwind 스캔 무관

---

## 6. 미해결 아키텍처 과제

| 과제 | 현황 | 우선순위 |
|------|------|---------|
| FOCUS ↔ FastAPI 연동 | `GOTO_FOCUS` 액션에서 FastAPI 미호출 | 🔴 높음 |
| FastAPI 배포 환경 | 현재 로컬(port 8000)만 구성, EC2 미배포 | 🟡 중간 |
| Neo4j 데이터 최신화 | 아티스트 촬영지 1,073건 (2026-04-27 기준) | 🟢 낮음 |
| 전국 POI 추천 모델 | 수도권 한정 데이터로 학습됨 | 🟢 낮음 |
