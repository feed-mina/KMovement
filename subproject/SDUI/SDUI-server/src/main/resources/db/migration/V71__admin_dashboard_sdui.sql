-- V71: ADMIN_DASHBOARD SDUI screen and admin aggregate queries.
-- GitHub issue #36.

INSERT INTO query_master (sql_key, query_text, return_type, description, created_at, updated_at, required_role)
VALUES
(
    'admin_overview_stats',
    $admin_sql$
    SELECT
        COUNT(*)::BIGINT AS total_users,
        COUNT(*) FILTER (WHERE COALESCE(reg_dt, created_at) >= CURRENT_DATE)::BIGINT AS today_signups,
        (SELECT COUNT(*)::BIGINT FROM goal_settings) AS travel_plans,
        (SELECT COUNT(*)::BIGINT FROM community_animation_jobs) AS media_jobs
    FROM users
    WHERE COALESCE(del_yn, 'N') <> 'Y'
    $admin_sql$,
    'SINGLE',
    'Admin dashboard overview metrics',
    NOW(),
    NOW(),
    'ROLE_ADMIN'
),
(
    'admin_signup_trend',
    $admin_sql$
    SELECT
        TO_CHAR(days.bucket, 'MM-DD') AS label,
        COUNT(u.user_sqno)::BIGINT AS value
    FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS days(bucket)
    LEFT JOIN users u
        ON COALESCE(u.reg_dt, u.created_at)::date = days.bucket::date
       AND COALESCE(u.del_yn, 'N') <> 'Y'
    GROUP BY days.bucket
    ORDER BY days.bucket
    $admin_sql$,
    'MULTI',
    'Admin dashboard signup trend',
    NOW(),
    NOW(),
    'ROLE_ADMIN'
),
(
    'admin_media_usage',
    $admin_sql$
    SELECT
        COALESCE(NULLIF(LOWER(status), ''), 'unknown') AS label,
        COUNT(*)::BIGINT AS value
    FROM community_animation_jobs
    GROUP BY 1
    ORDER BY value DESC, label ASC
    $admin_sql$,
    'MULTI',
    'Admin dashboard media generation usage',
    NOW(),
    NOW(),
    'ROLE_ADMIN'
),
(
    'admin_community_stats',
    $admin_sql$
    SELECT
        COUNT(*) FILTER (WHERE COALESCE(del_yn, 'N') <> 'Y')::BIGINT AS posts,
        COALESCE(SUM(like_count) FILTER (WHERE COALESCE(del_yn, 'N') <> 'Y'), 0)::BIGINT AS likes,
        COALESCE(SUM(report_count) FILTER (WHERE COALESCE(del_yn, 'N') <> 'Y'), 0)::BIGINT AS reports
    FROM community_post
    $admin_sql$,
    'SINGLE',
    'Admin dashboard community activity',
    NOW(),
    NOW(),
    'ROLE_ADMIN'
)
ON CONFLICT (sql_key) DO UPDATE
SET query_text = EXCLUDED.query_text,
    return_type = EXCLUDED.return_type,
    description = EXCLUDED.description,
    updated_at = NOW(),
    required_role = EXCLUDED.required_role;

WITH rows (
    screen_id, component_id, component_type, parent_group_id, label_text,
    css_class, group_direction, action_type, data_sql_key, data_api_url,
    ref_data_id, allowed_roles, sort_order, component_props, is_visible
) AS (
    VALUES
    ('ADMIN_DASHBOARD', 'admin_overview_source', 'DATA_SOURCE', 'admin_dashboard_root', 'Overview source',
     '', NULL, 'AUTO_FETCH', 'admin_overview_stats', NULL,
     'admin_overview_source', 'ROLE_ADMIN', 1, '{}'::jsonb, 'false'),
    ('ADMIN_DASHBOARD', 'admin_signup_trend_source', 'DATA_SOURCE', 'admin_dashboard_root', 'Signup trend source',
     '', NULL, 'AUTO_FETCH', 'admin_signup_trend', NULL,
     'admin_signup_trend_source', 'ROLE_ADMIN', 2, '{}'::jsonb, 'false'),
    ('ADMIN_DASHBOARD', 'admin_media_usage_source', 'DATA_SOURCE', 'admin_dashboard_root', 'Media usage source',
     '', NULL, 'AUTO_FETCH', 'admin_media_usage', NULL,
     'admin_media_usage_source', 'ROLE_ADMIN', 3, '{}'::jsonb, 'false'),
    ('ADMIN_DASHBOARD', 'admin_community_stats_source', 'DATA_SOURCE', 'admin_dashboard_root', 'Community stats source',
     '', NULL, 'AUTO_FETCH', 'admin_community_stats', NULL,
     'admin_community_stats_source', 'ROLE_ADMIN', 4, '{}'::jsonb, 'false'),
    ('ADMIN_DASHBOARD', 'admin_goal_dashboard_source', 'DATA_SOURCE', 'admin_dashboard_root', 'Goal dashboard source',
     '', NULL, 'AUTO_FETCH', NULL, '/api/admin/goal-dashboard',
     'admin_goal_dashboard_source', 'ROLE_ADMIN', 5, '{}'::jsonb, 'false'),

    ('ADMIN_DASHBOARD', 'admin_dashboard_root', 'GROUP', NULL, 'Admin Dashboard',
     'admin-dashboard-page', 'COLUMN', NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 10, '{}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_dashboard_header', 'GROUP', 'admin_dashboard_root', 'Admin Dashboard Header',
     'admin-dashboard-header', 'COLUMN', NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 20, '{}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_dashboard_title', 'TEXT', 'admin_dashboard_header', 'Admin Dashboard',
     'admin-dashboard-title', NULL, NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 10, '{}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_dashboard_subtitle', 'TEXT', 'admin_dashboard_header', 'Users, goals, media, and community operations',
     'admin-dashboard-subtitle', NULL, NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 20, '{}'::jsonb, 'true'),

    ('ADMIN_DASHBOARD', 'admin_metrics_grid', 'GROUP', 'admin_dashboard_root', 'Dashboard Metrics',
     'admin-dashboard-metrics', 'ROW', NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 30, '{}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_total_users_card', 'STAT_CARD', 'admin_metrics_grid', 'Total users',
     'admin-dashboard-card accent-blue', NULL, NULL, NULL, NULL,
     'admin_overview_source', 'ROLE_ADMIN', 10, '{"valueKey":"total_users","helperText":"Active accounts","compact":true}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_today_signups_card', 'STAT_CARD', 'admin_metrics_grid', 'Today signups',
     'admin-dashboard-card accent-green', NULL, NULL, NULL, NULL,
     'admin_overview_source', 'ROLE_ADMIN', 20, '{"valueKey":"today_signups","helperText":"Since midnight","compact":true}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_travel_plans_card', 'STAT_CARD', 'admin_metrics_grid', 'Travel plans',
     'admin-dashboard-card accent-red', NULL, NULL, NULL, NULL,
     'admin_overview_source', 'ROLE_ADMIN', 30, '{"valueKey":"travel_plans","helperText":"Goal records","compact":true}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_media_jobs_card', 'STAT_CARD', 'admin_metrics_grid', 'Media generation',
     'admin-dashboard-card accent-amber', NULL, NULL, NULL, NULL,
     'admin_overview_source', 'ROLE_ADMIN', 40, '{"valueKey":"media_jobs","helperText":"Animation jobs","compact":true}'::jsonb, 'true'),

    ('ADMIN_DASHBOARD', 'admin_charts_grid', 'GROUP', 'admin_dashboard_root', 'Dashboard Charts',
     'admin-dashboard-charts', 'ROW', NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 40, '{}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_signup_trend_chart', 'CHART', 'admin_charts_grid', 'Signup trend',
     'admin-dashboard-card line', NULL, NULL, NULL, NULL,
     'admin_signup_trend_source', 'ROLE_ADMIN', 10, '{"type":"line","labelKey":"label","valueKey":"value","caption":"Last 14 days","limit":14}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_goal_success_chart', 'CHART', 'admin_charts_grid', 'Goal success rate',
     'admin-dashboard-card bar', NULL, NULL, NULL, NULL,
     'admin_goal_dashboard_source', 'ROLE_ADMIN', 20, '{"type":"bar","dataPath":"monthly","labelKey":"month","valueKey":"attainmentRate","caption":"Monthly attainment %","limit":6}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_media_usage_chart', 'CHART', 'admin_charts_grid', 'AI/media usage',
     'admin-dashboard-card donut', NULL, NULL, NULL, NULL,
     'admin_media_usage_source', 'ROLE_ADMIN', 30, '{"type":"donut","labelKey":"label","valueKey":"value","caption":"Job status ratio"}'::jsonb, 'true'),
    ('ADMIN_DASHBOARD', 'admin_community_stats_chart', 'CHART', 'admin_charts_grid', 'Community activity',
     'admin-dashboard-card bar', NULL, NULL, NULL, NULL,
     'admin_community_stats_source', 'ROLE_ADMIN', 40, '{"type":"bar","caption":"Posts, likes, reports"}'::jsonb, 'true'),

    ('ADMIN_DASHBOARD', 'admin_recent_users_table', 'ADMIN_USER_TABLE', 'admin_dashboard_root', 'Recent users',
     'admin-dashboard-table admin-user-table-wrapper', NULL, NULL, NULL, NULL,
     NULL, 'ROLE_ADMIN', 50, '{}'::jsonb, 'true')
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
