-- ─────────────────────────────────────────────────────────────────────────────
-- V51__main_page_kride_card.sql
-- MAIN_PAGE 벤토 그리드에 KRIDE 진입 카드 추가.
--
-- 작업 범위: ui_metadata 에 신규 row INSERT 만.
--   • DDL 없음 (테이블/컬럼 변경 없음)
--   • 기존 V8 카드들 (appointment, diary, content, login, tutorial) 무수정
--   • 신규 component_id prefix: 'main_bento_kride_*'
--
-- 함께 적용해야 하는 파일:
--   • MAIN_PAGE.css.append.css → app/styles/pages.css 또는 신규 파일
--
-- 적용 후 영향:
--   • ROLE_USER, ROLE_GUEST 모두 MAIN_PAGE 최상단에 KRIDE 카드 노출
--   • 카드 클릭 → /view/INTRO1 진입 (screenMap.ts 가 KRIDE_INTRO1 로 라우팅)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 기존 데이터 정리 (이전 수동 INSERT 충돌 방지)
DELETE FROM ui_metadata
WHERE screen_id = 'MAIN_PAGE' AND component_id LIKE 'main_bento_kride%';

-- ================================================================
-- ROLE_USER 용 KRIDE hero 카드 (col-span-3, sort_order=5 → 최상단)
-- ================================================================

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_grp', 'GROUP',
   'MAIN_SECTION', '',
   'bento-card bento-card-kride col-span-3', 'COLUMN', 'ROLE_USER', 5);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_kicker', 'TEXT',
   'main_bento_kride_grp', 'NEW · KRIDE TRAVEL',
   'bento-card-kride__kicker', 'ROLE_USER', 6);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_title', 'TEXT',
   'main_bento_kride_grp', 'K-RIDE 시작하기',
   'bento-card-kride__title', 'ROLE_USER', 7);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_desc', 'TEXT',
   'main_bento_kride_grp', '좋아하는 아티스트와 지역을 고르면, AI 가 동선과 일정까지 한 번에 짜드려요.',
   'bento-card-kride__desc', 'ROLE_USER', 8);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, action_type, action_url, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_btn', 'BUTTON',
   'main_bento_kride_grp',
   '▶ 여행 시작하기', 'bento-card-kride__cta',
   'LINK', '/view/INTRO1',
   'ROLE_USER', 9);

-- ================================================================
-- ROLE_GUEST 용 KRIDE hero 카드 (동일 구조, allowed_roles 만 다름)
-- ================================================================

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_grp_g', 'GROUP',
   'MAIN_SECTION', '',
   'bento-card bento-card-kride col-span-3', 'COLUMN', 'ROLE_GUEST', 5);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_kicker_g', 'TEXT',
   'main_bento_kride_grp_g', 'NEW · KRIDE TRAVEL',
   'bento-card-kride__kicker', 'ROLE_GUEST', 6);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_title_g', 'TEXT',
   'main_bento_kride_grp_g', 'K-RIDE 시작하기',
   'bento-card-kride__title', 'ROLE_GUEST', 7);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_desc_g', 'TEXT',
   'main_bento_kride_grp_g', '좋아하는 아티스트와 지역을 고르면, AI 가 동선과 일정까지 한 번에 짜드려요.',
   'bento-card-kride__desc', 'ROLE_GUEST', 8);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, action_type, action_url, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kride_btn_g', 'BUTTON',
   'main_bento_kride_grp_g',
   '▶ 여행 시작하기', 'bento-card-kride__cta',
   'LINK', '/view/INTRO1',
   'ROLE_GUEST', 9);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증
--   1. Redis FLUSHDB (docker exec sdui-redis redis-cli FLUSHDB)
--   2. curl http://localhost:8080/api/ui/MAIN_PAGE | jq '.[] | select(.componentId | startswith("main_bento_kride"))'
--   3. /view/MAIN_PAGE 진입 → 최상단에 KRIDE 카드 노출 확인
--   4. KRIDE 카드 클릭 → /view/INTRO1 (KRIDE_INTRO1) 진입 확인
--
-- 롤백:
--   DELETE FROM ui_metadata WHERE screen_id = 'MAIN_PAGE'
--     AND component_id LIKE 'main_bento_kride%';
-- ─────────────────────────────────────────────────────────────────────────────
