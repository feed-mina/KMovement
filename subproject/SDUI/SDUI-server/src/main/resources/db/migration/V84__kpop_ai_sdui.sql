-- K-POP AI outfit analysis client screens. The interactive leaves own the
-- authenticated upload/job lifecycle; metadata only controls layout/routing.

DELETE FROM ui_metadata
WHERE screen_id IN ('KPOP_AI_FIND', 'KPOP_AI_RESULT');

DELETE FROM ui_metadata
WHERE screen_id = 'KPOP_EXPLORE'
  AND component_id = 'kpop_ai_cta';

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, label_text, sort_order,
    ref_data_id, parent_group_id, group_direction, css_class,
    action_type, action_url, data_sql_key, is_readonly, is_visible, component_props
)
VALUES
('KPOP_AI_FIND', 'kpop_ai_find_root', 'GROUP', '', 1,
 NULL, NULL, 'COLUMN', 'kpop-screen',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_AI_FIND', 'kpop_ai_find_title', 'TEXT', 'AI 의상 후보 찾기', 2,
 NULL, 'kpop_ai_find_root', NULL, 'kpop-title',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_AI_FIND', 'kpop_ai_upload_consent', 'UPLOAD_CONSENT', '', 3,
 NULL, 'kpop_ai_find_root', NULL, '',
 NULL, NULL, NULL, false, 'true', '{}'),

('KPOP_AI_RESULT', 'kpop_ai_result_root', 'GROUP', '', 1,
 NULL, NULL, 'COLUMN', 'kpop-screen',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_AI_RESULT', 'kpop_ai_result_title', 'TEXT', 'AI 의상 후보 결과', 2,
 NULL, 'kpop_ai_result_root', NULL, 'kpop-title',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_AI_RESULT', 'kpop_ai_result_card', 'AI_RESULT_CARD', '', 3,
 NULL, 'kpop_ai_result_root', NULL, '',
 NULL, NULL, NULL, true, 'true', '{}'),

('KPOP_EXPLORE', 'kpop_ai_cta', 'BUTTON', '사진으로 의상 후보 찾기', 7,
 NULL, 'kpop_root', NULL, 'kpop-primary-btn',
 'ROUTE', '/kpop/ai', NULL, false, 'true', '{}');
