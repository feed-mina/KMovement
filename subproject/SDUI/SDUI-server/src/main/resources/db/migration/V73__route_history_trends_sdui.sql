-- V73: Route history timeline and travel trend SDUI widgets.
-- GitHub issue #38.

WITH rows (
    screen_id, component_id, component_type, parent_group_id, label_text,
    css_class, group_direction, action_type, data_sql_key, data_api_url,
    ref_data_id, allowed_roles, sort_order, component_props, is_visible
) AS (
    VALUES
    ('MY_PAGE', 'mypage_route_history_source', 'DATA_SOURCE', 'mypage_root', 'Route history source',
     '', NULL, 'AUTO_FETCH', NULL, '/kride-api/users/{userSqno}/route-history?limit=8',
     'mypage_route_history_source', 'ROLE_USER', 5, '{}'::jsonb, 'false'),
    ('MY_PAGE', 'mypage_route_summary_source', 'DATA_SOURCE', 'mypage_root', 'Route summary source',
     '', NULL, 'AUTO_FETCH', NULL, '/kride-api/users/{userSqno}/summary',
     'mypage_route_summary_source', 'ROLE_USER', 6, '{}'::jsonb, 'false'),
    ('MY_PAGE', 'mypage_route_count_card', 'STAT_CARD', 'mypage_stats', 'Travel routes',
     'mypage-card', NULL, NULL, NULL, NULL,
     'mypage_route_summary_source', 'ROLE_USER', 40, '{"valueKey":"total_routes","helperText":"Saved route history","compact":true}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_route_timeline', 'HISTORY_LIST', 'mypage_side_panel', 'Travel history',
     'mypage-card', NULL, NULL, NULL, NULL,
     'mypage_route_history_source', 'ROLE_USER', 30,
     '{"emptyText":"No saved travel history yet","actionText":"Recommend again","actionUrl":"/view/INTRO1"}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_route_regions_chart', 'CHART', 'mypage_side_panel', 'Visited regions',
     'mypage-card bar', NULL, NULL, NULL, NULL,
     'mypage_route_summary_source', 'ROLE_USER', 40,
     '{"type":"bar","dataPath":"visited_regions","labelKey":"label","valueKey":"value","caption":"Your most used regions","limit":6}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_route_artists_chart', 'CHART', 'mypage_side_panel', 'Preferred artists',
     'mypage-card donut', NULL, NULL, NULL, NULL,
     'mypage_route_summary_source', 'ROLE_USER', 50,
     '{"type":"donut","dataPath":"preferred_artists","labelKey":"label","valueKey":"value","caption":"Artists in recommendation requests","limit":6}'::jsonb, 'true'),

    ('ADMIN_DASHBOARD', 'admin_travel_trends_source', 'DATA_SOURCE', 'admin_dashboard_root', 'Travel trends source',
     '', NULL, 'AUTO_FETCH', NULL, '/kride-api/stats/travel-trends?limit=10',
     'admin_travel_trends_source', 'ROLE_ADMIN', 6, '{}'::jsonb, 'false'),
    ('ADMIN_DASHBOARD', 'admin_popular_regions_chart', 'CHART', 'admin_charts_grid', 'Popular regions',
     'admin-dashboard-card bar', NULL, NULL, NULL, NULL,
     'admin_travel_trends_source', 'ROLE_ADMIN', 50,
     '{"type":"bar","dataPath":"regions","labelKey":"label","valueKey":"value","caption":"Top 10 regions from route history","limit":10}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_popular_artists_chart', 'CHART', 'admin_charts_grid', 'Popular artists',
     'admin-dashboard-card bar', NULL, NULL, NULL, NULL,
     'admin_travel_trends_source', 'ROLE_ADMIN', 60,
     '{"type":"bar","dataPath":"artists","labelKey":"label","valueKey":"value","caption":"Top 10 artists from route history","limit":10}'::jsonb, 'true')
)
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id, label_text,
    css_class, group_direction, action_type, data_sql_key, data_api_url,
    ref_data_id, allowed_roles, sort_order, component_props, is_visible
)
SELECT
    r.screen_id, r.component_id, r.component_type, r.parent_group_id, r.label_text,
    r.css_class, r.group_direction, r.action_type, r.data_sql_key, r.data_api_url,
    r.ref_data_id, r.allowed_roles, r.sort_order, r.component_props, r.is_visible
FROM rows r
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata u
    WHERE u.screen_id = r.screen_id
      AND u.component_id = r.component_id
);
