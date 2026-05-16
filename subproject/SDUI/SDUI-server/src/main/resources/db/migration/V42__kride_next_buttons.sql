-- V42: KRIDE 온보딩 화면 다음 버튼 추가
-- INTRO2/3: KRIDE_NEXT_BTN (선택 1개 이상일 때만 표시, component_props로 조건 지정)
-- INTRO4/5: 항상 표시되는 고정 버튼

INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, action_url, is_visible, component_props)
VALUES
-- INTRO2: 아티스트 1개 이상 선택 시 표시
('KRIDE_INTRO2', 'intro2_next_btn', 'KRIDE_NEXT_BTN', '다음', 10, NULL, 'intro2_root', NULL,
 'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent',
 'ROUTE', '/view/INTRO3', true, '{"checkKey": "selectedArtists", "minCount": 1}'::jsonb),

-- INTRO3: 지역 1개 이상 선택 시 표시
('KRIDE_INTRO3', 'intro3_next_btn', 'KRIDE_NEXT_BTN', '다음', 10, NULL, 'intro3_root', NULL,
 'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent',
 'ROUTE', '/view/INTRO4', true, '{"checkKey": "selectedRegions", "minCount": 1}'::jsonb),

-- INTRO4: 목적 선택 완료 후 예산 설정으로 (항상 표시)
('KRIDE_INTRO4', 'intro4_next_wrap', 'GROUP',  '', 10, 'intro4_next_wrap', 'intro4_root', 'COLUMN',
 'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent',
 NULL, NULL, true, NULL),
('KRIDE_INTRO4', 'intro4_next_btn',  'BUTTON', '다음', 11, NULL, 'intro4_next_wrap', NULL,
 'w-full py-4 rounded-full bg-red-600 text-white font-bold text-lg',
 'ROUTE', '/view/INTRO5', true, NULL),

-- INTRO5: 예산 설정 완료 후 AI 추천 결과로 (항상 표시)
('KRIDE_INTRO5', 'intro5_next_wrap', 'GROUP',  '', 10, 'intro5_next_wrap', 'intro5_root', 'COLUMN',
 'w-full max-w-md', NULL, NULL, true, NULL),
('KRIDE_INTRO5', 'intro5_next_btn',  'BUTTON', 'AI 여행 추천 받기 ✨', 11, NULL, 'intro5_next_wrap', NULL,
 'w-full py-5 rounded-2xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-lg',
 'GOTO_MY_LIST', '/view/MY_LIST', true, NULL);
