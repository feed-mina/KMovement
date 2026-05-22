-- ─────────────────────────────────────────────────────────────────────────────
-- V52__fix_kride_region_and_button.sql
-- 1. kride_region_list SQL 수정: VALUES 2컬럼 vs alias 3컬럼 불일치 해결
-- 2. KRIDE bento 버튼 is_readonly = false 설정 (ButtonField 클릭 가능)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ================================================================
-- 1. kride_region_list: alias를 2컬럼으로 수정
--    ''::text AS "imageUrl" 은 SELECT 리터럴이므로 alias에 불필요
-- ================================================================
UPDATE query_master
SET query_text = $Q$SELECT id, name, ''::text AS "imageUrl" FROM (VALUES
  (1,'서울'),
  (2,'경기'),
  (3,'부산'),
  (4,'제주'),
  (5,'경주'),
  (6,'인천'),
  (7,'강원'),
  (8,'여수'),
  (9,'전주'),
  (10,'춘천'),
  (11,'속초'),
  (12,'대구'),
  (13,'광주')
) AS t(id, name)$Q$
WHERE sql_key = 'kride_region_list';

-- ================================================================
-- 2. KRIDE bento 버튼 is_readonly = false
--    ButtonField.tsx 가 isReadOnly=true 이면 onClick 을 막음
-- ================================================================
UPDATE ui_metadata
SET is_readonly = false
WHERE screen_id = 'MAIN_PAGE'
  AND component_id IN ('main_bento_kride_btn', 'main_bento_kride_btn_g');

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증:
--   1. curl http://localhost:3000/api/execute/kride_region_list → 13개 지역 정상 반환
--   2. MAIN_PAGE KRIDE 카드 버튼 클릭 → /view/INTRO1 이동 확인
-- 롤백:
--   UPDATE query_master SET query_text = (이전 값) WHERE sql_key = 'kride_region_list';
--   UPDATE ui_metadata SET is_readonly = true WHERE component_id IN ('main_bento_kride_btn','main_bento_kride_btn_g');
-- ─────────────────────────────────────────────────────────────────────────────
