-- V46: INTRO1/2/3 레이아웃 수정 (스크린샷 피드백 반영 — 0517)

-- ─────────────────────────────────────────────────────────────
-- INTRO1: 타이핑 효과 + 여백 수정
-- ─────────────────────────────────────────────────────────────

-- 제목 → TYPEWRITER_TEXT 컴포넌트로 변경 (한 자씩 나타나는 효과)
UPDATE ui_metadata
SET component_type = 'TYPEWRITER_TEXT',
    css_class = 'text-3xl font-black text-white text-center leading-snug'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_title';

-- 서브 타이틀 하단 여백 추가
UPDATE ui_metadata
SET css_class = 'text-gray-400 text-base text-center mb-4'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_sub';

-- 버튼 그룹: mt-auto 제거 → 화면 수직 중앙 배치
UPDATE ui_metadata
SET css_class = 'flex flex-col gap-4 w-full max-w-sm mt-6'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_buttons';

-- ─────────────────────────────────────────────────────────────
-- INTRO2: 패딩 + 헤더 타이틀 스타일 + 그리드 정렬
-- ─────────────────────────────────────────────────────────────

-- 루트 상단 패딩 조정
UPDATE ui_metadata
SET css_class = 'min-h-screen bg-black flex flex-col px-6 pt-4 pb-10 gap-4'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'intro2_root';

-- 제목: sticky 헤더 (흰 글씨, 검은 배경, 항상 상단 고정)
UPDATE ui_metadata
SET css_class = 'sticky top-0 bg-black z-10 py-3 text-xl font-bold text-white'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'intro2_title';

-- 아티스트 그리드: place-items-center 제거하여 정렬 안정화
UPDATE ui_metadata
SET css_class = 'grid grid-cols-3 gap-6 pb-24 w-full'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'artist_grid';

-- ─────────────────────────────────────────────────────────────
-- INTRO3: 패딩 + 헤더 타이틀 스타일 + 4열 그리드 변경
-- ─────────────────────────────────────────────────────────────

-- 루트 상단 패딩 조정
UPDATE ui_metadata
SET css_class = 'min-h-screen bg-black flex flex-col px-6 pt-4 pb-10 gap-4'
WHERE screen_id = 'KRIDE_INTRO3' AND component_id = 'intro3_root';

-- 제목: sticky 헤더 (흰 글씨, 검은 배경)
UPDATE ui_metadata
SET css_class = 'sticky top-0 bg-black z-10 py-3 text-xl font-bold text-white'
WHERE screen_id = 'KRIDE_INTRO3' AND component_id = 'intro3_title';

-- 지역 그리드: 4열 고정 (12개 지역 = 4×3, chip이 각 셀을 채움)
-- chip SelectionCard는 w-full로 셀을 채우도록 프론트엔드에서 수정됨
UPDATE ui_metadata
SET css_class = 'grid grid-cols-4 gap-3 pb-28'
WHERE screen_id = 'KRIDE_INTRO3' AND component_id = 'region_grid';
