-- K-POP detail URLs now accept artist slugs, event lists are personalized by follow state,
-- and KPOP_AI_FIND exposes the direct product search panel in the screen metadata.

UPDATE query_master
SET query_text = 'SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn", profile, image_url AS "imageUrl", official_url AS "officialUrl", instagram_url AS "instagramUrl", youtube_url AS "youtubeUrl", x_url AS "xUrl" FROM artist WHERE approved_yn = ''Y'' AND (LOWER(slug) = LOWER(:contentId) OR CASE WHEN :contentId ~ ''^[0-9]+$'' THEN artist_id = CAST(:contentId AS BIGINT) ELSE FALSE END)',
    return_type = 'MULTI',
    required_params = '["contentId"]',
    param_mapping = '{"contentId":"string"}',
    updated_at = NOW()
WHERE sql_key = 'kpop_artist_detail';

UPDATE ui_metadata
SET data_sql_key = NULL,
    data_api_url = '/api/v1/kpop/events'
WHERE screen_id = 'KPOP_EVENTS'
  AND component_id = 'kpop_events_grid';

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, label_text, sort_order,
    ref_data_id, parent_group_id, group_direction, css_class,
    action_type, action_url, data_sql_key, data_api_url,
    is_readonly, is_visible, component_props
)
SELECT
    'KPOP_AI_FIND', 'kpop_ai_product_search', 'PRODUCT_SEARCH', '', 4,
    NULL, 'kpop_ai_find_root', NULL, '',
    NULL, NULL, NULL, NULL,
    true, 'true', '{}'
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata
    WHERE screen_id = 'KPOP_AI_FIND'
      AND component_id = 'kpop_ai_product_search'
);