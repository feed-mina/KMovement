-- 상품 후보 검색과 저장 목록을 metadata-project 내부 SDUI 경로로 연결한다.

UPDATE ui_metadata
SET action_url = CASE component_id
        WHEN 'kpop_products_cta' THEN '/view/KPOP_PRODUCTS'
        WHEN 'kpop_saved_items_cta' THEN '/view/KPOP_SAVED_ITEMS'
        WHEN 'kpop_result_products_cta' THEN '/view/KPOP_PRODUCTS'
        WHEN 'kpop_result_saved_cta' THEN '/view/KPOP_SAVED_ITEMS'
    END,
    action_type = 'ROUTE',
    is_readonly = false
WHERE (screen_id = 'KPOP_EXPLORE' AND component_id IN ('kpop_products_cta', 'kpop_saved_items_cta'))
   OR (screen_id = 'KPOP_AI_RESULT' AND component_id IN ('kpop_result_products_cta', 'kpop_result_saved_cta'));