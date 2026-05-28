-- ─────────────────────────────────────────────────────────────────────────────
-- V53__kride_intro_focus_screens.sql
-- KRIDE INTRO1~5 + FOCUS 화면 메타데이터 + query_master 통합 등록.
--
-- 누락된 V41~V48 마이그레이션을 하나로 합침.
-- V49(INTRO1 css_class 수정)는 이미 적용됨 → 여기서 V49 최종 css_class 사용.
--
-- 화면 흐름: MAIN_PAGE → INTRO1(기간) → INTRO2(아티스트) → INTRO3(지역)
--          → INTRO4(목적) → INTRO5(예산) → FOCUS(요약/확인) → CHAT(챗봇)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ================================================================
-- 0. 기존 데이터가 있으면 삭제 (idempotent)
-- ================================================================
DELETE FROM ui_metadata WHERE screen_id IN (
  'KRIDE_INTRO1','KRIDE_INTRO2','KRIDE_INTRO3',
  'KRIDE_INTRO4','KRIDE_INTRO5','KRIDE_FOCUS'
);

DELETE FROM query_master WHERE sql_key IN (
  'kride_artist_list','kride_region_list'
) AND NOT EXISTS (SELECT 1 FROM query_master WHERE sql_key = 'kride_artist_list' LIMIT 0);
-- 이미 있으면 유지 (V52에서 수정됨)

-- ================================================================
-- 1. KRIDE_INTRO1 — 기간 선택 (당일/1박/2박)
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   sort_order, ref_data_id, parent_group_id, group_direction,
   css_class, action_type, action_url, is_readonly, is_visible)
VALUES
  -- root container
  ('KRIDE_INTRO1', 'intro1_root', 'GROUP', '',
   1, NULL, NULL, 'COLUMN',
   'min-h-screen bg-black flex flex-col kride-intro1-root', NULL, NULL, true, 'true'),
  -- hero image
  ('KRIDE_INTRO1', 'intro1_hero', 'IMAGE', '/images/kride_hero.png',
   2, NULL, 'intro1_root', NULL,
   'w-full kride-intro1-hero-slot', NULL, NULL, true, 'true'),
  -- typewriter title
  ('KRIDE_INTRO1', 'intro1_title', 'TYPEWRITER_TEXT', '어떤 여행을 떠나실 건가요?',
   3, NULL, 'intro1_root', NULL,
   'text-white kride-intro1-title', NULL, NULL, true, 'true'),
  -- subtitle
  ('KRIDE_INTRO1', 'intro1_sub', 'TEXT', 'K-POP 아티스트의 발자취를 따라 떠나는 특별한 여행',
   4, NULL, 'intro1_root', NULL,
   'kride-intro1-sub', NULL, NULL, true, 'true'),
  -- button group
  ('KRIDE_INTRO1', 'intro1_buttons', 'GROUP', '',
   5, NULL, 'intro1_root', 'COLUMN',
   'flex flex-col w-full kride-intro1-buttons', NULL, NULL, true, 'true'),
  -- duration buttons
  ('KRIDE_INTRO1', 'intro1_btn_day', 'DURATION_BUTTON', '당일치기',
   6, NULL, 'intro1_buttons', NULL,
   '', 'LINK', '/view/INTRO2', false, 'true'),
  ('KRIDE_INTRO1', 'intro1_btn_1n', 'DURATION_BUTTON', '1박 2일',
   7, NULL, 'intro1_buttons', NULL,
   '', 'LINK', '/view/INTRO2', false, 'true'),
  ('KRIDE_INTRO1', 'intro1_btn_2n', 'DURATION_BUTTON', '2박 3일',
   8, NULL, 'intro1_buttons', NULL,
   '', 'LINK', '/view/INTRO2', false, 'true');


-- ================================================================
-- 2. KRIDE_INTRO2 — 아티스트 선택 (API 데이터)
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   sort_order, ref_data_id, parent_group_id, group_direction,
   css_class, action_type, action_url, data_api_url, data_sql_key,
   is_readonly, is_visible)
VALUES
  -- root
  ('KRIDE_INTRO2', 'intro2_root', 'GROUP', '',
   1, NULL, NULL, 'COLUMN',
   'min-h-screen bg-black flex flex-col px-6 pt-12 pb-8', NULL, NULL, NULL, NULL, true, 'true'),
  -- title
  ('KRIDE_INTRO2', 'intro2_title', 'TYPEWRITER_TEXT', '좋아하는 아티스트를 골라주세요',
   2, NULL, 'intro2_root', NULL,
   'text-white text-2xl font-bold mb-2', NULL, NULL, NULL, NULL, true, 'true'),
  -- subtitle
  ('KRIDE_INTRO2', 'intro2_sub', 'TEXT', '최대 5명까지 선택할 수 있어요',
   3, NULL, 'intro2_root', NULL,
   'text-gray-400 text-sm mb-6', NULL, NULL, NULL, NULL, true, 'true'),
  -- artist grid (repeater group — ref_data_id로 데이터 바인딩)
  ('KRIDE_INTRO2', 'intro2_artist_grid', 'GROUP', '',
   4, 'artists', 'intro2_root', 'ROW',
   'kride-artist-grid flex-wrap', NULL, NULL, NULL, 'kride_artist_list', true, 'true'),
  -- artist card template (repeater child)
  ('KRIDE_INTRO2', 'intro2_artist_card', 'SELECTION_CARD', '',
   5, NULL, 'intro2_artist_grid', NULL,
   'circle', NULL, NULL, NULL, NULL, false, 'true'),
  -- warning toast
  ('KRIDE_INTRO2', 'intro2_warning', 'KRIDE_WARNING', '',
   90, NULL, 'intro2_root', NULL,
   '', NULL, NULL, NULL, NULL, true, 'true'),
  -- next button
  ('KRIDE_INTRO2', 'intro2_next', 'KRIDE_NEXT_BTN', '다음',
   99, NULL, 'intro2_root', NULL,
   'kride-next-btn-br', 'LINK', '/view/INTRO3', NULL, NULL, false, 'true');


-- ================================================================
-- 3. KRIDE_INTRO3 — 지역 선택 (API 데이터)
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   sort_order, ref_data_id, parent_group_id, group_direction,
   css_class, action_type, action_url, data_api_url, data_sql_key,
   is_readonly, is_visible)
VALUES
  -- root
  ('KRIDE_INTRO3', 'intro3_root', 'GROUP', '',
   1, NULL, NULL, 'COLUMN',
   'min-h-screen bg-black flex flex-col px-6 pt-12 pb-8', NULL, NULL, NULL, NULL, true, 'true'),
  -- title
  ('KRIDE_INTRO3', 'intro3_title', 'TYPEWRITER_TEXT', '어디로 떠나볼까요?',
   2, NULL, 'intro3_root', NULL,
   'text-white text-2xl font-bold mb-2', NULL, NULL, NULL, NULL, true, 'true'),
  -- subtitle
  ('KRIDE_INTRO3', 'intro3_sub', 'TEXT', '최대 2곳까지 선택할 수 있어요',
   3, NULL, 'intro3_root', NULL,
   'text-gray-400 text-sm mb-6', NULL, NULL, NULL, NULL, true, 'true'),
  -- region grid (repeater)
  ('KRIDE_INTRO3', 'intro3_region_grid', 'GROUP', '',
   4, 'regions', 'intro3_root', 'ROW',
   'kride-region-grid flex-wrap', NULL, NULL, NULL, 'kride_region_list', true, 'true'),
  -- region card template
  ('KRIDE_INTRO3', 'intro3_region_card', 'SELECTION_CARD', '',
   5, NULL, 'intro3_region_grid', NULL,
   'chip', NULL, NULL, NULL, NULL, false, 'true'),
  -- warning toast
  ('KRIDE_INTRO3', 'intro3_warning', 'KRIDE_WARNING', '',
   90, NULL, 'intro3_root', NULL,
   '', NULL, NULL, NULL, NULL, true, 'true'),
  -- next button
  ('KRIDE_INTRO3', 'intro3_next', 'KRIDE_NEXT_BTN', '다음',
   99, NULL, 'intro3_root', NULL,
   'kride-next-btn-br', 'LINK', '/view/INTRO4', NULL, NULL, false, 'true');


-- ================================================================
-- 4. KRIDE_INTRO4 — 여행 목적 선택
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   sort_order, ref_data_id, parent_group_id, group_direction,
   css_class, action_type, action_url, is_readonly, is_visible)
VALUES
  -- root
  ('KRIDE_INTRO4', 'intro4_root', 'GROUP', '',
   1, NULL, NULL, 'COLUMN',
   'min-h-screen bg-black flex flex-col px-6 pt-12 pb-8', NULL, NULL, true, 'true'),
  -- title
  ('KRIDE_INTRO4', 'intro4_title', 'TYPEWRITER_TEXT', '여행의 목적은 무엇인가요?',
   2, NULL, 'intro4_root', NULL,
   'text-white text-2xl font-bold mb-2', NULL, NULL, true, 'true'),
  -- subtitle
  ('KRIDE_INTRO4', 'intro4_sub', 'TEXT', '하나를 선택해주세요',
   3, NULL, 'intro4_root', NULL,
   'text-gray-400 text-sm mb-6', NULL, NULL, true, 'true'),
  -- purpose cards group
  ('KRIDE_INTRO4', 'intro4_purposes', 'GROUP', '',
   4, NULL, 'intro4_root', 'COLUMN',
   'flex flex-col gap-3 w-full', NULL, NULL, true, 'true'),
  -- purpose items
  ('KRIDE_INTRO4', 'intro4_p_food', 'PURPOSE_CARD', '맛집 탐방',
   5, NULL, 'intro4_purposes', NULL,
   'food', 'LINK', '/view/INTRO5', false, 'true'),
  ('KRIDE_INTRO4', 'intro4_p_kculture', 'PURPOSE_CARD', 'K-컬처',
   6, NULL, 'intro4_purposes', NULL,
   'kculture', 'LINK', '/view/INTRO5', false, 'true'),
  ('KRIDE_INTRO4', 'intro4_p_nature', 'PURPOSE_CARD', '자연 힐링',
   7, NULL, 'intro4_purposes', NULL,
   'nature', 'LINK', '/view/INTRO5', false, 'true'),
  ('KRIDE_INTRO4', 'intro4_p_history', 'PURPOSE_CARD', '역사 문화',
   8, NULL, 'intro4_purposes', NULL,
   'history', 'LINK', '/view/INTRO5', false, 'true'),
  ('KRIDE_INTRO4', 'intro4_p_shopping', 'PURPOSE_CARD', '쇼핑',
   9, NULL, 'intro4_purposes', NULL,
   'shopping', 'LINK', '/view/INTRO5', false, 'true'),
  ('KRIDE_INTRO4', 'intro4_p_rest', 'PURPOSE_CARD', '휴식',
   10, NULL, 'intro4_purposes', NULL,
   'rest', 'LINK', '/view/INTRO5', false, 'true');


-- ================================================================
-- 5. KRIDE_INTRO5 — 예산 설정
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   sort_order, ref_data_id, parent_group_id, group_direction,
   css_class, action_type, action_url, is_readonly, is_visible)
VALUES
  -- root
  ('KRIDE_INTRO5', 'intro5_root', 'GROUP', '',
   1, NULL, NULL, 'COLUMN',
   'min-h-screen bg-black flex flex-col px-6 pt-12 pb-8', NULL, NULL, true, 'true'),
  -- title
  ('KRIDE_INTRO5', 'intro5_title', 'TYPEWRITER_TEXT', '예산은 어느 정도인가요?',
   2, NULL, 'intro5_root', NULL,
   'text-white text-2xl font-bold mb-2', NULL, NULL, true, 'true'),
  -- subtitle
  ('KRIDE_INTRO5', 'intro5_sub', 'TEXT', '대략적인 범위를 설정해주세요',
   3, NULL, 'intro5_root', NULL,
   'text-gray-400 text-sm mb-8', NULL, NULL, true, 'true'),
  -- dual range slider
  ('KRIDE_INTRO5', 'intro5_slider', 'DUAL_RANGE_SLIDER', '',
   4, NULL, 'intro5_root', NULL,
   'w-full mt-4', NULL, NULL, false, 'true'),
  -- next button
  ('KRIDE_INTRO5', 'intro5_next', 'KRIDE_NEXT_BTN', '여행 계획 시작',
   99, NULL, 'intro5_root', NULL,
   'kride-next-btn-br', 'LINK', '/view/FOCUS', NULL, NULL, false, 'true');


-- ================================================================
-- 6. KRIDE_FOCUS — 여행 계획 요약 + 지도 + 일정
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   sort_order, ref_data_id, parent_group_id, group_direction,
   css_class, action_type, action_url, is_readonly, is_visible)
VALUES
  -- root
  ('KRIDE_FOCUS', 'focus_root', 'GROUP', '',
   1, NULL, NULL, 'COLUMN',
   'min-h-screen bg-black flex flex-col', NULL, NULL, true, 'true'),
  -- map view
  ('KRIDE_FOCUS', 'focus_map', 'MAP_VIEW', '',
   2, NULL, 'focus_root', NULL,
   'w-full h-[50vh]', NULL, NULL, true, 'true'),
  -- itinerary panel
  ('KRIDE_FOCUS', 'focus_itinerary', 'ITINERARY_PANEL', '',
   3, NULL, 'focus_root', NULL,
   'w-full flex-1 bg-gray-900 rounded-t-3xl p-6', NULL, NULL, true, 'true'),
  -- chat button
  ('KRIDE_FOCUS', 'focus_chat_btn', 'KRIDE_NEXT_BTN', 'AI 여행봇과 상담',
   99, NULL, 'focus_root', NULL,
   'kride-next-btn-br', 'LINK', '/view/CHAT', NULL, NULL, false, 'true');


-- ================================================================
-- 7. query_master — 아티스트/지역 데이터 쿼리
-- ================================================================

-- 아티스트 목록 (kride_artist_list)
INSERT INTO query_master (sql_key, query_text, description)
SELECT 'kride_artist_list',
  $Q$SELECT id, name, ''::text AS "imageUrl" FROM (VALUES
  (1,'BTS'),(2,'BLACKPINK'),(3,'EXO'),(4,'TWICE'),(5,'SEVENTEEN'),
  (6,'aespa'),(7,'Stray Kids'),(8,'IVE'),(9,'NewJeans'),(10,'LE SSERAFIM'),
  (11,'NCT 127'),(12,'Red Velvet'),(13,'GOT7'),(14,'MAMAMOO'),(15,'ATEEZ'),
  (16,'TXT'),(17,'ENHYPEN'),(18,'ITZY'),(19,'(G)I-DLE'),(20,'MONSTA X'),
  (21,'SHINee'),(22,'WINNER'),(23,'iKON'),(24,'DAY6'),(25,'BTOB'),
  (26,'ASTRO'),(27,'THE BOYZ'),(28,'Kep1er'),(29,'NMIXX'),(30,'TREASURE')
) AS t(id, name)$Q$,
  'KRIDE INTRO2 아티스트 목록'
WHERE NOT EXISTS (SELECT 1 FROM query_master WHERE sql_key = 'kride_artist_list');

-- 지역 목록 (kride_region_list) — V52에서 이미 추가/수정됨
INSERT INTO query_master (sql_key, query_text, description)
SELECT 'kride_region_list',
  $Q$SELECT id, name, ''::text AS "imageUrl" FROM (VALUES
  (1,'서울'),(2,'경기'),(3,'부산'),(4,'제주'),(5,'경주'),
  (6,'인천'),(7,'강원'),(8,'여수'),(9,'전주'),(10,'춘천'),
  (11,'속초'),(12,'대구'),(13,'광주')
) AS t(id, name)$Q$,
  'KRIDE INTRO3 지역 목록'
WHERE NOT EXISTS (SELECT 1 FROM query_master WHERE sql_key = 'kride_region_list');


COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증:
--   1. docker exec sdui-redis redis-cli FLUSHDB
--   2. curl http://localhost:8080/api/ui/KRIDE_INTRO1  → 8 components
--   3. curl http://localhost:8080/api/ui/KRIDE_INTRO2  → 7 components
--   4. curl http://localhost:8080/api/ui/KRIDE_INTRO3  → 7 components
--   5. curl http://localhost:8080/api/ui/KRIDE_INTRO4  → 10 components
--   6. curl http://localhost:8080/api/ui/KRIDE_INTRO5  → 5 components
--   7. curl http://localhost:8080/api/ui/KRIDE_FOCUS   → 4 components
--   8. 브라우저: /view/INTRO1 → INTRO2 → INTRO3 → INTRO4 → INTRO5 → FOCUS → CHAT
--
-- 롤백:
--   DELETE FROM ui_metadata WHERE screen_id IN ('KRIDE_INTRO1','KRIDE_INTRO2','KRIDE_INTRO3','KRIDE_INTRO4','KRIDE_INTRO5','KRIDE_FOCUS');
--   DELETE FROM query_master WHERE sql_key IN ('kride_artist_list','kride_region_list');
-- ─────────────────────────────────────────────────────────────────────────────
