-- V72: MY_PAGE SDUI screen with user-owned memories, community activity, and goal stats.
-- GitHub issue #37.

INSERT INTO query_master (sql_key, query_text, return_type, description, created_at, updated_at, required_role)
VALUES
(
    'mypage_profile',
    $mypage_sql$
    SELECT
        user_sqno,
        user_id,
        email,
        COALESCE(NULLIF(nickname, ''), NULLIF(user_id, ''), 'Rider') AS display_name,
        TO_CHAR(COALESCE(created_at, reg_dt), 'YYYY.MM.DD') AS joined_at
    FROM users
    WHERE user_sqno = CAST(:userSqno AS BIGINT)
      AND COALESCE(del_yn, 'N') <> 'Y'
    $mypage_sql$,
    'SINGLE',
    'My page profile summary',
    NOW(),
    NOW(),
    'ROLE_USER'
),
(
    'mypage_memory_gallery',
    $mypage_sql$
    SELECT
        j.id,
        j.post_id,
        p.title,
        j.status,
        j.result_url,
        COALESCE(j.result_url, img.storage_url) AS thumbnail_url,
        j.route,
        j.actual_model,
        j.total_images,
        j.processed_images,
        j.created_at,
        COUNT(*) OVER()::BIGINT AS memory_count
    FROM community_animation_jobs j
    JOIN community_post p ON p.post_id = j.post_id
    LEFT JOIN LATERAL (
        SELECT storage_url
        FROM post_image pi
        WHERE pi.post_id = p.post_id
        ORDER BY pi.sort_order ASC, pi.post_image_id ASC
        LIMIT 1
    ) img ON TRUE
    WHERE p.author_sqno = CAST(:userSqno AS BIGINT)
      AND COALESCE(p.del_yn, 'N') <> 'Y'
    ORDER BY j.created_at DESC
    LIMIT 12
    $mypage_sql$,
    'MULTI',
    'My page memory video gallery',
    NOW(),
    NOW(),
    'ROLE_USER'
),
(
    'mypage_community_activity',
    $mypage_sql$
    SELECT
        (SELECT COUNT(*)::BIGINT
           FROM community_post p
          WHERE p.author_sqno = CAST(:userSqno AS BIGINT)
            AND COALESCE(p.del_yn, 'N') <> 'Y') AS post_count,
        (SELECT COALESCE(SUM(p.like_count), 0)::BIGINT
           FROM community_post p
          WHERE p.author_sqno = CAST(:userSqno AS BIGINT)
            AND COALESCE(p.del_yn, 'N') <> 'Y') AS likes_received,
        (SELECT COALESCE(SUM(p.report_count), 0)::BIGINT
           FROM community_post p
          WHERE p.author_sqno = CAST(:userSqno AS BIGINT)
            AND COALESCE(p.del_yn, 'N') <> 'Y') AS reports_received,
        (SELECT COUNT(*)::BIGINT
           FROM user_follow f
          WHERE f.follower_sqno = CAST(:userSqno AS BIGINT)) AS following_count,
        (SELECT COUNT(*)::BIGINT
           FROM user_follow f
          WHERE f.followee_sqno = CAST(:userSqno AS BIGINT)) AS follower_count
    $mypage_sql$,
    'SINGLE',
    'My page community activity summary',
    NOW(),
    NOW(),
    'ROLE_USER'
),
(
    'mypage_goal_stats',
    $mypage_sql$
    WITH stats AS (
        SELECT
            COUNT(*)::BIGINT AS total_goals,
            SUM(CASE WHEN status IN ('success', 'safe') THEN 1 ELSE 0 END)::BIGINT AS success_count,
            SUM(CASE WHEN status IS NOT NULL AND status NOT IN ('success', 'safe') THEN 1 ELSE 0 END)::BIGINT AS failure_count,
            SUM(CASE WHEN status IS NULL THEN 1 ELSE 0 END)::BIGINT AS pending_count
        FROM goal_settings
        WHERE user_sqno = CAST(:userSqno AS BIGINT)
    )
    SELECT
        total_goals,
        success_count,
        failure_count,
        pending_count,
        CASE
            WHEN total_goals = 0 THEN 0
            ELSE ROUND(success_count * 100.0 / total_goals, 1)
        END AS attainment_rate
    FROM stats
    $mypage_sql$,
    'SINGLE',
    'My page personal goal stats',
    NOW(),
    NOW(),
    'ROLE_USER'
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
    ('MY_PAGE', 'mypage_profile_source', 'DATA_SOURCE', 'mypage_root', 'Profile source',
     '', NULL, 'AUTO_FETCH', 'mypage_profile', NULL,
     'mypage_profile_source', 'ROLE_USER', 1, '{}'::jsonb, 'false'),
    ('MY_PAGE', 'mypage_memory_gallery_source', 'DATA_SOURCE', 'mypage_root', 'Memory gallery source',
     '', NULL, 'AUTO_FETCH', 'mypage_memory_gallery', NULL,
     'mypage_memory_gallery_source', 'ROLE_USER', 2, '{}'::jsonb, 'false'),
    ('MY_PAGE', 'mypage_community_activity_source', 'DATA_SOURCE', 'mypage_root', 'Community activity source',
     '', NULL, 'AUTO_FETCH', 'mypage_community_activity', NULL,
     'mypage_community_activity_source', 'ROLE_USER', 3, '{}'::jsonb, 'false'),
    ('MY_PAGE', 'mypage_goal_stats_source', 'DATA_SOURCE', 'mypage_root', 'Goal stats source',
     '', NULL, 'AUTO_FETCH', 'mypage_goal_stats', NULL,
     'mypage_goal_stats_source', 'ROLE_USER', 4, '{}'::jsonb, 'false'),

    ('MY_PAGE', 'mypage_root', 'GROUP', NULL, 'My Page',
     'mypage-page', 'COLUMN', NULL, NULL, NULL,
     NULL, 'ROLE_USER', 10, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_header', 'GROUP', 'mypage_root', 'My Page Header',
     'mypage-header', 'COLUMN', NULL, NULL, NULL,
     NULL, 'ROLE_USER', 20, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_title', 'TEXT', 'mypage_header', 'My Page',
     'mypage-title', NULL, NULL, NULL, NULL,
     NULL, 'ROLE_USER', 10, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_subtitle', 'TEXT', 'mypage_header', 'Welcome, {display_name} - Joined {joined_at}',
     'mypage-subtitle', NULL, NULL, NULL, NULL,
     'mypage_profile_source', 'ROLE_USER', 20, '{}'::jsonb, 'true'),

    ('MY_PAGE', 'mypage_stats', 'GROUP', 'mypage_root', 'My Page Stats',
     'mypage-stats', 'ROW', NULL, NULL, NULL,
     NULL, 'ROLE_USER', 30, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_memory_count_card', 'STAT_CARD', 'mypage_stats', 'Memory videos',
     'mypage-card', NULL, NULL, NULL, NULL,
     'mypage_memory_gallery_source', 'ROLE_USER', 10, '{"valueKey":"memory_count","helperText":"Generated videos","compact":true}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_post_count_card', 'STAT_CARD', 'mypage_stats', 'Community posts',
     'mypage-card', NULL, NULL, NULL, NULL,
     'mypage_community_activity_source', 'ROLE_USER', 20, '{"valueKey":"post_count","helperText":"Published posts","compact":true}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_goal_rate_card', 'STAT_CARD', 'mypage_stats', 'Goal success',
     'mypage-card', NULL, NULL, NULL, NULL,
     'mypage_goal_stats_source', 'ROLE_USER', 30, '{"valueKey":"attainment_rate","suffix":"%","helperText":"Personal attainment"}'::jsonb, 'true'),

    ('MY_PAGE', 'mypage_main_grid', 'GROUP', 'mypage_root', 'My Page Main',
     'mypage-main-grid', 'ROW', NULL, NULL, NULL,
     NULL, 'ROLE_USER', 40, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_gallery', 'GALLERY_GRID', 'mypage_main_grid', 'Memory gallery',
     'mypage-card', NULL, NULL, NULL, NULL,
     'mypage_memory_gallery_source', 'ROLE_USER', 10, '{"emptyText":"No generated memories yet"}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_side_panel', 'GROUP', 'mypage_main_grid', 'My Page Side Panel',
     'mypage-side-panel', 'COLUMN', NULL, NULL, NULL,
     NULL, 'ROLE_USER', 20, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_goal_donut', 'CHART', 'mypage_side_panel', 'Goal status',
     'mypage-card donut', NULL, NULL, NULL, NULL,
     'mypage_goal_stats_source', 'ROLE_USER', 10,
     '{"type":"donut","caption":"Success / failure / pending","series":[{"key":"success_count","label":"Success","color":"#0f9f6e"},{"key":"failure_count","label":"Failure","color":"#e11d48"},{"key":"pending_count","label":"Pending","color":"#f59e0b"}]}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_activity', 'GROUP', 'mypage_side_panel', 'Community activity',
     'mypage-activity', 'COLUMN', NULL, NULL, NULL,
     NULL, 'ROLE_USER', 20, '{}'::jsonb, 'true'),
    ('MY_PAGE', 'mypage_activity_text', 'TEXT', 'mypage_activity', 'Posts {post_count} / Likes {likes_received} / Fans {follower_count} / Following {following_count}',
     'mypage-activity-copy', NULL, NULL, NULL, NULL,
     'mypage_community_activity_source', 'ROLE_USER', 10, '{}'::jsonb, 'true')
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
