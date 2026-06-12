-- ==========================================
-- V69: THEME_SETTINGS 관리 화면 (GitHub issue #4 · Phase 4)
-- design_tokens 값을 웹에서 수정/저장하는 관리자 전용 SDUI 화면
-- THEME_EDITOR 컴포넌트가 GET/PUT /api/ui/theme/{themeId}를 직접 호출한다
-- ==========================================

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible
)
SELECT 'THEME_SETTINGS', 'THEME_ROOT', 'GROUP', NULL,
       '', 'theme-settings-page', 'COLUMN', 'ROLE_ADMIN', 10, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata WHERE screen_id = 'THEME_SETTINGS' AND component_id = 'THEME_ROOT'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible
)
SELECT 'THEME_SETTINGS', 'theme_title', 'TEXT', 'THEME_ROOT',
       '🎨 테마 설정', 'theme-settings-title', NULL, 'ROLE_ADMIN', 20, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata WHERE screen_id = 'THEME_SETTINGS' AND component_id = 'theme_title'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible
)
SELECT 'THEME_SETTINGS', 'theme_desc', 'TEXT', 'THEME_ROOT',
       'K-RIDE 디자인 토큰을 수정하면 재배포 없이 전체 화면에 적용됩니다. 색상은 컬러피커, 나머지는 직접 입력으로 수정하세요.',
       'theme-settings-desc', NULL, 'ROLE_ADMIN', 30, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata WHERE screen_id = 'THEME_SETTINGS' AND component_id = 'theme_desc'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible
)
SELECT 'THEME_SETTINGS', 'theme_editor', 'THEME_EDITOR', 'THEME_ROOT',
       '', '', NULL, 'ROLE_ADMIN', 40, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata WHERE screen_id = 'THEME_SETTINGS' AND component_id = 'theme_editor'
);
