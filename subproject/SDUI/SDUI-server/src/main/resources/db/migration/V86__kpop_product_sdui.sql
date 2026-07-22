-- K-POP product candidate search and authenticated saved-item screens.
-- Business data is loaded through the typed REST contracts in the platform
-- leaves; this migration only registers SDUI layout and routes.

DELETE FROM ui_metadata
WHERE screen_id IN ('KPOP_PRODUCTS', 'KPOP_SAVED_ITEMS');

DELETE FROM ui_metadata
WHERE (screen_id = 'KPOP_EXPLORE' AND component_id IN ('kpop_products_cta', 'kpop_saved_items_cta'))
   OR (screen_id = 'KPOP_AI_RESULT' AND component_id IN ('kpop_result_products_cta', 'kpop_result_saved_cta'));

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, label_text, sort_order,
    ref_data_id, parent_group_id, group_direction, css_class,
    action_type, action_url, data_sql_key, is_readonly, is_visible, component_props
)
VALUES
('KPOP_PRODUCTS', 'kpop_products_root', 'GROUP', '', 1,
 NULL, NULL, 'COLUMN', 'kpop-screen',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_PRODUCTS', 'kpop_product_search', 'PRODUCT_SEARCH', '', 2,
 NULL, 'kpop_products_root', NULL, '',
 NULL, NULL, NULL, false, 'true', '{}'),

('KPOP_SAVED_ITEMS', 'kpop_saved_root', 'GROUP', '', 1,
 NULL, NULL, 'COLUMN', 'kpop-screen',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_SAVED_ITEMS', 'kpop_saved_list', 'SAVED_ITEM_LIST', '', 2,
 NULL, 'kpop_saved_root', NULL, '',
 NULL, NULL, NULL, false, 'true', '{}'),

('KPOP_EXPLORE', 'kpop_products_cta', 'BUTTON', '상품 후보 검색', 8,
 NULL, 'kpop_root', NULL, 'kpop-primary-btn',
 'ROUTE', '/kpop/products', NULL, false, 'true', '{}'),
('KPOP_EXPLORE', 'kpop_saved_items_cta', 'BUTTON', '저장한 후보 보기', 9,
 NULL, 'kpop_root', NULL, 'kpop-primary-btn',
 'ROUTE', '/kpop/saved', NULL, false, 'true', '{}'),

('KPOP_AI_RESULT', 'kpop_result_products_cta', 'BUTTON', '다른 상품 후보 검색', 4,
 NULL, 'kpop_ai_result_root', NULL, 'kpop-primary-btn',
 'ROUTE', '/kpop/products', NULL, false, 'true', '{}'),
('KPOP_AI_RESULT', 'kpop_result_saved_cta', 'BUTTON', '저장한 후보 보기', 5,
 NULL, 'kpop_ai_result_root', NULL, 'kpop-primary-btn',
 'ROUTE', '/kpop/saved', NULL, false, 'true', '{}');
