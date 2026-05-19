# K-Ride Backend 분석

> 분석일: 2026-05-16
> 최종 수정: 2026-05-19
> 원본 참조: `src/api/fastapi_server.py`, `.ai/fastapi_rag_llm_guide_6번부터.md`, `.ai/api_troubleshooting_guide.md`

---

## 1. FastAPI 엔드포인트 현황

| 엔드포인트 | 메서드 | 역할 | 상태 |
|-----------|--------|------|------|
| `/api/recommend/ai` | POST | 온보딩 기반 POI 추천 리스트 반환 | ✅ 구현됨 |
| `/api/recommend/itinerary` | POST | 일정 JSON + 지도 마커 생성 | ✅ 구현됨 |

### 요청 형식 (`/api/recommend/itinerary`)
```json
{
  "duration": "당일치기",
  "artists": ["BTS", "BLACKPINK"],
  "regions": ["서울"],
  "purposes": ["kculture", "food"],
  "budget": { "min": 500000, "max": 2000000 }
}
```

### 응답 형식
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

## 2. 추천 파이프라인 상세

### 데이터 소스별 역할

| 소스 | 데이터 | 쿼리 방식 |
|------|--------|----------|
| Neo4j | 아티스트 촬영지 POI (1,073건) | Cypher 쿼리, 아티스트명 매칭 |
| Neo4j | 지역 POI | 지역명 기반 쿼리 |
| ChromaDB | 목적(purpose) 벡터 임베딩 | `intfloat/multilingual-e5-small` 임베딩, 코사인 유사도 검색 |
| Groq LLM | 일정 생성 | POI 리스트 → 자연어 일정 JSON |

### 파이프라인 흐름
```
1. 아티스트별 Neo4j 촬영지 조회 → POI 리스트 A
2. 지역별 Neo4j POI 조회 → POI 리스트 B
3. 목적(purposes)별 ChromaDB 벡터 유사도 검색 → POI 리스트 C
4. A + B + C 합산 + 중복제거 (POI ID 기준)
5. Groq LLM에 POI 리스트 + 여행 조건 전달 → 일정 JSON 생성
6. 응답: itinerary + mapData.markers
```

---

## 3. Spring Boot SDUI 엔드포인트

| 엔드포인트 | 역할 |
|-----------|------|
| `GET /api/ui/{screenId}` | 화면 메타데이터 트리 반환 (Redis 캐시 1hr) |
| `POST /api/auth/login` | JWT 로그인 |
| `GET /api/query/{sqlKey}` | query_master 동적 SQL 실행 결과 |

### SDUI K-Ride 화면 (Flyway 적용 현황)
| Migration | 내용 | 상태 |
|-----------|------|------|
| V40 | KRIDE_INTRO1~5, MY_LIST, FOCUS 화면 메타데이터 | ✅ 배포 |
| V41 | query_master + DATA_SOURCE 3개 (artistList, regionList, purposeList) | ✅ 배포 |
| V42 | KRIDE_NEXT_BTN 조건부 버튼 | ✅ 배포 |
| V43 | 레이아웃 업데이트 (artist_grid 3열, region_grid chip) | ✅ 배포 |
| V44 | intro1_hero.png → .svg 수정 | ✅ 배포 |
| V45 | INTRO4 서브타이틀 단일선택 문구 | ✅ 배포 |
| V46 | INTRO1/2/3 레이아웃 개선 (sticky 헤더, region_grid → grid-cols-4, TYPEWRITER_TEXT) | ✅ 배포 |
| V47 | INTRO3 title TEXT 복원, INTRO4 sticky/z-50 수정 | ✅ 배포 |

---

## 4. Next.js 프록시 설정

`subproject/SDUI/metadata-project/next.config.ts`:
- `/api/*` → `http://localhost:8080` (SDUI Spring Boot)
- FastAPI용 프록시 규칙 아직 없음 (FOCUS 연동 시 추가 필요)

---

## 5. 알려진 문제

| 문제 | 원인 | 상태 |
|------|------|------|
| FOCUS 화면 데이터 비어있음 | `GOTO_FOCUS` 액션에서 FastAPI 미호출 | ⏳ 미해결 |
| FastAPI 로컬에서만 동작 | EC2 미배포 | ⏳ 미해결 |

---

## 6. 데이터 클라이언트 ↔ 실제 DB 구조 불일치 분석 — 2026-05-19 [완료]

### Supabase 실제 테이블 구조

| 테이블 | 용도 | 주요 컬럼 |
|--------|------|----------|
| `nodes` | POI + Artist 혼합 저장 | `id` (poi_*, artist_*), `metadata` (jsonb: name, lat, lon, address, category 등) |
| `edges` | 관계 저장 | `source` (poi_*), `target` (artist_*), `relation_type` ("FILMING_AT") |

- ~~`artist`, `poi`, `artist_poi` 테이블은 존재하지 않음~~ (코드가 잘못 참조하고 있었음 → 수정 완료)

### Neo4j 실제 그래프 구조

| 항목 | 값 |
|------|------|
| 관계 방향 | `(POI)-[:FILMING_AT]->(Artist)` (POI→Artist) |
| Artist 식별 | `a.id = "artist_1"`, `a.name = "선재 업고 튀어"` (name 기반 매칭 필요) |
| Region 노드 | ❌ 존재하지 않음 (마이그레이션 미실행) → `p.address CONTAINS` 로 대체 |

### 적재된 아티스트 목록

**드라마 (artist_1~20, 기존):**
artist_1~20: 선재 업고 튀어, 눈물의 여왕, 도깨비, 이태원 클라쓰, 갯마을 차차차, 이상한 변호사 우영우, 킹더랜드, 응답하라 1988, 빈센조, 무빙, 우리들의 블루스, 스물다섯 스물하나, 환혼, 나의 아저씨, 폭싹 속았수다 등

**K-pop (artist_21~40, 2026-05-19 추가):**
방탄소년단(BTS), 블랙핑크(BLACKPINK), 세븐틴(SEVENTEEN), 슈퍼주니어(SUPER JUNIOR), 트와이스(TWICE), 동방신기(TVXQ), BTOB, 소녀시대(Girls' Generation), 엑소(EXO), 레드벨벳(Red Velvet), NCT, 에이핑크(Apink), 오마이걸(OH MY GIRL), 샤이니(SHINee), 마마무(MAMAMOO), 아이유(IU), TXT, 스트레이키즈(Stray Kids), Itzy(ITZY), 아이브(IVE)

---

## 7. K-pop 아티스트 데이터 적재 — 2026-05-19 [진행 중]

### 데이터 소스

`kcisa_media_locations_2023.csv` (프로젝트 루트, 1,963행, 134개 K-pop 아티스트)
- 컬럼: 미디어타입, 아티스트, 장소명, 장소타입, 장소설명, 영업시간, 주소, 위도, 경도 등
- 위도/경도 포함 → 지오코딩 불필요

### 적재 파이프라인 실행 결과

| 단계 | 결과 | 상태 |
|------|------|------|
| PostgreSQL 적재 (`load_kcisa_kpop_data.py`) | artist 20건(id=21~40), POI 787건, link 883건 | ✅ 완료 |
| 그래프 빌더 1차 실행 | Artist 20 + Edge 99 (POI 누락 — `kpop` category 필터 버그) | ✅ 완료 (버그 발견) |
| 그래프 빌더 category 수정 | `WHERE category IN ('tourism','kculture','kpop')` | ✅ 완료 |
| 그래프 빌더 2차 실행 | 39,624노드, 816엣지 (K-pop POI 495건 포함) | ✅ 완료 |
| 기존 JSON Colab 마이그레이션 | 1,962건 (구 JSON, 드라마만) | ✅ 완료 |
| Delta JSON 추출 | Artist 20 + POI 495 + Edge 641 = 1,156건 | ✅ 완료 |
| Delta Colab 마이그레이션 | delta 파일로 K-pop만 추가 | ✅ 완료 |
| 인코딩 수정 | `fix_kpop_encoding.py` 로컬→Neo4j+Supabase upsert | ✅ 완료 |
| .env Neo4j 인스턴스 갱신 | `a1880d39` 인스턴스로 변경 | ✅ 완료 |

### 빌더 버그: K-pop POI category 누락

`kride_graph_builder.py`가 `WHERE category IN ('tourism', 'kculture')`만 조회.
`load_kcisa_kpop_data.py`는 `category='kpop'`으로 적재 → 빌더에서 제외됨.

수정: `'kpop'` 추가 → 2차 빌드에서 POI 495건 + Edge 641건 정상 포함.

### Delta 마이그레이션 전략

전체 3.9만건 재실행 대신 K-pop 추가분만 별도 마이그레이션.

| 파일 | 경로 | 내용 |
|------|------|------|
| 전체 JSON (구) | `dataset/models/kride_graph.json` | 39,109노드 (May 4, 드라마만) |
| 전체 JSON (신) | `models/kride_graph.json` | 39,624노드 (May 19, 드라마+K-pop) |
| **Delta JSON** | `models/kride_graph_delta.json` | **515노드 + 641엣지** (K-pop만) |

### PostgreSQL에서 K-pop POI가 787건인데 Delta에 495건인 이유

787건 중 일부(292건)는 기존 `kculture`/`tourism` POI와 이름이 같아 `load_kcisa_kpop_data.py`에서 기존 POI ID를 재사용.
→ 그래프 빌더가 기존 노드로 이미 포함 → Delta에서 제외 (정상 동작)
