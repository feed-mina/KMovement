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

-- K-Ride user route/recommendation activity history.
-- FastAPI writes here best-effort when SUPABASE_URL/SUPABASE_KEY are configured.
--
-- IMPORTANT: This table lives in the FastAPI *Supabase* database, NOT the SDUI
-- Spring/PostgreSQL DB. It is therefore NOT managed by Flyway (db/migration/V*.sql)
-- and the Supabase PostgREST client used by src/api/route_history.py cannot run DDL.
-- Apply this block manually once via the Supabase SQL editor (or psql on the
-- Supabase connection). Until it exists, save_user_route_history() logs a
-- "relation does not exist" hint and the API keeps working (best-effort, no error).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS user_route_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_sqno BIGINT,
    user_id TEXT,
    activity_type VARCHAR(40) NOT NULL,
    activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    distance_km NUMERIC(10, 3),
    safety_score NUMERIC(6, 4),
    tourism_score NUMERIC(6, 4),
    visited_regions TEXT[] NOT NULL DEFAULT '{}',
    recommended_pois JSONB NOT NULL DEFAULT '[]'::jsonb,
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_route_history_user_date
    ON user_route_history (user_sqno, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_route_history_activity_date
    ON user_route_history (activity_type, activity_date DESC);

CREATE INDEX IF NOT EXISTS idx_user_route_history_regions
    ON user_route_history USING GIN (visited_regions);
