-- V75: 관광 POI 저장 테이블 — TourAPI(공공데이터) + 성지 큐레이션 통합 저장
-- Epic #74 · Dev-2(#76). DB 스키마 승인됨(2026-07-10).
-- ⚠ 대상 위치: SDUI-server/src/main/resources/db/migration/V75__tour_poi.sql
--   (Flyway 자동 실행 파일이라 CLAUDE.md 규칙에 따라 .ai에 먼저 스테이징. 검토 후 대상 폴더로 이동)

CREATE TABLE IF NOT EXISTS tour_poi (
    poi_sqno        BIGSERIAL PRIMARY KEY,
    content_id      VARCHAR(50),                              -- TourAPI contentid (공공) / NULL=수집 성지
    content_type_id VARCHAR(10),                              -- 12=관광지, 39=음식점, 14=문화시설 등
    source          VARCHAR(20) NOT NULL DEFAULT 'TOURAPI',   -- TOURAPI | UGC | CRAWL
    title           VARCHAR(255) NOT NULL,
    addr            VARCHAR(500),
    map_x           DOUBLE PRECISION,                         -- 경도(lng)
    map_y           DOUBLE PRECISION,                         -- 위도(lat)
    first_image     TEXT,
    tel             VARCHAR(100),
    cat1            VARCHAR(20),
    cat2            VARCHAR(20),
    cat3            VARCHAR(20),
    area_code       VARCHAR(10),
    sigungu_code    VARCHAR(10),
    raw_json        JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 공공 POI는 content_id로 중복 방지(성지 수집분은 content_id NULL 허용)
CREATE UNIQUE INDEX IF NOT EXISTS ux_tour_poi_content ON tour_poi(content_id) WHERE content_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tour_poi_area ON tour_poi(area_code, content_type_id);
CREATE INDEX IF NOT EXISTS idx_tour_poi_geo  ON tour_poi(map_x, map_y);

COMMENT ON TABLE tour_poi IS '관광 POI(공공 TourAPI + 성지 큐레이션) 통합 저장 — Epic #74';
