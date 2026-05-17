-- KRIDE flex-wrap 레이아웃 마이그레이션 (V49)
-- 적용: pgAdmin Query Tool에서 실행 → Spring Boot + Next.js 재시작
--
-- 변경점:
--   artist_grid: css_class = 'grid kride-artist-grid' → 'kride-artist-grid flex-wrap'
--   region_grid: css_class = 'grid kride-region-grid' → 'kride-region-grid flex-wrap'
--
-- 작동 원리:
--   'flex-wrap' 키워드 → DynamicEngine wrapper 방식 트리거 (line 88 수정됨)
--   'kride-*-grid'    → KRIDE.css에서 display:flex + flex-wrap + gap 정의
--   cascade 충돌 없음 (grid 키워드 제거)

-- ── KRIDE_INTRO2: 아티스트 3열 ──
UPDATE ui_metadata
SET css_class = 'kride-artist-grid flex-wrap'
WHERE screen_id = 'KRIDE_INTRO2'
  AND component_id = 'artist_grid';

-- ── KRIDE_INTRO3: 지역 4열 ──
UPDATE ui_metadata
SET css_class = 'kride-region-grid flex-wrap'
WHERE screen_id = 'KRIDE_INTRO3'
  AND component_id = 'region_grid';

-- 확인
SELECT screen_id, component_id, css_class, group_direction, ref_data_id
FROM ui_metadata
WHERE screen_id IN ('KRIDE_INTRO2', 'KRIDE_INTRO3')
  AND component_id IN ('artist_grid', 'region_grid');
