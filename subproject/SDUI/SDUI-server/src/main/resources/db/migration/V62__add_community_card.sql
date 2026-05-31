-- V62: MAIN_PAGE 벤토 그리드에 커뮤니티 카드 추가 (USER & GUEST)
-- 모바일에서는 사이드바가 보이지 않아 커뮤니티에 진입할 수 없는 문제를 해결하기 위함.

BEGIN;

-- ================================================================
-- ROLE_USER 용 커뮤니티 카드
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_grp', 'GROUP',
   'MAIN_SECTION', '', 'bento-card bento-card-dark col-span-3', 'COLUMN', 'ROLE_USER', 35);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_body', 'GROUP',
   'main_bento_community_grp', '', 'bento-card-body', 'COLUMN', 'ROLE_USER', 36);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_title', 'TEXT',
   'main_bento_community_body', '커뮤니티', 'bento-card-title', 'ROLE_USER', 37);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_desc', 'TEXT',
   'main_bento_community_body', '다른 사람들과 일상을 공유하고 소통해보세요.', 'bento-card-desc', 'ROLE_USER', 38);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, action_type, action_url, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_btn', 'BUTTON',
   'main_bento_community_grp', '💬 커뮤니티 가기', 'bento-card-tag', 'LINK', '/view/COMMUNITY_LIST',
   'ROLE_USER', 39);

-- ================================================================
-- ROLE_GUEST 용 커뮤니티 카드
-- ================================================================
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_grp_g', 'GROUP',
   'MAIN_SECTION', '', 'bento-card bento-card-dark col-span-3', 'COLUMN', 'ROLE_GUEST', 35);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, group_direction, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_body_g', 'GROUP',
   'main_bento_community_grp_g', '', 'bento-card-body', 'COLUMN', 'ROLE_GUEST', 36);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_title_g', 'TEXT',
   'main_bento_community_body_g', '커뮤니티', 'bento-card-title', 'ROLE_GUEST', 37);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_desc_g', 'TEXT',
   'main_bento_community_body_g', '다른 사람들과 일상을 공유하고 소통해보세요.', 'bento-card-desc', 'ROLE_GUEST', 38);

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id,
   label_text, css_class, action_type, action_url, allowed_roles, sort_order)
VALUES
  ('MAIN_PAGE', 'main_bento_community_btn_g', 'BUTTON',
   'main_bento_community_grp_g', '💬 커뮤니티 가기', 'bento-card-tag', 'LINK', '/view/COMMUNITY_LIST',
   'ROLE_GUEST', 39);

COMMIT;
