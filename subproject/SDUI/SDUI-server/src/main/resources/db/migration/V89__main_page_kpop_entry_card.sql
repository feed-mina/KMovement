-- ─────────────────────────────────────────────────────────────────────────────
-- V89__main_page_kpop_entry_card.sql
-- MAIN_PAGE 벤토 그리드에 K-POP 팬 플랫폼(#169) 진입 카드 추가.
--
-- 배경: KPOP_EXPLORE/EVENTS/상세 화면(V82)과 화면 간 이동 링크는 있지만
--       MAIN_PAGE → K-POP 첫 진입 링크가 없어 모바일에서는 UI로 도달 불가했다.
--
-- 작업 범위: ui_metadata 신규 row INSERT 만 (DDL 없음, 기존 카드 무수정).
--   • V51 KRIDE 카드와 동일한 구조/스타일 재사용(bento-card-kride*):
--     웹 pages.css, 모바일 CLASS_MAP 모두 추가 작업 없이 렌더된다.
--   • action_url '/view/KPOP_EXPLORE':
--     - 모바일(주 대상): /view 프리픽스 제거 후 screen id 직행 → KPOP_EXPLORE 렌더
--     - metadata-project 웹: /view/KPOP_EXPLORE SDUI 렌더 (ARTIST_CARD 등
--       카드 컴포넌트는 kride 웹 전용이라 구웹에선 텍스트/버튼만 표시됨)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DELETE FROM ui_metadata
WHERE screen_id = 'MAIN_PAGE' AND component_id LIKE 'main_bento_kpop%';

-- ================================================================
-- ROLE_USER 용 K-POP 카드 (KRIDE hero 바로 아래, sort_order=6)
-- ================================================================

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_grp', 'GROUP',
   'MAIN_SECTION', '',
   'bento-card bento-card-kride col-span-3', 'COLUMN', 'ROLE_USER', 6);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_kicker', 'TEXT',
   'main_bento_kpop_grp', 'NEW · K-POP FAN',
   'bento-card-kride__kicker', 'ROLE_USER', 1);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_title', 'TEXT',
   'main_bento_kpop_grp', 'K-POP 팬 여행',
   'bento-card-kride__title', 'ROLE_USER', 2);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_desc', 'TEXT',
   'main_bento_kpop_grp', '아티스트를 팔로우하고 이벤트 일정과 검증된 굿즈 후보를 저장해 보세요.',
   'bento-card-kride__desc', 'ROLE_USER', 3);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, action_type, action_url, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_btn', 'BUTTON',
   'main_bento_kpop_grp',
   '▶ K-POP 탐색하기', 'bento-card-kride__cta',
   'LINK', '/view/KPOP_EXPLORE',
   'ROLE_USER', 4);

-- ================================================================
-- ROLE_GUEST 용 (동일 구조, allowed_roles 만 다름 — V51 관례)
-- ================================================================

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_grp_g', 'GROUP',
   'MAIN_SECTION', '',
   'bento-card bento-card-kride col-span-3', 'COLUMN', 'ROLE_GUEST', 6);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_kicker_g', 'TEXT',
   'main_bento_kpop_grp_g', 'NEW · K-POP FAN',
   'bento-card-kride__kicker', 'ROLE_GUEST', 1);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_title_g', 'TEXT',
   'main_bento_kpop_grp_g', 'K-POP 팬 여행',
   'bento-card-kride__title', 'ROLE_GUEST', 2);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_desc_g', 'TEXT',
   'main_bento_kpop_grp_g', '아티스트를 팔로우하고 이벤트 일정과 검증된 굿즈 후보를 저장해 보세요.',
   'bento-card-kride__desc', 'ROLE_GUEST', 3);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, action_type, action_url, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_kpop_btn_g', 'BUTTON',
   'main_bento_kpop_grp_g',
   '▶ K-POP 탐색하기', 'bento-card-kride__cta',
   'LINK', '/view/KPOP_EXPLORE',
   'ROLE_GUEST', 4);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증
--   1. Redis FLUSHDB (화면 메타 캐시 1시간 — 미삭제 시 카드가 늦게 나타남)
--   2. curl .../api/ui/MAIN_PAGE | jq '.[] | select(.componentId | startswith("main_bento_kpop"))'
--   3. 모바일 MAIN_PAGE → 'K-POP 탐색하기' 탭 → KPOP_EXPLORE 진입 확인
--
-- 롤백:
--   DELETE FROM ui_metadata WHERE screen_id = 'MAIN_PAGE'
--     AND component_id LIKE 'main_bento_kpop%';
-- ─────────────────────────────────────────────────────────────────────────────
