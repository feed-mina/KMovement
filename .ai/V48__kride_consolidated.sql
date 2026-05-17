-- K-Ride 통합 마이그레이션 (V40~V47 최종 상태)
-- 적용: pgAdmin Query Tool에서 실행 → Spring Boot + Next.js 재시작
-- 변경점: btn_2n3d component_id 수정, V46 region_grid grid 적용, V47 z-50 등

-- ─────────────────────────────────────────────────────────────
-- 1. 기존 KRIDE 데이터 삭제
-- ─────────────────────────────────────────────────────────────
DELETE FROM ui_metadata WHERE screen_id LIKE 'KRIDE_%';
DELETE FROM query_master WHERE sql_key LIKE 'kride_%';

-- ─────────────────────────────────────────────────────────────
-- 2. query_master (V41)
-- ─────────────────────────────────────────────────────────────
INSERT INTO query_master (sql_key, query_text, return_type, description, created_at)
VALUES
(
  'kride_artist_list',
  'SELECT id, name, ''''::text AS "imageUrl" FROM (VALUES (1,''BTS''),(2,''BLACKPINK''),(3,''IVE''),(4,''aespa''),(5,''NewJeans''),(6,''TWICE''),(7,''EXO''),(8,''STRAY KIDS''),(9,''SEVENTEEN''),(10,''LE SSERAFIM'')) AS t(id, name)',
  'MULTI', 'KRIDE 아티스트 목록 (정적)', NOW()
),
(
  'kride_region_list',
  'SELECT id, name, ''''::text AS "imageUrl" FROM (VALUES (1,''서울''),(2,''부산''),(3,''제주''),(4,''경주''),(5,''인천''),(6,''강원''),(7,''여수''),(8,''전주''),(9,''춘천''),(10,''속초''),(11,''대구''),(12,''광주'')) AS t(id, name)',
  'MULTI', 'KRIDE 지역 목록 (정적)', NOW()
),
(
  'kride_purpose_list',
  'SELECT "purposeKey" FROM (VALUES (''food''),(''kculture''),(''nature''),(''history''),(''shopping''),(''rest'')) AS t("purposeKey")',
  'MULTI', 'KRIDE 여행 목적 목록 (정적)', NOW()
)
ON CONFLICT (sql_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 3. KRIDE_INTRO1 (V40+V43+V44+V46 최종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_INTRO1', 'intro1_root',    'GROUP',           '',                           1, 'intro1_root',    NULL,             'COLUMN', 'min-h-screen bg-black flex flex-col items-center px-6 pt-12 pb-8 gap-6', NULL, NULL,           NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'intro1_hero',    'IMAGE',           'kride/intro1_hero.svg',      1, NULL,             'intro1_root',    NULL,     'w-full max-w-xs h-56 object-contain mx-auto',                             NULL, NULL,           NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'intro1_title',   'TYPEWRITER_TEXT', '어떤 여행을 떠나실 건가요?',  2, NULL,             'intro1_root',    NULL,     'text-3xl font-black text-white text-center leading-snug',                 NULL, NULL,           NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'intro1_sub',     'TEXT',            '여행 기간을 선택해주세요',     3, NULL,             'intro1_root',    NULL,     'text-gray-400 text-base text-center mb-4',                                NULL, NULL,           NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'intro1_buttons', 'GROUP',           '',                           4, 'intro1_buttons', 'intro1_root',    'COLUMN', 'flex flex-col gap-4 w-full max-w-sm mt-6',                                NULL, NULL,           NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'btn_day',        'DURATION_BUTTON', '당일치기',                    5, NULL,             'intro1_buttons', NULL,     NULL,                                                                      NULL, 'SET_DURATION', NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'btn_1n2d',       'DURATION_BUTTON', '1박 2일',                    6, NULL,             'intro1_buttons', NULL,     NULL,                                                                      NULL, 'SET_DURATION', NULL, NULL, true, NULL),
('KRIDE_INTRO1', 'btn_2n3d',       'DURATION_BUTTON', '2박 3일',                    7, NULL,             'intro1_buttons', NULL,     NULL,                                                                      NULL, 'SET_DURATION', NULL, NULL, true, NULL);

-- ─────────────────────────────────────────────────────────────
-- 4. KRIDE_INTRO2 (V40+V41+V42+V43+V46 최종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_INTRO2', 'intro2_root',     'GROUP',          '',                                    1,  'intro2_root', NULL,          'COLUMN', 'min-h-screen bg-black flex flex-col px-6 pt-4 pb-10 gap-4',                              NULL,         NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO2', 'intro2_title',    'TEXT',           '좋아하는 아이돌/배우를 선택해주세요',   2,  NULL,          'intro2_root', NULL,     'sticky top-0 bg-black z-10 py-3 text-xl font-bold text-white',                           NULL,         NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO2', 'intro2_sub',      'TEXT',           '최대 5명까지 선택할 수 있어요',         3,  NULL,          'intro2_root', NULL,     'text-gray-400 text-sm',                                                                  NULL,         NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO2', 'artist_grid',     'GROUP',          '',                                    4,  'artist_grid', 'intro2_root', 'ROW',    'grid grid-cols-3 gap-6 pb-24 w-full',                                                    'artistList', NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO2', 'artist_card',     'SELECTION_CARD', '',                                    5,  NULL,          'artist_grid', NULL,     'circle',                                                                                 NULL,         'TOGGLE_ARTIST', NULL,              NULL,                 true, NULL),
('KRIDE_INTRO2', 'artistList',      'DATA_SOURCE',    '',                                   99,  NULL,          NULL,          NULL,     NULL,                                                                                     NULL,         'AUTO_FETCH',    NULL,              'kride_artist_list',  true, NULL),
('KRIDE_INTRO2', 'intro2_warning',  'KRIDE_WARNING',  '',                                   20,  NULL,          'intro2_root', NULL,     '',                                                                                       NULL,         NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO2', 'intro2_next_btn', 'KRIDE_NEXT_BTN', '다음',                               10,  NULL,          'intro2_root', NULL,     'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent', NULL,        'ROUTE',         '/view/INTRO3',    NULL,                 true, '{"checkKey": "selectedArtists", "minCount": 1}'::jsonb);

-- ─────────────────────────────────────────────────────────────
-- 5. KRIDE_INTRO3 (V40+V41+V42+V43+V46+V47 최종)
-- 핵심: region_grid css_class에 'grid' 포함 → DynamicEngine wrapper 작동
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_INTRO3', 'intro3_root',     'GROUP',          '',                                    1,  'intro3_root', NULL,          'COLUMN', 'min-h-screen bg-black flex flex-col px-6 pt-4 pb-10 gap-4',                              NULL,          NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO3', 'intro3_title',    'TEXT',           '어느 지역을 여행하고 싶으신가요?',      2,  NULL,          'intro3_root', NULL,     'sticky top-0 bg-black z-10 py-3 text-xl font-bold text-white',                           NULL,          NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO3', 'intro3_sub',      'TEXT',           '최대 2곳까지 선택할 수 있어요',         3,  NULL,          'intro3_root', NULL,     'text-gray-400 text-sm',                                                                  NULL,          NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO3', 'region_grid',     'GROUP',          '',                                    4,  'region_grid', 'intro3_root', 'ROW',    'grid grid-cols-4 gap-3 pb-28',                                                           'regionList',  NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO3', 'region_card',     'SELECTION_CARD', '',                                    5,  NULL,          'region_grid', NULL,     'chip',                                                                                   NULL,          'TOGGLE_REGION', NULL,              NULL,                 true, NULL),
('KRIDE_INTRO3', 'regionList',      'DATA_SOURCE',    '',                                   99,  NULL,          NULL,          NULL,     NULL,                                                                                     NULL,          'AUTO_FETCH',    NULL,              'kride_region_list',  true, NULL),
('KRIDE_INTRO3', 'intro3_warning',  'KRIDE_WARNING',  '',                                   20,  NULL,          'intro3_root', NULL,     '',                                                                                       NULL,          NULL,            NULL,              NULL,                 true, NULL),
('KRIDE_INTRO3', 'intro3_next_btn', 'KRIDE_NEXT_BTN', '다음',                               10,  NULL,          'intro3_root', NULL,     'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent', NULL,         'ROUTE',         '/view/INTRO4',    NULL,                 true, '{"checkKey": "selectedRegions", "minCount": 1}'::jsonb);

-- ─────────────────────────────────────────────────────────────
-- 6. KRIDE_INTRO4 (V40+V41+V42+V45+V47 최종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_INTRO4', 'intro4_root',      'GROUP',        '',                      1,  'intro4_root',      NULL,               'COLUMN', 'min-h-screen bg-black flex flex-col px-6 pt-4 pb-28 gap-3',                                    NULL,          NULL,          NULL,              NULL,                  true, NULL),
('KRIDE_INTRO4', 'intro4_title',     'TEXT',         '여행 목적을 알려주세요',  2,  NULL,               'intro4_root',      NULL,     'sticky top-0 bg-black z-10 py-3 text-2xl font-bold text-white',                               NULL,          NULL,          NULL,              NULL,                  true, NULL),
('KRIDE_INTRO4', 'intro4_sub',       'TEXT',         '1개만 선택할 수 있어요',  3,  NULL,               'intro4_root',      NULL,     'text-gray-400 text-sm',                                                                       NULL,          NULL,          NULL,              NULL,                  true, NULL),
('KRIDE_INTRO4', 'purpose_grid',     'GROUP',        '',                      4,  'purpose_grid',     'intro4_root',      'COLUMN', 'w-full',                                                                                      'purposeList', NULL,          NULL,              NULL,                  true, NULL),
('KRIDE_INTRO4', 'purpose_card',     'PURPOSE_CARD', '',                      5,  NULL,               'purpose_grid',     NULL,     NULL,                                                                                          NULL,          'SET_PURPOSES', NULL,             NULL,                  true, NULL),
('KRIDE_INTRO4', 'purposeList',      'DATA_SOURCE',  '',                     99,  NULL,               NULL,               NULL,     NULL,                                                                                          NULL,          'AUTO_FETCH',  NULL,              'kride_purpose_list',  true, NULL),
('KRIDE_INTRO4', 'intro4_next_wrap', 'GROUP',        '',                     10,  'intro4_next_wrap', 'intro4_root',      'COLUMN', 'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent z-50', NULL,          NULL,          NULL,              NULL,                  true, NULL),
('KRIDE_INTRO4', 'intro4_next_btn',  'BUTTON',       '다음',                 11,  NULL,               'intro4_next_wrap', NULL,     'w-full py-4 rounded-full bg-red-600 text-white font-bold text-lg',                            NULL,          'ROUTE',       '/view/INTRO5',    NULL,                  true, NULL);

-- ─────────────────────────────────────────────────────────────
-- 7. KRIDE_INTRO5 (V40+V42 최종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_INTRO5', 'intro5_root',      'GROUP',             '',                         1,  'intro5_root',      NULL,               'COLUMN', 'min-h-screen bg-black flex flex-col items-center justify-center px-8 gap-10', NULL, NULL,           NULL,            NULL, true, NULL),
('KRIDE_INTRO5', 'intro5_title',     'TEXT',              '여행 예산을 설정해주세요',   2,  NULL,               'intro5_root',      NULL,     'text-2xl font-bold text-white text-center',                                  NULL, NULL,           NULL,            NULL, true, NULL),
('KRIDE_INTRO5', 'intro5_sub',       'TEXT',              '1인 기준 총 여행 경비예요',  3,  NULL,               'intro5_root',      NULL,     'text-gray-400 text-sm text-center',                                          NULL, NULL,           NULL,            NULL, true, NULL),
('KRIDE_INTRO5', 'budget_slider',    'DUAL_RANGE_SLIDER', '',                         4,  NULL,               'intro5_root',      NULL,     'w-full max-w-md',                                                            NULL, 'SET_BUDGET',   NULL,            NULL, true, NULL),
('KRIDE_INTRO5', 'intro5_next_wrap', 'GROUP',             '',                        10,  'intro5_next_wrap', 'intro5_root',      'COLUMN', 'w-full max-w-md',                                                            NULL, NULL,           NULL,            NULL, true, NULL),
('KRIDE_INTRO5', 'intro5_next_btn',  'BUTTON',            'AI 여행 추천 받기 ✨',      11,  NULL,               'intro5_next_wrap', NULL,     'w-full py-5 rounded-2xl bg-gradient-to-r from-red-700 to-red-500 text-white font-bold text-lg', NULL, 'GOTO_MY_LIST', '/view/MY_LIST', NULL, true, NULL);

-- ─────────────────────────────────────────────────────────────
-- 8. KRIDE_MY_LIST (V40 최종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_MY_LIST', 'mylist_root',   'GROUP',  '',                     1, 'mylist_root', NULL,          'COLUMN', 'min-h-screen bg-black text-white px-6 py-10 flex flex-col gap-8 max-w-2xl mx-auto',              NULL, NULL,         NULL,         NULL, true, NULL),
('KRIDE_MY_LIST', 'mylist_title',  'TEXT',   '나의 여행 요약',          2, NULL,          'mylist_root', NULL,     'text-3xl font-bold',                                                                             NULL, NULL,         NULL,         NULL, true, NULL),
('KRIDE_MY_LIST', 'ai_banner_btn', 'BUTTON', '✨ AI 여행 일정 보기',    3, NULL,          'mylist_root', NULL,     'w-full py-6 rounded-2xl bg-gradient-to-r from-red-700 to-red-500 text-2xl font-bold',            NULL, 'GOTO_FOCUS', '/focus',     NULL, true, NULL);

-- ─────────────────────────────────────────────────────────────
-- 9. KRIDE_FOCUS (V40 최종)
-- ─────────────────────────────────────────────────────────────
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order,
   group_id, parent_group_id, group_direction, css_class,
   ref_data_id, action_type, action_url, data_sql_key, is_visible, component_props)
VALUES
('KRIDE_FOCUS', 'focus_root',  'GROUP',           '', 1, 'focus_root', NULL,         'ROW',  'flex h-screen bg-black overflow-hidden', NULL,        NULL, NULL, NULL, true, NULL),
('KRIDE_FOCUS', 'focus_map',   'MAP_VIEW',        '', 2, NULL,         'focus_root', NULL,   'w-[60%] h-full',                         'mapData',   NULL, NULL, NULL, true, NULL),
('KRIDE_FOCUS', 'focus_panel', 'ITINERARY_PANEL', '', 3, NULL,         'focus_root', NULL,   'w-[40%] h-full bg-gray-950',             'itinerary', NULL, NULL, NULL, true, NULL);
