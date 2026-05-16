# K-Ride DB 스키마 참조

> 원본 출처: `.ai/kride.txt`, `src/api/db_schema.sql`, `postgres_kride.sql`

---

## 1. 환경변수 목록 (`.env` 루트 기준)

> 실제 키 값은 `.env` 파일 및 `.ai/kride.txt` 참조. 여기서는 키 이름만 기록.

### 지도/위치 API
| 변수명 | 용도 |
|--------|------|
| `KAKAO_REST_API_KEY` | 카카오맵 POI 수집 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 지도 API |
| `NCP_CLIENT_ID` / `NCP_CLIENT_SECRET` | 네이버 클라우드 플랫폼 |
| `VWORLD_API_KEY` | Vworld 행정구역/문화시설 지오코딩 |
| `JUSO_CONFIRM_KEY` | 행안부 JUSO 도로명주소 API |

### 날씨/기상
| 변수명 | 용도 |
|--------|------|
| `KMA_API_KEY` | 기상청(KMA) 날씨 API |
| `ASOS_API_KEY` | ASOS 관측소 데이터 |

### DB
| 변수명 | 용도 |
|--------|------|
| `DATABASE_URL` | 로컬 PG16 `postgresql://postgres:...@localhost:5434/kride` |
| `NEO4J_URI` | Neo4j AuraDB `neo4j+s://e6e5a79c.databases.neo4j.io` |
| `NEO4J_USERNAME` | neo4j |
| `NEO4J_PASSWORD` | AuraDB 비밀번호 (.ai/kride.txt 참조) |

### LLM/AI
| 변수명 | 용도 |
|--------|------|
| `GROQ_API_KEY` | Groq LLM API (RAG 파이프라인) |

### 프론트엔드 (Next.js)
| 변수명 | 용도 |
|--------|------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase Auth + Storage |
| `NEXT_PUBLIC_NEXTAUTH_SECRET` | NextAuth 세션 |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `NEXT_PUBLIC_GITHUB_ID/SECRET` | GitHub OAuth |
| `NEXT_PUBLIC_TMDB_API_KEY` | TMDB (영화 API) |

---

## 2. PostgreSQL 메인 DB 스키마 (`src/api/db_schema.sql`)

PostgreSQL (PG16 로컬, port 5434, DB명: `kride`)

### `artist` 테이블
```sql
CREATE TABLE IF NOT EXISTS public.artist (
    id           serial PRIMARY KEY,
    name         varchar(100) NOT NULL,
    name_en      varchar(100),
    category     varchar(50),
    image_url    varchar(500),
    created_at   timestamp DEFAULT now()
);
```

### `artist_poi` 테이블
```sql
CREATE TABLE IF NOT EXISTS public.artist_poi (
    artist_id         integer NOT NULL,
    poi_id            integer NOT NULL,
    relationship_type varchar(50) DEFAULT 'FILMING_AT',
    PRIMARY KEY (artist_id, poi_id)
);
```

### `course_template` 테이블
```sql
CREATE TABLE IF NOT EXISTS public.course_template (
    id              serial PRIMARY KEY,
    title           varchar(200),
    title_en        varchar(200),
    duration_days   smallint,
    category        varchar(30),
    transport       varchar(20),
    estimated_cost  integer,
    poi_ids         integer[],
    route_geom      geometry(LineString, 4326),
    description     text,
    description_en  text,
    created_at      timestamp DEFAULT now()
);
```

### `district_danger` 테이블
```sql
CREATE TABLE IF NOT EXISTS public.district_danger (
    id           serial PRIMARY KEY,
    sido         varchar(20) NOT NULL,
    sigungu      varchar(30) NOT NULL,
    crash_count  integer DEFAULT 0,
    death_count  integer DEFAULT 0,
    severe_count integer DEFAULT 0,
    injury_count integer DEFAULT 0,
    ...
);
```

**주요 테이블 설계 원칙:**
- `artist`: K-Pop/배우 등 유명인 메타데이터
- `artist_poi`: 촬영지 관계 (FILMING_AT) — artist와 poi의 M:N 연결
- `course_template`: 여행 코스 템플릿 (기간, 비용, 루트 포함)
- `poi`: 관광지 (다국어 지원, 카테고리, 위치)
- `district_danger`: 지역별 교통사고 통계 (안전 모델 학습 데이터)

---

## 3. 자전거 도로 관련 스키마 (`postgres_kride.sql`)

PostGIS 확장 기반 공간 쿼리 지원:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE bicycle_paths (
    id               SERIAL PRIMARY KEY,
    route_name       VARCHAR(255),
    province         VARCHAR(50),       -- 시도명
    city_district    VARCHAR(50),       -- 시군구명
    start_address    TEXT,
    end_address      TEXT,
    start_point      GEOMETRY(Point, 4326),
    end_point        GEOMETRY(Point, 4326),
    path_length_km   FLOAT,
    path_width_m     FLOAT,
    path_type        VARCHAR(100),      -- 전용도로/우선도로 등
    management_agency VARCHAR(100),
    last_updated     DATE
);
CREATE INDEX idx_bicycle_paths_start_point ON bicycle_paths USING GIST (start_point);

CREATE TABLE bicycle_routes (
    id               SERIAL PRIMARY KEY,
    route_name       VARCHAR(255),
    city_province    VARCHAR(50),
    city_district    VARCHAR(50),
    start_lat        DECIMAL(10, 8),
    start_lon        DECIMAL(11, 8),
    end_lat          DECIMAL(10, 8),
    end_lon          DECIMAL(11, 8),
    geom_start       GEOMETRY(Point, 4326),
    geom_end         GEOMETRY(Point, 4326),
    total_length_km  FLOAT,
    road_width_m     FLOAT,
    route_type       VARCHAR(100),
    management_agency VARCHAR(100),
    base_date        DATE
);
```

---

## 4. DB 역할 구분 요약

| DB | 위치 | 역할 |
|----|------|------|
| PostgreSQL (SDUI) | Docker, port 5433 | `ui_metadata` — SDUI 화면 정의 |
| PostgreSQL (ML) | 로컬 PG16, port 5434 | POI 874K건, 자전거 도로, 안전 통계 |
| Neo4j AuraDB | 클라우드 | 아티스트-POI 관계 그래프 (FILMING_AT) |
| ChromaDB | 로컬 `chroma_db/` | POI 벡터 임베딩 (목적 기반 검색) |

> **혼동 금지**: 5433(SDUI)과 5434(ML)는 별개 PostgreSQL 인스턴스.

---

## 5. Neo4j AuraDB 인스턴스 정보

```
NEO4J_URI=neo4j+s://e6e5a79c.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_DATABASE=e6e5a79c
AURA_INSTANCEID=e6e5a79c
AURA_INSTANCENAME=krider
생성일: 2026-05-05
```

인증 파일: `.ai/Neo4j-e6e5a79c-Created-2026-05-05_kride.txt`

---

## 6. FastAPI 엔드포인트 ↔ DB 연결 구조

```
GET  /api/artists               → Neo4j (아티스트 노드 조회)
GET  /api/regions               → Neo4j + fallback(하드코딩 17개 시도)
POST /api/recommend/ai          → Neo4j + ChromaDB + Groq LLM
POST /api/recommend/itinerary   → Neo4j + ChromaDB + Groq LLM → 일정 JSON
GET  /api/health                → 그래프 노드/엣지 수, road_scored_rows 반환
```
