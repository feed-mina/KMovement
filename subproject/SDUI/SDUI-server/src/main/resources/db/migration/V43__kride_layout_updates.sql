-- V43: KRIDE INTRO1/2/3 레이아웃 수정 (Netflix/TED 레퍼런스 스타일)

-- ─────────────────────────────────────────────────────────────
-- INTRO1: 히어로 이미지 추가 + 레이아웃 수정
-- ImageField는 label_text → /img/{label_text} 경로로 렌더링
-- 실제 이미지: metadata-project/public/img/kride/intro1_hero.png 에 배치 필요
-- ─────────────────────────────────────────────────────────────

INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, action_url, is_visible)
VALUES
('KRIDE_INTRO1', 'intro1_hero', 'IMAGE', 'kride/intro1_hero.png', 1, NULL, 'intro1_root', NULL,
 'w-full max-w-xs h-56 object-contain mx-auto', NULL, NULL, true);

-- intro1_root: justify-center 제거, 이미지+텍스트+버튼이 위→아래 자연스럽게 쌓이도록
UPDATE ui_metadata
SET css_class = 'min-h-screen bg-black flex flex-col items-center px-6 pt-12 pb-8 gap-6'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_root';

-- intro1_title: Netflix 스타일 큰 볼드 폰트
UPDATE ui_metadata
SET css_class = 'text-4xl font-black text-white text-center leading-tight'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_title';

-- intro1_buttons: mt-auto 로 하단 고정, 너비 확장
UPDATE ui_metadata
SET css_class = 'flex flex-col gap-4 w-full max-w-sm mt-auto'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_buttons';

-- ─────────────────────────────────────────────────────────────
-- INTRO2: 아티스트 그리드 4열 → 3열 + 중앙정렬
-- ─────────────────────────────────────────────────────────────

UPDATE ui_metadata
SET css_class = 'grid grid-cols-3 gap-6 pb-24 place-items-center w-full'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'artist_grid';

-- INTRO2 경고 토스트 (선택 한도 초과 시 하단에 메시지 표시)
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, action_url, is_visible)
VALUES
('KRIDE_INTRO2', 'intro2_warning', 'KRIDE_WARNING', '', 20, NULL, 'intro2_root', NULL, '', NULL, NULL, true);

-- ─────────────────────────────────────────────────────────────
-- INTRO3: 지역 선택 TED 스타일 chip 태그로 변경
-- SelectionCard.tsx에서 css_class='chip' 이면 chip 모드로 렌더링
-- ─────────────────────────────────────────────────────────────

UPDATE ui_metadata
SET css_class = 'flex flex-wrap gap-3 pb-24 justify-center'
WHERE screen_id = 'KRIDE_INTRO3' AND component_id = 'region_grid';

UPDATE ui_metadata
SET css_class = 'chip'
WHERE screen_id = 'KRIDE_INTRO3' AND component_id = 'region_card';

-- INTRO3 경고 토스트 (지역 2개 초과 시 메시지 표시)
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, action_url, is_visible)
VALUES
('KRIDE_INTRO3', 'intro3_warning', 'KRIDE_WARNING', '', 20, NULL, 'intro3_root', NULL, '', NULL, NULL, true);
