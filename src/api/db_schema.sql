-- PostGIS 확장 활성화 (공간 쿼리용)
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE bicycle_paths (
    id SERIAL PRIMARY KEY,
    route_name VARCHAR(255),          -- 노선명
    province VARCHAR(50),             -- 시도명 (경기도, 서울특별시 등)
    city_district VARCHAR(50),        -- 시군구명
    start_address TEXT,               -- 기점지번주소
    end_address TEXT,                 -- 종점지번주소
    
    -- 공간 데이터 타입 (위경도 좌표 저장용)
    start_point GEOMETRY(Point, 4326), 
    end_point GEOMETRY(Point, 4326),
    
    path_length_km FLOAT,             -- 총길이(km)
    path_width_m FLOAT,               -- 자전거도로너비(m)
    path_type VARCHAR(100),           -- 자전거도로종류 (전용도로, 우선도로 등)
    
    management_agency VARCHAR(100),   -- 관리기관명
    last_updated DATE                 -- 데이터기준일자
);

-- 공간 인덱스 생성 (조회 성능 최적화)
CREATE INDEX idx_bicycle_paths_start_point ON bicycle_paths USING GIST (start_point);

CREATE TABLE bicycle_routes (
    id SERIAL PRIMARY KEY,
    route_name VARCHAR(255),           -- 노선명 (예: 해마루공원로...)
    city_province VARCHAR(50),         -- 시도명 (경상북도)
    city_district VARCHAR(50),         -- 시군구명 (구미시)
    
    -- 위치 정보 (위도/경도가 있으면 저장, 없으면 NULL)
    start_lat DECIMAL(10, 8),
    start_lon DECIMAL(11, 8),
    end_lat DECIMAL(10, 8),
    end_lon DECIMAL(11, 8),
    
    -- PostGIS 공간 데이터 (지도 검색 최적화용)
    geom_start GEOMETRY(Point, 4326),
    geom_end GEOMETRY(Point, 4326),
    
    total_length_km FLOAT,             -- 총길이 (0.05)
    road_width_m FLOAT,                -- 자전거도로너비 (4.5)
    route_type VARCHAR(100),           -- 자전거도로종류
    
    management_agency VARCHAR(100),    -- 관리기관명
    base_date DATE                     -- 데이터기준일자
);

-- 공간 인덱스 (위치 기반 조회 속도 향상)
CREATE INDEX idx_bicycle_routes_geom ON bicycle_routes USING GIST (geom_start);

-- ── 사용자 K-Ride 활동 이력 ─────────────────────────────────────────────────
-- 최소 저장 항목: 사용자, 날짜, 거리, 안전 점수, 관광 점수, 방문 지역, 추천 POI
CREATE TABLE IF NOT EXISTS user_route_history (
    id              BIGSERIAL    PRIMARY KEY,
    user_sqno       BIGINT,
    user_id         VARCHAR(100),
    recorded_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- 요청 유형: route (A→B 경로) | course (순환 코스) | itinerary (AI 일정)
    request_type    VARCHAR(20)  NOT NULL,
    distance_km     DECIMAL(10, 3),
    safety_score    DECIMAL(5, 4),
    tourism_score   DECIMAL(5, 4),
    -- 방문 지역 목록 (JSON 배열: ["서울", "강남"])
    regions         JSONB        DEFAULT '[]'::jsonb,
    -- 추천 POI 목록 (JSON 배열: [{"name":"...", "lat":..., "lon":...}])
    recommended_pois JSONB       DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_route_history_user_sqno ON user_route_history (user_sqno);
CREATE INDEX IF NOT EXISTS idx_user_route_history_recorded_at ON user_route_history (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_route_history_request_type ON user_route_history (request_type);