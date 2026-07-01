-- V70: K-Ride 사용자 경로/추천 이력 테이블 생성
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

CREATE INDEX idx_user_route_history_user_sqno ON user_route_history (user_sqno);
CREATE INDEX idx_user_route_history_recorded_at ON user_route_history (recorded_at DESC);
CREATE INDEX idx_user_route_history_request_type ON user_route_history (request_type);
