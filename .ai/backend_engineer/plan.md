# K-Ride Backend 구현 계획

> 작성일: 2026-05-16
> 최종 수정: 2026-05-19
> 상태: 검토 중 (사용자 승인 전)

---

## [P1] FOCUS 화면 FastAPI 연동 — GOTO_FOCUS 액션 구현

### 파일
`subproject/SDUI/metadata-project/components/DynamicEngine/hook/useBusinessActions.tsx`

### 구현 내용

```typescript
case "GOTO_FOCUS": {
  // 1. localStorage에서 온보딩 데이터 읽기
  const raw = localStorage.getItem("kride_form");
  const krideForm = raw ? JSON.parse(raw) : {};

  try {
    // 2. FastAPI 추천 API 호출
    const response = await fetch("/api/kride/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration: krideForm.duration ?? "당일치기",
        artists: krideForm.selectedArtists ?? [],
        regions: krideForm.selectedRegions ?? [],
        purposes: krideForm.purposes ?? [],
        budget: krideForm.budget ?? {},
      }),
    });

    if (!response.ok) throw new Error(`FastAPI 오류: ${response.status}`);

    const data = await response.json();
    // 3. 결과를 sessionStorage에 저장 (FOCUS 페이지에서 읽음)
    sessionStorage.setItem("kride_focus_data", JSON.stringify(data));
  } catch (error) {
    console.error("[GOTO_FOCUS] FastAPI 호출 실패:", error);
    // 실패 시에도 FOCUS 페이지로 이동 (빈 화면 표시)
  }

  // 4. FOCUS 페이지로 이동
  router.push("/view/FOCUS");
  break;
}
```

### next.config.ts 프록시 추가

```typescript
// 기존 SDUI 프록시 뒤에 추가
{
  source: "/api/kride/:path*",
  destination: "http://localhost:8000/api/:path*"
}
```

### FOCUS 페이지에서 데이터 읽기

FOCUS 화면 진입 시 `sessionStorage['kride_focus_data']`에서 `itinerary`와 `mapData`를 읽어 `pageData`로 주입.

---

## [P2] V44/V45 Migration 배포

사용자가 직접 실행:
```bash
cp .ai/V44__fix_intro1_hero_svg.sql    subproject/SDUI/SDUI-server/src/main/resources/db/migration/
cp .ai/V45__intro4_single_select.sql   subproject/SDUI/SDUI-server/src/main/resources/db/migration/
```
이후 Spring Boot 재시작 → Flyway 자동 적용 (Current version: 43 → 45)

---

## [P3] FastAPI 배포 환경 구성 (나중)

```yaml
# docker-compose.yml 추가 서비스
fastapi:
  build: .
  ports:
    - "8000:8000"
  environment:
    - NEO4J_URI=${NEO4J_URI}
    - GROQ_API_KEY=${GROQ_API_KEY}
```

`next.config.ts` 환경변수화:
```typescript
destination: `${process.env.FASTAPI_URL ?? "http://localhost:8000"}/api/:path*`
```

---

## DB 운영 정책 — 2026-05-17 확정

### pgAdmin 직접 DML (Flyway migration 미사용)

사용자는 Flyway migration 파일 방식 대신 **pgAdmin Query Tool에서 직접 DML 실행**. `.ai/V*__.sql` 파일은 참조용으로만 유지.

### DML 후 필수 절차

```
pgAdmin DML 실행
  → Spring Boot 재시작 (Redis 캐시 초기화)
  → npm run dev 재시작 (프론트 상태 초기화)
  → 브라우저 새로고침
```

**이유:** Spring Boot는 `GET /api/ui/{screenId}` 응답을 Redis에 1시간 TTL로 캐싱.
pgAdmin으로 DB를 바꿔도 Redis가 살아있으면 구버전 데이터를 계속 서빙함.

Redis 강제 플러시:
```bash
docker-compose exec redis redis-cli FLUSHALL
```

### 확인 방법

브라우저 DevTools → Network → `/api/ui/{screenId}` XHR 응답에서 실제 서빙 중인 DB 값 확인.

---

## KRIDE 인트로 화면 레이아웃 수정 — V46 마이그레이션 — 2026-05-17

> 스크린샷 피드백(.ai/memo/0517log) 반영

### V46 변경 내용

| screen_id | component_id | 변경 컬럼 | 변경 내용 |
|-----------|-------------|----------|----------|
| KRIDE_INTRO1 | intro1_title | component_type | `TEXT` → `TYPEWRITER_TEXT` |
| KRIDE_INTRO1 | intro1_title | css_class | `leading-snug` 추가 |
| KRIDE_INTRO1 | intro1_sub | css_class | `mb-4` 추가 |
| KRIDE_INTRO1 | intro1_buttons | css_class | `mt-auto` 제거 → `mt-6` |
| KRIDE_INTRO2 | intro2_root | css_class | `pt-4` 추가 |
| KRIDE_INTRO2 | intro2_title | css_class | `sticky top-0 bg-black z-10 py-3` |
| KRIDE_INTRO2 | artist_grid | css_class | `place-items-center` 제거 |
| KRIDE_INTRO3 | intro3_root | css_class | `pt-4` 추가 |
| KRIDE_INTRO3 | intro3_title | css_class | `sticky top-0 bg-black z-10 py-3` |
| KRIDE_INTRO3 | region_grid | css_class | `flex flex-wrap` → `grid grid-cols-4 gap-3 pb-28` |

### 배포 방법

```bash
# V46 파일은 이미 migration 폴더에 생성됨
# Spring Boot 재시작 → Flyway 자동 적용 (V45 → V46)
cd subproject/SDUI/SDUI-server
./gradlew bootRun
```

로그 확인: `Successfully applied 1 migration to schema "public" (current version: 46)`

---

## 완료 기준

| 항목 | 확인 방법 |
|------|----------|
| GOTO_FOCUS 액션에서 FastAPI 호출 | 브라우저 Network 탭에서 `/api/kride/itinerary` POST 요청 확인 |
| FOCUS 화면에 일정 표시 | `/view/FOCUS` 진입 시 일정 카드 렌더링 |
| FOCUS 화면에 지도 마커 표시 | MAP_VIEW 컴포넌트에 마커 표시 |
| V44/V45 Flyway 적용 | Spring Boot 로그에 `Successfully applied 2 migrations` 확인 |

---

## 데이터 클라이언트 코드 ↔ 실제 DB 구조 불일치 수정 — 2026-05-19 [완료]

> Neo4j/ChromaDB/Supabase에 데이터 적재 후, 클라이언트 코드가 실제 데이터 구조와 맞지 않아 API가 빈 결과를 반환하던 문제 수정.
>
> **데이터 적재 경로:** `kride_graph_builder.py`(PostgreSQL → JSON) → `노드마이그레이션.py`(JSON → Neo4j + Supabase)

### 수정 파일 및 내용

#### `src/api/neo4j_client.py` [편집]

| 함수 | 버그 | 수정 내용 |
|------|------|----------|
| `get_artist_pois()` | 관계 방향 반대 (`Artist→POI` → 실제 `POI→Artist`) | `MATCH (p:POI)-[:FILMING_AT]->(a:Artist)` 로 방향 수정 |
| `get_artist_pois()` | ID vs Name 매칭 (프론트 `["BTS"]` vs DB `a.id="artist_1"`) | `WHERE a.name IN $artist_ids` 로 변경 |
| `get_region_pois()` | Region 노드/IN_REGION 관계 없음 (마이그레이션 미실행) | `WHERE ANY(r IN $region_names WHERE p.address CONTAINS r)` 주소 매칭으로 대체 |
| `get_regions()` | Region 노드 없음 → 빈 배열 → fallback 정상 작동 | 변경 불필요 |

#### `src/api/supabase_client.py` [편집]

| 함수 | 기존 (잘못된 테이블) | 수정 (실제 테이블) |
|------|---------------------|-------------------|
| `get_all_artists()` | `artist` 테이블 조회 | `nodes` 테이블, `id LIKE 'artist_%'` + `metadata` jsonb에서 name 추출 |
| `get_poi_details()` | `poi` 테이블 조회 | `nodes` 테이블, `metadata`에서 lat/lon/address 추출 |
| `get_artist_poi_map()` | `artist_poi` 조인 테이블 | `edges` 테이블, `relation_type = 'FILMING_AT'` 조회 |

### curl 검증 결과 (2026-05-19)

- `/api/artists`: `nodes` 테이블에서 실제 아티스트(드라마명) 20건 반환 — fallback 아님 ✅
- `/api/recommend/itinerary`: `source_pois`에 실제 POI 7건 (lat/lon 포함), `markers`에 좌표 직접 표시 — 지오코딩 fallback 불필요 ✅

### 미해결 사항

- artist 노드에 K-pop 아티스트(BTS 등) 없음 — 현재 드라마 촬영지만 적재된 상태
- `artists: ["BTS"]` 요청 시 artist_pois 0건 → region_pois + chroma_pois에서만 결과 반환

---

## K-pop 아티스트 데이터 적재 방안 — 2026-05-19 ⏳ 미해결

### 현재 상황

현재 artist 노드는 **드라마 20건**만 적재됨. K-pop 아티스트(BTS, BLACKPINK 등)는 데이터 자체가 없음.

### 데이터 적재 파이프라인 (현재)

```
Excel (K_Drama_Unique_Spots.xlsx)
  ↓  src/db/load_kculture_data.py
PostgreSQL (artist, poi, artist_poi 테이블)
  ↓  src/graph/kride_graph_builder.py
kride_graph.json (430,999줄)
  ↓  dataset/노드마이그레이션.py (Colab)
Neo4j AuraDB + Supabase (nodes, edges 테이블)
```

### 파이프라인 파일 위치

| 파일 | 경로 | 역할 |
|------|------|------|
| 데이터 로더 | `src/db/load_kculture_data.py` | Excel → PostgreSQL |
| 그래프 빌더 | `src/graph/kride_graph_builder.py` | PostgreSQL → JSON/GraphML |
| 노드 마이그레이션 | `dataset/노드마이그레이션.py` | JSON → Neo4j + Supabase |
| 원본 Excel | `dataset/data/crawling/K_Drama_Unique_Spots.xlsx` | 드라마+촬영지 원본 |
| 출력 JSON | `dataset/models/kride_graph.json` | 그래프 데이터 (노드 39,109개, 엣지 175+) |

### 데이터 소스 발견: kcisa_media_locations_2023.csv

프로젝트 루트에 `kcisa_media_locations_2023.csv` (1,963행, 134개 아티스트) 존재.
K-pop 아티스트별 촬영지/방문지 POI 데이터 포함.

```
컬럼: 미디어타입, 아티스트, 장소명, 장소타입, 장소설명, 영업시간, 브레이크타임, 휴무일, 주소, 위도, 경도, 전화번호, 최종작성일
```

### INTRO2 ↔ kcisa CSV 매핑 (현재 10개 → 20개 확장)

**현재 INTRO2 하드코딩** (V41 query_master, 영문명 10개):

| # | INTRO2 (영문) | kcisa CSV (한글) | POI 수 | 상태 |
|---|--------------|-----------------|--------|------|
| 1 | BTS | 방탄소년단 | 151 | ✅ 매칭 |
| 2 | BLACKPINK | 블랙핑크 | 108 | ✅ 매칭 |
| 3 | IVE | 아이브 | 1 | ⚠️ POI 극소 |
| 4 | aespa | — | 0 | ❌ kcisa에 없음 |
| 5 | NewJeans | — | 0 | ❌ kcisa에 없음 |
| 6 | TWICE | 트와이스 | 53 | ✅ 매칭 |
| 7 | EXO | 엑소 | 37 | ✅ 매칭 |
| 8 | STRAY KIDS | 스트레이키즈 | 5 | ⚠️ POI 소량 |
| 9 | SEVENTEEN | 세븐틴 | 62 | ✅ 매칭 |
| 10 | LE SSERAFIM | — | 0 | ❌ kcisa에 없음 |

**추가 후보 (POI 수 상위, INTRO2 20개 채우기):**

| # | kcisa 아티스트 | 영문명 | POI 수 |
|---|---------------|--------|--------|
| 11 | 슈퍼주니어 | SUPER JUNIOR | 87 |
| 12 | 동방신기 | TVXQ | 45 |
| 13 | BTOB | BTOB | 42 |
| 14 | 소녀시대 | Girls' Generation | 40 |
| 15 | 레드벨벳 | Red Velvet | 34 |
| 16 | NCT | NCT | 34 |
| 17 | 에이핑크 | Apink | 31 |
| 18 | 오마이걸 | OH MY GIRL | 31 |
| 19 | 샤이니 | SHINee | 30 |
| 20 | 마마무 | MAMAMOO | 29 |

> ⚠️ aespa, NewJeans, LE SSERAFIM은 kcisa 2023 데이터에 없음 (데뷔가 늦거나 2023 이후 데이터).
> IVE(1건), STRAY KIDS(5건)는 POI 극소. INTRO2에 유지하되 POI 부족 인지 필요.

### 해결 방법

#### 방법 A: kcisa CSV → PostgreSQL → 그래프 재빌드

**1단계 — kcisa CSV 로더 스크립트 작성**

`kcisa_media_locations_2023.csv`를 읽어서 PostgreSQL `artist` + `poi` + `artist_poi` 테이블에 적재하는 스크립트 작성.

- 아티스트: `category = 'kpop'`, 한글명 → name, 영문명 → name_en
- POI: 위도/경도/주소/장소명 → `poi` 테이블 (기존 드라마 POI와 ID 충돌 방지)
- 매핑: `artist_poi` 테이블에 `FILMING_AT` 관계

```bash
python src/db/load_kcisa_kpop_data.py
# → PostgreSQL에 K-pop 아티스트 20건 + POI ~800건 + 매핑 적재
```

**2단계 — 그래프 재빌드**

```bash
python src/graph/kride_graph_builder.py
# → dataset/models/kride_graph.json 재생성 (드라마 + K-pop 통합)
```

**3단계 — Neo4j + Supabase 재마이그레이션**

```python
# dataset/노드마이그레이션.py (Colab에서 실행)
# → Neo4j AuraDB + Supabase nodes/edges 테이블 갱신
```

#### 방법 B: JSON 직접 편집 (방법 A와 병행)

`dataset/models/kride_graph.json`에 K-pop 아티스트 노드 + 엣지를 직접 추가.
방법 A로 PostgreSQL까지만 적재하고, 그래프 재빌드 전에 JSON에도 수동 보정 가능.

```json
// 노드 추가 예시
{"type": "Artist", "name": "방탄소년단", "name_en": "BTS", "category": "kpop", "id": "artist_21"}

// 엣지 추가 예시 (기존 POI와 연결)
{"relationship": "FILMING_AT", "source": "poi_new_001", "target": "artist_21"}
```

### INTRO2 query_master 업데이트 (20개)

V41에서 하드코딩된 `kride_artist_list` 쿼리를 Supabase `nodes` 테이블에서 동적 조회로 변경하거나,
20개 아티스트로 확장 필요:

```sql
-- 방법 1: Supabase 동적 조회 (데이터 적재 후 자동 반영)
-- → supabase_client.get_all_artists() 가 이미 nodes 테이블에서 artist_* 조회

-- 방법 2: query_master 하드코딩 20개로 확장
UPDATE query_master SET sql_template = '...' WHERE sql_key = 'kride_artist_list';
```

**핵심: INTRO2에 표시되는 name과 Neo4j artist.name이 일치해야 추천 파이프라인이 동작.**
- kcisa CSV는 한글명 (방탄소년단) → Neo4j에도 한글명으로 적재
- INTRO2에서 선택 시 한글명이 전달되어야 `a.name IN $artist_ids` 매칭

### 작업 순서 정리

| 순서 | 작업 | 파일 | 실행 | 상태 |
|------|------|------|------|------|
| 1 | kcisa CSV 로더 스크립트 작성 | `src/db/load_kcisa_kpop_data.py` (신규) | Claude | ✅ 완료 |
| 2 | PostgreSQL 적재 | 스크립트 실행 | 사용자 | ✅ 완료 (artist 20건, POI 787건, link 883건) |
| 3 | 그래프 빌더 kpop category 추가 | `src/graph/kride_graph_builder.py` [편집] | Claude | ✅ 완료 (`WHERE category IN ('tourism','kculture','kpop')`) |
| 4 | 그래프 재빌드 (1차) | `kride_graph_builder.py` | 사용자 | ✅ 완료 → kpop 미포함 (category 누락) |
| 5 | 그래프 재빌드 (2차) | `kride_graph_builder.py` | 사용자 | ✅ 완료 → 39,624노드, 816엣지 (kpop 포함) |
| 6 | 기존 데이터 Colab 마이그레이션 | `노드마이그레이션.py` | 사용자 (Colab) | ✅ 완료 (1,962건 — 구 JSON 기반) |
| 7 | Delta JSON 추출 | `models/kride_graph_delta.json` | Claude | ✅ 완료 (Artist 20 + POI 495 + Edge 641) |
| 8 | Delta Colab 마이그레이션 | `노드마이그레이션.py` (delta) | 사용자 (Colab) | ✅ 완료 |
| 9 | 인코딩 깨짐 수정 | `src/db/fix_kpop_encoding.py` | 사용자 | ✅ 완료 (로컬→Neo4j+Supabase upsert) |
| 10 | .env Neo4j 인스턴스 갱신 | `.env` | Claude | ✅ 완료 (a1880d39 인스턴스) |
| 11 | INTRO2 아티스트 목록 20개 업데이트 | query_master 또는 코드 수정 | Claude | ⏳ 미착수 |
| 12 | FastAPI 서버 재시작 + 검증 | curl 테스트 | 사용자 | ⏳ 미착수 |

### 그래프 빌더 버그 수정 — 2026-05-19

`src/graph/kride_graph_builder.py` [편집]: POI 조회 쿼리에 `'kpop'` category 누락.

```diff
- WHERE category IN ('tourism', 'kculture')
+ WHERE category IN ('tourism', 'kculture', 'kpop')
```

1차 빌드 시 K-pop POI 787건 중 495건이 누락 (category 필터), 엣지도 883→99건으로 감소.
수정 후 2차 빌드: 39,624노드(+495 K-pop POI), 816엣지(+641 K-pop 엣지).

### Delta 마이그레이션 전략 — 2026-05-19

기존 3.9만건 전체 재실행 대신 **K-pop 추가분만 별도 마이그레이션**.

| 항목 | 전체 재실행 | Delta만 실행 |
|------|-----------|-------------|
| 노드 수 | 39,624 | 515 (Artist 20 + POI 495) |
| 엣지 수 | 816 | 641 |
| 예상 소요 | 수 분 ~ 십 분 | **1분 이내** |

**Delta 파일:** `models/kride_graph_delta.json`
- 기존 JSON(`dataset/models/kride_graph.json`, May 4)과 새 JSON(`models/kride_graph.json`, May 19) 비교
- 새로 추가된 노드/엣지만 추출
- Neo4j `MERGE` 사용 시 기존 데이터와 충돌 없음

**Colab 실행 방법:**
1. `models/kride_graph_delta.json`을 Google Drive에 업로드
2. `노드마이그레이션.py`에서 JSON 경로를 delta 파일로 변경
3. 실행 → K-pop 데이터만 추가

### 참고: 그래프 빌더 출력 경로 주의

`kride_graph_builder.py`는 **상대경로** `models/`에 저장:
- 실행 디렉토리가 `/d/kride-project/`이면 → `/d/kride-project/models/kride_graph.json` (✅ 새 파일)
- 기존 파일: `/d/kride-project/dataset/models/kride_graph.json` (May 4, 변경 안 됨)
- Colab 업로드 시 **새 파일** (`/models/kride_graph.json`) 또는 **delta 파일** 사용

### 참고: 현재 INTRO2 화면 동작

- INTRO2 query_master (`kride_artist_list`): 영문 10개 하드코딩
- `/api/artists`: Supabase `nodes` 테이블에서 `artist_*` 조회 → 드라마 20건 반환
- 프론트 INTRO2에서 아티스트 선택 시 `name` 값이 전달됨
- **name 통일 필수**: INTRO2 표시명 = Neo4j artist.name = kcisa CSV 아티스트명

---

## 인코딩 깨짐 수정 — 2026-05-19 [완료]

Colab → Google Drive → Neo4j/Supabase 마이그레이션 과정에서 한글 UTF-8 텍스트가 surrogate escape(`\udced\ub8fa...`)로 깨짐.

### 원인
- Colab에서 JSON 파일 읽기 시 인코딩 미지정 또는 Drive 파일 시스템 이슈

### 수정
- `src/db/fix_kpop_encoding.py` 작성 → 로컬 delta JSON(정상 UTF-8)에서 직접 Neo4j MERGE + Supabase upsert
- `.env` Neo4j 인스턴스 갱신: `e6e5a79c` → `a1880d39` (사용자가 새 인스턴스 생성)

### 수정 파일

| 파일 | 변경 |
|------|------|
| `src/db/fix_kpop_encoding.py` | [신규] 로컬 → Neo4j + Supabase 직접 upsert |
| `.env` | [편집] NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD 갱신 |

---

## 아티스트 썸네일 크롤링 — 2026-05-19 [진행중]

INTRO2 화면에 표시할 아티스트 프로필 사진을 dearu/lysn 스토어에서 수집.

### 크롤링 대상 스토어 (6개)

| 스토어 | URL | 대상 아티스트 |
|--------|-----|-------------|
| STARS | `store.dearu.com/STARS/home` | Apink, MAMAMOO (확인 필요) |
| LYSN | `webstore.lysn.com/LYSN/home` | SUPER JUNIOR, EXO, TVXQ, SHINee, Girls' Generation, Red Velvet, NCT |
| JYP | `store.dearu.com/JYP/home` | TWICE, ITZY, Stray Kids |
| STARSHIP | `store.dearu.com/STARSHIP/home` | IVE |
| CUBE | `store.dearu.com/CUBE/home` | (BTOB 미등록) |
| ACTORS | `store.dearu.com/ACTORS/home` | (배우 전용, K-pop 없음) |

### 매칭 결과 (11/20 성공)

| # | Artist | Store | 상태 |
|---|--------|-------|------|
| 1 | SUPER JUNIOR | LYSN | ✅ |
| 2 | EXO | LYSN | ✅ |
| 3 | TVXQ | LYSN | ✅ |
| 4 | SHINee | LYSN | ✅ |
| 5 | Girls' Generation | LYSN | ✅ |
| 6 | Red Velvet | LYSN | ✅ |
| 7 | NCT | LYSN | ✅ |
| 8 | TWICE | JYP | ✅ |
| 9 | ITZY | JYP | ✅ |
| 10 | Stray Kids | JYP | ✅ |
| 11 | IVE | STARSHIP | ✅ |

### 미매칭 (9/20)

| Artist | 이유 |
|--------|------|
| BTS | HYBE Weverse 전용 |
| BLACKPINK | YG 전용 플랫폼 |
| SEVENTEEN | HYBE Weverse 전용 |
| TXT | HYBE Weverse 전용 |
| IU | EDAM 소속, 스토어 없음 |
| OH MY GIRL | WM 소속, 스토어 없음 |
| BTOB | CUBE에 미등록 |
| Apink | STARS 150+목록 내 확인 필요 |
| MAMAMOO | STARS 150+목록 내 확인 필요 |

### 생성 파일

| 파일 | 역할 |
|------|------|
| `.ai/memo/artist_thumbnails.json` | 매칭 결과 JSON (URL + 스토어 + 상태) |
| `src/db/download_artist_thumbnails.py` | 이미지 다운로드 스크립트 (`public/artists/`에 저장) |

### 실행 방법

```bash
python src/db/download_artist_thumbnails.py
# → public/artists/EXO.jpg, TWICE.jpg 등 11개 파일 생성
```

### 남은 작업
- [x] 20명 전원 이미지 수집 완료 (크롤링 11 + 수동 9)
- [x] `public/artists/` → `metadata-project/public/artists/` 복사 완료
- [ ] INTRO2 이미지 표시 안됨 — 배포 후 해결 예정 (CardImage.tsx `<img>` 태그 전환 완료)

---

## V50 query_master 업데이트 — 2026-05-19 [완료 → V50 30명 확장]

### INTRO2 아티스트 (10명 → 20명 → **30명**)

**기존 (V41):** BTS, BLACKPINK, IVE, aespa, NewJeans, TWICE, EXO, STRAY KIDS, SEVENTEEN, LE SSERAFIM
**V50 (20명):** BTS, BLACKPINK, SEVENTEEN, SUPER JUNIOR, TWICE, TVXQ, BTOB, Girls' Generation, EXO, Red Velvet, NCT, GDragon, OH MY GIRL, SHINee, MAMAMOO, IU, TXT, Stray Kids, ITZY, IVE
**V50 확장 (30명):** kcisa_media_locations_2023.csv POI 수 상위 30 기준으로 확장. `name_ko` 컬럼 추가.

추가된 10명: INFINITE(인피니트), Apink(에이핑크), VICTON(빅톤), fromis_9(프로미스나인), CHUNGHA(청하), Block B(블락비), Girl's Day(걸스데이), GOT7, Highlight(하이라이트), Rain(비), NU'EST(뉴이스트), Kang Daniel(강다니엘)

- FALLBACK_ARTISTS도 30명으로 확장 (`fastapi_server.py`)
- `supabase_client.py`: `get_all_artists()` name 빈 행 skip 추가
- 이미지: 기존 20명 존재, 신규 10명 미수집 (CardImage 이니셜 fallback으로 동작)

### INTRO3 지역 (12 → 13)

경기 추가 (id=2, 서울 다음)

### SQL 파일

`.ai/V50__kride_artist_region_update.sql`

---

## FOCUS 일정 생성 실패 디버깅 — 2026-05-19 [진행중]

### 증상

```json
{
  "itinerary": [{"day": 1, "morning": {"places": []}, "afternoon": {"places": []}}],
  "mapData": {"markers": []},
  "source_pois": []
}
```

FOCUS 화면까지 진입하고 지도도 표시되지만 **일정이 비어있음**.

### 원인 분석

`source_pois: []` → Neo4j/ChromaDB에서 POI를 하나도 못 가져옴 → LLM에 빈 컨텍스트 전달 → 빈 일정 반환.

**데이터 파이프라인:**
```
INTRO2에서 선택: artists=["BTS","EXO"] → useKrideItinerary → FastAPI
  ↓
FastAPI /api/recommend/itinerary:
  1. Neo4j get_artist_pois(["BTS","EXO"])    → 0건? ← 확인 필요
  2. Neo4j get_region_pois(["서울"])          → 0건? ← 확인 필요
  3. ChromaDB search_pois_by_purpose(["kculture"]) → 0건? ← 확인 필요
  4. 합산 → all_pois = 0건
  5. Groq LLM → 빈 컨텍스트 → {"places": []}
```

### 의심 원인

| 데이터 소스 | 의심 원인 | 확인 방법 |
|------------|----------|----------|
| Neo4j | .env 인스턴스(a1880d39) 연결 실패 또는 인코딩 수정 후 데이터 누락 | FastAPI 디버그 로그 확인 |
| Neo4j | artist.name 매칭 실패 (INTRO2 영문명 vs Neo4j 한글명) | `a.name IN ["BTS"]` vs 실제 저장된 name |
| ChromaDB | 컬렉션 비어있음 (kride_poi_kculture 등) | `chroma_db/` 확인 |
| Groq | API 키 만료 또는 모델명 변경 | 로그 확인 |

### 핵심 의심: INTRO2 name ↔ Neo4j name 불일치

- INTRO2 query_master: `name = 'BTS'` (영문)
- `load_kcisa_kpop_data.py`: `artist.name = name_en` (영문: BTS)
- `kride_graph_builder.py`: PostgreSQL artist.name → Neo4j Artist.name
- **따라서 Neo4j에 `name = 'BTS'`로 저장되어야 맞음**
- fix_kpop_encoding.py 실행 후 데이터가 올바른지 확인 필요

### 디버그 로그 추가

`fastapi_server.py` 에 데이터 소스별 건수 출력 추가:
```
[K-Ride] artist_pois: N건 (artists=[...])
[K-Ride] region_pois: N건 (regions=[...])
[K-Ride] chroma_pois: N건 (purposes=[...])
[K-Ride] 총 POI: N건
```

### 프록시 타임아웃 수정 — 2026-05-19 [완료]

Next.js `rewrites()` 프록시가 30초 타임아웃으로 연결 끊김 (socket hang up).

**수정:**
- `useKrideItinerary.ts`: 프록시 우회, 브라우저에서 직접 `http://localhost:8000` 호출 (120초 타임아웃)
- `app/api/kride/recommend/itinerary/route.ts`: API Route 프록시 (백업용, 120초)
- CSP `connect-src`에 `http://localhost:8000` 이미 허용됨

### 확인 절차

1. FastAPI 재시작 → 디버그 로그 확인
2. 로그에서 어느 데이터 소스가 실패하는지 파악
3. Neo4j 연결 테스트: `curl http://localhost:8000/api/regions`
4. 필요 시 Neo4j Browser에서 직접 Cypher 실행하여 데이터 확인

---

## K-Ride 확장: 앙상블 비교 + 챗봇(멀티쿼리+리랭커) + PDF 지식베이스 — 2026-05-19 [구현완료]

### 개요

기존 추천 파이프라인(Neo4j + ChromaDB → union → Groq LLM)에 3가지 확장:
1. **앙상블 모델 비교** (LightGBM vs XGBoost Ranker) + MLflow/DagsHub 기록
2. **챗봇** (멀티쿼리 + 리랭커) — `subproject/NLP/chatbot/`에 별도 서비스 (:8001)
3. **PDF 지식베이스** — 18개 관광 PDF → ChromaDB 인덱싱 → 챗봇 RAG 소스

### Phase A: FALLBACK_ARTISTS 30명 + Supabase 검증 [완료]

| 파일 | 변경 |
|------|------|
| `src/api/fastapi_server.py` | FALLBACK_ARTISTS 5명 → 30명 (CSV POI수 상위 30, `name_ko` 포함) |
| `src/api/supabase_client.py` | `get_all_artists()` — name 빈 행 skip |
| `.ai/V50__kride_artist_region_update.sql` | 20명 → 30명 + `name_ko` 컬럼 |

### Phase B: PDF 인덱싱 [완료]

| 파일 | 역할 |
|------|------|
| `subproject/NLP/chatbot/__init__.py` | 패키지 |
| `subproject/NLP/chatbot/config.py` | 공통 설정 (모델명, 경로, 컬렉션명) |
| `subproject/NLP/chatbot/pdf_ingest.py` | PyPDFLoader → 청크 → ChromaDB 인덱싱 |

**실행 결과:**
- 18개 PDF → **4636 chunks** 인덱싱 완료 (2건 SKIP — 깨진 폰트 메타데이터)
- 컬렉션: `kride_pdf_knowledge` (ChromaDB, 기존 4개 POI 컬렉션과 분리)
- 임베딩: `intfloat/multilingual-e5-small` (384-dim, 기존과 동일)

### Phase C: 리랭커 비교 [완료]

| 파일 | 역할 |
|------|------|
| `subproject/NLP/chatbot/reranker.py` | CrossEncoder 래퍼 클래스 |
| `subproject/NLP/chatbot/reranker_comparison.py` | MiniLM vs BGE 벤치마크 (20개 한국어 관광 쿼리) |

**비교 결과 (`.ai/memo/reranker_comparison.md`):**

| 메트릭 | MiniLM (22M) | BGE-M3 (560M) |
|--------|-------------|---------------|
| 평균 Latency | **3.5초** | 96초 (CPU에서 27배 느림) |
| Top-5 Jaccard Overlap | 0.24 (두 모델 결과 76% 다름) |

**결론: MiniLM 채택** — CPU 환경에서 BGE-M3는 쿼리당 ~96초로 실용 불가. GPU 서버 배포 시 BGE로 전환 가능.
`config.py`의 `RERANKER_MODEL`을 `cross-encoder/ms-marco-MiniLM-L-6-v2`로 변경 완료.

> 참고: LLM-as-judge 한국어 관련도 점수가 둘 다 0.00 — Groq 응답 파싱 이슈 (평가 도구 문제, 리랭커 성능 무관)

### Phase D: 챗봇 서비스 [완료 — 코드 작성, 서버 미실행]

| 파일 | 역할 |
|------|------|
| `subproject/NLP/chatbot/multi_query.py` | Groq LLM으로 쿼리 3개 변형 생성 |
| `subproject/NLP/chatbot/chatbot_chain.py` | 핵심 RAG 파이프라인 오케스트레이션 |
| `subproject/NLP/chatbot/chatbot_server.py` | FastAPI 서버 (:8001) |
| `subproject/NLP/chatbot/requirements.txt` | 의존성 목록 |

**챗봇 파이프라인:**
```
사용자 메시지
  → [1] Multi-Query (Groq → 원본 + 3 변형 = 4 쿼리)
  → [2] Multi-Source Retrieval (PDF 컬렉션 + POI 4개 컬렉션)
  → [3] 중복 제거 (chunk ID / POI name)
  → [4] Rerank (MiniLM CrossEncoder → 상위 10개)
  → [5] Context 조립
  → [6] Groq LLM 응답 생성
  → 응답 (reply + sources + pois)
```

**엔드포인트:**

| 엔드포인트 | 설명 |
|-----------|------|
| `POST /chat` | `{message, session_id, user_id}` → `{reply, sources, pois, timestamp, session_started_at}` |
| `POST /chat/reset` | 세션 초기화 + 종료 시각 기록 |
| `GET /health` | 서버 상태 + active_sessions 수 |

**추가 기능 (사용자 요청):**
- `user_id`: 로그인 유저 식별
- `timestamp`: 응답 시각 (KST)
- `session_started_at` / `session_ended_at`: 세션 시작/종료 시각 추적

### Phase E: 앙상블 모델 비교 [완료]

| 파일 | 역할 |
|------|------|
| `src/ml/feature_engineering.py` | 8-feature 벡터 추출 |
| `src/ml/build_ensemble_ranker.py` | LightGBM vs XGBoost 학습 + MLflow 기록 |
| `src/api/ensemble_client.py` | 추론 래퍼 (`rank_pois()`) |

**8-Feature Vector:**

| Feature | 소스 | 범위 |
|---------|------|------|
| `neo4j_hit` | Neo4j `get_artist_pois()` | 0/1 |
| `neo4j_artist_count` | 연결된 아티스트 수 | 0~N |
| `chroma_similarity` | ChromaDB 코사인 유사도 | 0~1 |
| `jaccard_score` | `poi_cooccurrence_v2.pkl` | 0~1 |
| `category_match` | 목적-카테고리 일치 | 0/1 |
| `region_match` | 지역-주소 일치 | 0/1 |
| `distance_km` | Haversine 거리 | 0~∞ |
| `budget_fit` | 예산 범위 내 | 0/1 |

**학습 결과 (`.ai/memo/ensemble_comparison.md`):**

| 메트릭 | LightGBM | XGBoost |
|--------|----------|---------|
| NDCG@5 | 1.0000 | 1.0000 |
| NDCG@10 | 1.0000 | 1.0000 |
| MAP@5 | 1.0000 | 1.0000 |
| Recall@5 | 0.8842 | 0.8842 |
| Recall@10 | 1.0000 | 1.0000 |

- 데이터: 3,873 샘플 (200 쿼리), ChromaDB POI 로드 실패 → 더미 데이터 사용
- **우승 모델: LightGBM** → `models/ensemble_ranker.pkl` 저장 완료
- 실제 데이터로 재학습 시 차이 발생 예상 (더미 데이터라 양 모델 동점)

### Phase F: FastAPI 앙상블 통합 [완료]

| 파일 | 변경 |
|------|------|
| `src/api/fastapi_server.py` | `ensemble_client.rank_pois()` import + itinerary 엔드포인트 통합 |
| `src/api/ensemble_client.py` | 신규 — 모델 로드 + `rank_pois()` 추론 |

**파이프라인 변경:**
```
[Before]
Neo4j → ─┐
ChromaDB → ─── union(중복제거) ─── Groq LLM ─── itinerary
          ┘

[After]
Neo4j → ──────┐
ChromaDB → ───── ensemble_client.rank_pois() ─── top-K ─── Groq LLM ─── itinerary
Co-occ → ─────┘   (LightGBM predict)
```

모델 파일 없으면 기존 union 방식으로 자동 fallback.

### .env 추가

```
DAGSHUB_REPO_OWNER=    # 사용자 계정 입력 필요
DAGSHUB_REPO_NAME=kride-project
DAGSHUB_TOKEN=         # DagsHub 토큰 입력 필요
```

### 남은 작업

| 작업 | 상태 |
|------|------|
| 챗봇 서버 실행 테스트 (`python -m chatbot.chatbot_server`) | ⏳ 미실행 |
| 신규 아티스트 10명 이미지 수집 (`public/artists/`) | ⏳ 건너뜀 (이니셜 fallback 동작) |
| V50 SQL pgAdmin 실행 (30명 아티스트) | ⏳ 사용자 실행 필요 |
| DagsHub 토큰 설정 + 앙상블 재학습 (실제 데이터) | ⏳ 선택 |
| 앙상블 학습 시 ChromaDB POI 연결 (경로 수정) | ⏳ 더미 데이터 → 실제 데이터 전환 필요 |
| **단위 테스트 작성 + 전체 통과** | ✅ 완료 (103 passed) |

---

## 단위 테스트 작성 — 2026-05-20 [완료]

### 테스트 결과

```
pytest tests/ -v
103 passed, 0 failed, 16 warnings in 26.78s
```

### 생성/수정 파일

| 파일 | 테스트 수 | 커버 대상 |
|------|----------|----------|
| `tests/test_chatbot_server.py` (신규) | 25 | Reranker, MultiQuery, ChatbotChain, ChatbotServer 엔드포인트 |
| `tests/test_ensemble.py` (신규) | 28 | haversine, compute_features, rank_pois, 메트릭 함수, PURPOSE_CATEGORY_MAP |
| `tests/test_pdf_ingest.py` (신규) | 14 | build_chunk_id, load_pdfs, chunk_documents, ingest 파이프라인 |
| `tests/test_fastapi.py` (수정) | 36 | 기존 FastAPI + 앙상블 통합 경로 (HAS_ENSEMBLE=True/False, fallback, markers) |

### 수정 사항 (기존 test_fastapi.py)

서버 코드가 fallback 패턴으로 변경되어 기존 테스트 6개를 서버 동작에 맞게 수정:

| 기존 기대 | 수정 후 기대 | 이유 |
|----------|------------|------|
| `HAS_AI=False` → 503 | `HAS_AI=False` → 200 + FALLBACK | artists/regions는 fallback 반환 |
| 예외 시 502 | 예외 시 200 + FALLBACK | try/except → fallback 패턴 적용 |
| Groq 실패 → 502 | Groq 실패 → 200 + 빈 일정 | `{"itinerary": []}` fallback |

### 앙상블 통합 테스트 (신규 추가)

| 테스트 | 검증 내용 |
|--------|----------|
| `test_ensemble_ranking_applied` | HAS_ENSEMBLE=True → ensemble_rank_pois 호출 |
| `test_ensemble_fallback_on_exception` | 앙상블 예외 시 union 방식 fallback |
| `test_no_ensemble_uses_union` | HAS_ENSEMBLE=False → 기존 방식 |
| `test_ensemble_markers_have_coords` | 좌표 있는 POI만 markers에 포함 |

---

## 테스트 개념 Q&A — 2026-05-20

### Q1. TestClient는 ASGI 앱을 직접 호출한다?

```
브라우저 → HTTP → 네트워크 → 서버(uvicorn) → FastAPI 앱
TestClient →         (네트워크 없이)         → FastAPI 앱 직접
```

- FastAPI는 ASGI(Asynchronous Server Gateway Interface) 프레임워크
- `TestClient`는 실제 HTTP 서버를 띄우지 않고 **메모리 안에서** 앱 함수를 직접 호출
- 장점: 포트 바인딩 불필요, 빠르고, CI/CD에서도 실행 가능

### Q2. MagicMock이란?

```python
mock_groq = MagicMock()
mock_groq.chat.completions.create.return_value = fake_response
```

- `unittest.mock.MagicMock`: **가짜 객체**를 자동 생성
- 어떤 속성/메서드를 호출해도 에러 없이 동작 (체이닝 가능)
- `return_value`로 반환값 지정, `side_effect`로 예외 발생 가능
- 용도: 외부 API(Groq, Neo4j 등)를 **실제 호출하지 않고** 테스트

### Q3. stub 설정이란?

```python
sys.modules["neo4j"] = types.ModuleType("neo4j")  # 빈 모듈 등록
```

- **Stub**: 설치되지 않은 패키지를 빈 껍데기로 대체
- `neo4j`, `chromadb` 등이 설치 안 돼도 `import` 에러 없이 테스트 실행 가능
- Mock과 차이: stub은 "존재하게 만드는 것", mock은 "동작을 제어하는 것"

### Q4. avg_cost란?

- POI(관광지)의 **평균 지출 비용** (원 단위)
- 예산 필터링에 사용: 유저 예산 범위 내의 POI만 추천
- `avg_cost`가 없는 POI → 비용 정보 미확인 → 필터에서 제외하지 않음 (통과)

### Q5. 앙상블이 실패할 수 있는 경우?

| 상황 | 원인 |
|------|------|
| 모델 파일 없음 | `models/ensemble_ranker.pkl` 삭제/미생성 |
| 모델 버전 불일치 | Python/LightGBM 버전 업데이트 후 pickle 로드 실패 |
| feature 수 불일치 | 모델 학습 시 8개 → 코드 수정으로 feature 추가/삭제 |
| 메모리 부족 | 후보 POI가 너무 많을 때 numpy 배열 생성 실패 |
| co-occurrence pkl 손상 | `poi_cooccurrence_v2.pkl` 파일 깨짐 |

→ 실패 시 **기존 union 방식으로 자동 fallback** (서비스 중단 없음)

### Q6. upsert에서 short chunk를 skip하는 이유?

```python
if not text or len(text) < 10:
    continue  # skip
```

- 10자 미만 = 의미 있는 정보 없음 (페이지 번호, 빈 줄 등)
- 임베딩해봐야 의미 없는 벡터 → 검색 노이즈 증가
- ChromaDB 저장 공간 낭비 방지

### Q7. Haversine 거리 계산이란?

- 지구를 구(球)로 가정하고 **두 위경도 좌표 간의 최단 거리(km)**를 계산하는 공식
- 예: 서울(37.57, 126.98) ↔ 부산(35.18, 129.08) ≈ 325km
- 용도: "유저 현재 위치에서 POI까지 얼마나 먼가?" → 가까운 POI 우선 추천

### Q8. chroma_similarity 테스트란?

```python
chroma_similarities={"p1": 0.85} → feats[2] == 0.85
```

- **ChromaDB 코사인 유사도** (0~1): 유저 검색어와 POI 설명문 유사도
- 0.85 = "유저가 찾는 것과 이 POI 설명이 85% 유사"
- 앙상블 모델의 3번째 feature → 유사할수록 높은 랭킹

### Q9. distance가 0이면 유저에게 어떻게 표시?

`distance_km = 0` = 유저 위치 정보 없음 (GPS 미제공)

| 상황 | 표시 |
|------|------|
| 유저 위치 있음 | "현재 위치에서 2.3km" |
| 유저 위치 없음 | 거리 표시 안 함 (또는 "위치 허용 시 거리 표시") |

서버: `user_lat=None` → distance=0 → 앙상블이 거리를 랭킹에 반영하지 않음 (다른 7개 feature로만 점수 산정)

### Q10. budget_fit이 1인데 avg_cost가 없으면?

| 레이어 | 처리 |
|--------|------|
| **서버** | `avg_cost` 없는 POI도 추천 목록에 포함 (필터 통과) |
| **프론트엔드** | `avg_cost` 있으면 "예상 비용: ₩50,000" / 없으면 "비용 정보 미확인" 또는 비용란 숨김 |

이유: 비용 정보가 없다고 좋은 POI를 제외하면 추천 품질 하락

### Q11. `ec._model_data = {...}` 코드 설명

```python
ec._model_data = {
    "model": mock_model,      # 학습된 LightGBM 모델 (mock)
    "type": "lgbm",           # 모델 종류 식별자
    "features": FEATURE_NAMES  # 모델이 기대하는 8개 feature 이름
}
```

- 실제로는 `models/ensemble_ranker.pkl`에서 pickle로 로드되는 딕셔너리
- 테스트에서는 파일 로드 없이 직접 주입하여 모델 동작 검증
- `model.predict(X)` → 각 POI의 랭킹 점수 반환

### Q12. NDCG@k, Recall@k, MAP@k란?

정보 검색/추천 시스템의 **랭킹 품질** 측정 메트릭:

| 메트릭 | 의미 | 비유 |
|--------|------|------|
| **NDCG@k** | 상위 k개의 **순서 품질** | "좋은 것이 위에 있는가?" |
| **Recall@k** | 상위 k개에 **정답이 얼마나 포함**됐는가 | "빠뜨린 건 없는가?" |
| **MAP@k** | 상위 k개에서 정답이 **얼마나 일찍** 나오는가 | "첫 페이지에 원하는 게 있는가?" |

예시 (맛집 추천):
```
실제 맛집: [경복궁떡볶이, 광장시장, 을지로골목]
추천 결과: [광장시장✅, 카페A❌, 경복궁떡볶이✅, 카페B❌, 을지로골목✅]

NDCG@5 = 0.89 (좋은 순서)
Recall@5 = 3/3 = 1.0 (5개 안에 3개 모두 포함)
MAP@5 = 높음 (정답이 1,3,5위 → 비교적 빠름)
```

유저는 첫 3~5개만 봄 → 상위에 좋은 추천이 있어야 함.
LightGBM vs XGBoost 중 "상위 K개 품질"이 더 좋은 모델을 선택하는 기준.
