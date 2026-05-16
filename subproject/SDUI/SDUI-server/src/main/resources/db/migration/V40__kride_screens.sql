-- K-Ride 온보딩 화면 메타데이터
-- MSA 연동: netflix-clone-main DynamicEngine이 GET /api/ui/{screenId}로 호출

-- =============================================
-- KRIDE_INTRO1: 여행 기간 선택 (당일치기/1박2일/2박3일)
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, is_visible)
VALUES
('KRIDE_INTRO1', 'intro1_root',    'GROUP',           '',       1, 'intro1_root',    NULL,             'COLUMN', 'min-h-screen bg-black flex flex-col items-center justify-center gap-8 px-6', NULL,           true),
('KRIDE_INTRO1', 'intro1_title',   'TEXT',            '어떤 여행을 떠나실 건가요?', 2, NULL, 'intro1_root', NULL, 'text-3xl font-bold text-white text-center', NULL, true),
('KRIDE_INTRO1', 'intro1_sub',     'TEXT',            '여행 기간을 선택해주세요', 3, NULL, 'intro1_root', NULL, 'text-gray-400 text-base text-center', NULL, true),
('KRIDE_INTRO1', 'intro1_buttons', 'GROUP',           '',       4, 'intro1_buttons', 'intro1_root',    'COLUMN', 'flex flex-col gap-4 w-full max-w-xs', NULL, true),
('KRIDE_INTRO1', 'btn_day',        'DURATION_BUTTON', '당일치기',  5, NULL,             'intro1_buttons', NULL,     NULL, 'SET_DURATION', true),
('KRIDE_INTRO1', 'btn_1n2d',       'DURATION_BUTTON', '1박 2일',  6, NULL,             'intro1_buttons', NULL,     NULL, 'SET_DURATION', true),
('KRIDE_INTRO1', '![1778847076436](image/V40__kride_screens/1778847076436.png)',       'DURATION_BUTTON', '2박 3일',  7, NULL,             'intro1_buttons', NULL,     NULL, 'SET_DURATION', true);

-- =============================================
-- KRIDE_INTRO2: 아티스트 선택 (Repeater 패턴)
-- ref_data_id='artistList' → K-Ride FastAPI에서 배열로 전달
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, ref_data_id, action_type, is_visible)
VALUES
('KRIDE_INTRO2', 'intro2_root',   'GROUP',          '',                          1, 'intro2_root',  NULL,          'COLUMN', 'min-h-screen bg-black flex flex-col px-6 py-10 gap-6', NULL,         NULL,          true),
('KRIDE_INTRO2', 'intro2_title',  'TEXT',           '좋아하는 아이돌/배우를 선택해주세요', 2, NULL, 'intro2_root', NULL, 'text-2xl font-bold text-white', NULL, NULL, true),
('KRIDE_INTRO2', 'intro2_sub',    'TEXT',           '최대 5명까지 선택할 수 있어요', 3, NULL, 'intro2_root', NULL, 'text-gray-400 text-sm', NULL, NULL, true),
('KRIDE_INTRO2', 'artist_grid',   'GROUP',          '',                          4, 'artist_grid',  'intro2_root', 'ROW',    'grid grid-cols-4 gap-4 pb-24', 'artistList', NULL,          true),
('KRIDE_INTRO2', 'artist_card',   'SELECTION_CARD', '',                          5, NULL,           'artist_grid', NULL,     'circle',                       NULL,         'TOGGLE_ARTIST', true);

-- =============================================
-- KRIDE_INTRO3: 지역 선택 (Repeater 패턴)
-- ref_data_id='regionList' → K-Ride FastAPI에서 배열로 전달
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, ref_data_id, action_type, is_visible)
VALUES
('KRIDE_INTRO3', 'intro3_root',   'GROUP',          '',                         1, 'intro3_root', NULL,          'COLUMN', 'min-h-screen bg-black flex flex-col px-6 py-10 gap-6', NULL,         NULL,          true),
('KRIDE_INTRO3', 'intro3_title',  'TEXT',           '어느 지역을 여행하고 싶으신가요?', 2, NULL, 'intro3_root', NULL, 'text-2xl font-bold text-white', NULL, NULL, true),
('KRIDE_INTRO3', 'intro3_sub',    'TEXT',           '최대 5곳까지 선택할 수 있어요', 3, NULL, 'intro3_root', NULL, 'text-gray-400 text-sm', NULL, NULL, true),
('KRIDE_INTRO3', 'region_grid',   'GROUP',          '',                         4, 'region_grid', 'intro3_root', 'ROW',    'grid grid-cols-4 gap-4 pb-24', 'regionList', NULL,          true),
('KRIDE_INTRO3', 'region_card',   'SELECTION_CARD', '',                         5, NULL,          'region_grid', NULL,     'square',                       NULL,         'TOGGLE_REGION', true);

-- =============================================
-- KRIDE_INTRO4: 여행 목적 선택 (PURPOSE_CARD × 6)
-- purposeKey는 data로 전달되므로 css_class로 key를 지정
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, ref_data_id, action_type, is_visible)
VALUES
('KRIDE_INTRO4', 'intro4_root',    'GROUP',        '',             1, 'intro4_root',   NULL,           'COLUMN', 'min-h-screen bg-black flex flex-col px-6 py-10 gap-6', NULL,          NULL,         true),
('KRIDE_INTRO4', 'intro4_title',   'TEXT',         '여행 목적을 알려주세요', 2, NULL, 'intro4_root', NULL, 'text-2xl font-bold text-white', NULL, NULL, true),
('KRIDE_INTRO4', 'intro4_sub',     'TEXT',         '복수 선택 가능해요', 3, NULL, 'intro4_root', NULL, 'text-gray-400 text-sm', NULL, NULL, true),
('KRIDE_INTRO4', 'purpose_grid',   'GROUP',        '',             4, 'purpose_grid',  'intro4_root',  'COLUMN', 'flex flex-col gap-3 pb-24', 'purposeList', NULL,         true),
('KRIDE_INTRO4', 'purpose_card',   'PURPOSE_CARD', '',             5, NULL,            'purpose_grid', NULL,     NULL,                        NULL,          'SET_PURPOSES', true);

-- =============================================
-- KRIDE_INTRO5: 예산 슬라이더
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, is_visible)
VALUES
('KRIDE_INTRO5', 'intro5_root',   'GROUP',             '',                     1, 'intro5_root', NULL,          'COLUMN', 'min-h-screen bg-black flex flex-col items-center justify-center px-8 gap-10', NULL,       true),
('KRIDE_INTRO5', 'intro5_title',  'TEXT',              '여행 예산을 설정해주세요',   2, NULL, 'intro5_root', NULL, 'text-2xl font-bold text-white text-center', NULL, true),
('KRIDE_INTRO5', 'intro5_sub',    'TEXT',              '1인 기준 총 여행 경비예요', 3, NULL, 'intro5_root', NULL, 'text-gray-400 text-sm text-center', NULL, true),
('KRIDE_INTRO5', 'budget_slider', 'DUAL_RANGE_SLIDER', '',                     4, NULL, 'intro5_root', NULL, 'w-full max-w-md', 'SET_BUDGET', true);

-- =============================================
-- KRIDE_MY_LIST: 온보딩 요약 + AI 추천 배너
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, action_type, action_url, is_visible)
VALUES
('KRIDE_MY_LIST', 'mylist_root',   'GROUP',  '',                      1, 'mylist_root',  NULL,           'COLUMN', 'min-h-screen bg-black text-white px-6 py-10 flex flex-col gap-8 max-w-2xl mx-auto', NULL,        NULL,      true),
('KRIDE_MY_LIST', 'mylist_title',  'TEXT',   '나의 여행 요약',           2, NULL,           'mylist_root',  NULL,     'text-3xl font-bold',                                                                NULL,        NULL,      true),
('KRIDE_MY_LIST', 'ai_banner_btn', 'BUTTON', '✨ AI 여행 일정 보기',      3, NULL,           'mylist_root',  NULL,     'w-full py-6 rounded-2xl bg-gradient-to-r from-red-700 to-red-500 text-2xl font-bold', 'GOTO_FOCUS', '/focus',  true);

-- =============================================
-- KRIDE_FOCUS: 지도 + 아코디언 일정 패널
-- =============================================
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction, css_class, ref_data_id, is_visible)
VALUES
('KRIDE_FOCUS', 'focus_root',    'GROUP',            '', 1, 'focus_root',  NULL,         'ROW',    'flex h-screen bg-black overflow-hidden', NULL,        true),
('KRIDE_FOCUS', 'focus_map',     'MAP_VIEW',         '', 2, NULL,          'focus_root', NULL,     'w-[60%] h-full',                         'mapData',   true),
('KRIDE_FOCUS', 'focus_panel',   'ITINERARY_PANEL',  '', 3, NULL,          'focus_root', NULL,     'w-[40%] h-full bg-gray-950',             'itinerary', true);
