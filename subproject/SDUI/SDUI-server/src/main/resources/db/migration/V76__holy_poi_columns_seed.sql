-- V76: 성지(HOLY) POI 파이프라인 1차 — tour_poi 성지 확장 컬럼 + 시드 이관
-- Epic #74 · Dev-4(#96-A, 구 #78). 스키마 승인 2026-07-11.
-- 플랜: .ai/0711_holy_poi_pipeline_plan.md

-- 1) 성지 확장 컬럼 (기존 행 영향 없음 — ADD COLUMN만)
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS artist           VARCHAR(120);
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS fandom_info      VARCHAR(255);
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS recommend_reason VARCHAR(500);
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS source_url       TEXT;
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS review_status    VARCHAR(12) NOT NULL DEFAULT 'APPROVED';
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS reviewed_by      VARCHAR(60);
ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMP;

COMMENT ON COLUMN tour_poi.artist           IS '연관 아티스트 (성지 전용)';
COMMENT ON COLUMN tour_poi.fandom_info      IS '팬덤 관점 한줄 설명 (성지 전용)';
COMMENT ON COLUMN tour_poi.recommend_reason IS '추천 이유 (성지 전용)';
COMMENT ON COLUMN tour_poi.source_url       IS '근거 출처 URL — 저작권/사실 추적용';
COMMENT ON COLUMN tour_poi.review_status    IS 'PENDING | APPROVED | REJECTED — 검수 큐 상태. 공공(TOURAPI) 행은 기본 APPROVED';

-- 2) 성지 조회용 부분 인덱스 (공공 데이터 제외)
CREATE INDEX IF NOT EXISTS idx_tour_poi_holy
    ON tour_poi(source, review_status)
    WHERE source <> 'TOURAPI';

-- 3) 시드 이관 — 프론트 하드코딩(lib/data/holySites.ts) 8건.
--    잘 알려진 공개 장소의 사실 기반 정보. content_id 유니크 인덱스로 재실행 멱등.
INSERT INTO tour_poi (content_id, content_type_id, source, title, addr, map_x, map_y,
                      area_code, artist, fandom_info, recommend_reason, review_status)
VALUES
  ('holy-ttukseom',    'HOLY', 'SEED', '뚝섬한강공원',              '서울특별시 광진구 강변북로 139',      127.0693, 37.5311, '1', 'BTS·aespa',     'K-pop 뮤비·예능 단골 촬영지',       '한강뷰 인증샷 명당, 근처 카페 동선과 묶기 좋아요.', 'APPROVED'),
  ('holy-bukchon',     'HOLY', 'SEED', '북촌 한옥마을',             '서울특별시 종로구 계동길 37',         126.9850, 37.5826, '1', 'IVE·NewJeans',  '화보·뮤비 한옥 배경 성지',          '한복 대여 후 촬영하기 좋은 골목, 경복궁과 도보 코스.', 'APPROVED'),
  ('holy-seoulforest', 'HOLY', 'SEED', '서울숲',                    '서울특별시 성동구 뚝섬로 273',        127.0374, 37.5444, '1', 'aespa',         '뮤비 촬영지 · 팬 성지',             '산책 동선이 좋고 성수 카페거리와 이어져요.', 'APPROVED'),
  ('holy-namsan',      'HOLY', 'SEED', '남산서울타워',              '서울특별시 용산구 남산공원길 105',    126.9883, 37.5512, '1', '다수',          '드라마·예능·뮤비 대표 촬영지',      '서울 전경 야경 명소, 사랑의 자물쇠 인증.', 'APPROVED'),
  ('holy-banpo',       'HOLY', 'SEED', '반포한강공원 무지개분수',   '서울특별시 서초구 신반포로11길 40',   126.9963, 37.5100, '1', '다수',          '뮤비·예능 야경 촬영지',             '저녁 분수쇼 시간대 방문 추천, 치맥 성지.', 'APPROVED'),
  ('holy-seongsu',     'HOLY', 'SEED', '성수동 카페거리',           '서울특별시 성동구 연무장길',          127.0558, 37.5444, '1', 'NewJeans',      '팝업·화보 성지',                    '아이돌 팝업스토어가 자주 열리는 핫플, 감성 카페 밀집.', 'APPROVED'),
  ('holy-ddp',         'HOLY', 'SEED', 'DDP 동대문디자인플라자',    '서울특별시 중구 을지로 281',          127.0094, 37.5669, '1', '다수',          '패션위크·뮤비 배경',                '미래적 건축 배경 촬영, 야간 조명 인증샷.', 'APPROVED'),
  ('holy-lotte',       'HOLY', 'SEED', '서울스카이 (롯데월드타워)', '서울특별시 송파구 올림픽로 300',      127.1025, 37.5126, '1', '다수',          '전망대 성지',                       '국내 최고층 전망, 잠실 코스 마무리로 좋아요.', 'APPROVED')
ON CONFLICT (content_id) WHERE content_id IS NOT NULL DO NOTHING;
