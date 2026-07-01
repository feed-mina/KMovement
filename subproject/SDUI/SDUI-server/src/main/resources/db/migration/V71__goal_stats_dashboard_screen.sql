-- V71: 목표 달성률 대시보드 화면 추가 (SDUI)
-- goal_settings 기반 월별 달성률 / 성공·실패 추이 / 사용자별 달성 현황 카드

-- ── GOAL_STATS_PAGE 화면 등록 ──────────────────────────────────────────────

-- 루트 섹션
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order,
    is_required, is_readonly, is_visible
)
SELECT
    'GOAL_STATS_PAGE', 'goal_stats_section', 'GROUP', NULL,
    '목표 달성률 대시보드', 'page-section', 'COLUMN', 'ROLE_USER', 0,
    false, false, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'goal_stats_section'
);

-- 헤더 카드 (달성률 요약)
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order,
    is_required, is_readonly, is_visible,
    data_api_url, data_params
)
SELECT
    'GOAL_STATS_PAGE', 'achievement_rate_card', 'GROUP', 'goal_stats_section',
    '이번 달 달성률', 'bento-card bento-card-highlight', 'COLUMN', 'ROLE_USER', 10,
    false, false, 'true',
    '/api/goalTime/stats/monthly', NULL
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'achievement_rate_card'
);

-- 헤더 카드 — 제목
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible
)
SELECT
    'GOAL_STATS_PAGE', 'achievement_rate_title', 'TEXT', 'achievement_rate_card',
    '🎯 이번 달 목표 달성률', 'bento-card-title', 'ROLE_USER', 1, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'achievement_rate_title'
);

-- 달성률 수치 표시
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible,
    data_api_url
)
SELECT
    'GOAL_STATS_PAGE', 'achievement_rate_value', 'DYNAMIC_TEXT', 'achievement_rate_card',
    '-%', 'stat-value-xl', 'ROLE_USER', 2, 'true',
    '/api/goalTime/stats/monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'achievement_rate_value'
);

-- 성공/실패 수 ROW
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible
)
SELECT
    'GOAL_STATS_PAGE', 'achievement_counts_row', 'GROUP', 'achievement_rate_card',
    'counts row', 'stat-group', 'ROW', 'ROLE_USER', 3, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'achievement_counts_row'
);

-- 성공 건수
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible,
    data_api_url
)
SELECT
    'GOAL_STATS_PAGE', 'success_count_item', 'DYNAMIC_TEXT', 'achievement_counts_row',
    '✅ 성공', 'stat-item stat-success', 'ROLE_USER', 1, 'true',
    '/api/goalTime/stats/monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'success_count_item'
);

-- 실패 건수
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible,
    data_api_url
)
SELECT
    'GOAL_STATS_PAGE', 'fail_count_item', 'DYNAMIC_TEXT', 'achievement_counts_row',
    '❌ 실패', 'stat-item stat-fail', 'ROLE_USER', 2, 'true',
    '/api/goalTime/stats/monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'fail_count_item'
);

-- 일별 추이 카드
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible,
    data_api_url
)
SELECT
    'GOAL_STATS_PAGE', 'daily_trend_card', 'GROUP', 'goal_stats_section',
    '일별 달성 추이', 'bento-card col-span-2', 'COLUMN', 'ROLE_USER', 20, 'true',
    '/api/goalTime/stats/monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'daily_trend_card'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible
)
SELECT
    'GOAL_STATS_PAGE', 'daily_trend_title', 'TEXT', 'daily_trend_card',
    '📅 일별 달성 추이', 'bento-card-title', 'ROLE_USER', 1, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'daily_trend_title'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible,
    data_api_url
)
SELECT
    'GOAL_STATS_PAGE', 'daily_trend_list', 'LIST', 'daily_trend_card',
    'daily results', 'goal-trend-list', 'ROLE_USER', 2, 'true',
    '/api/goalTime/stats/monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'daily_trend_list'
);

-- 뒤로가기 버튼
INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, action_type, action_url,
    allowed_roles, sort_order, is_visible
)
SELECT
    'GOAL_STATS_PAGE', 'back_btn', 'BUTTON', 'goal_stats_section',
    '← 돌아가기', 'back-btn', 'BACK', NULL,
    'ROLE_USER', 100, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'GOAL_STATS_PAGE' AND component_id = 'back_btn'
);

-- ── 메인 페이지에 달성률 대시보드 카드 링크 추가 (일반 사용자) ────────────────

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, action_type, action_url,
    allowed_roles, sort_order, is_visible
)
SELECT
    'MAIN_PAGE', 'goal_stats_card', 'GROUP', 'MAIN_SECTION',
    '목표 달성률', 'bento-card bento-card-goal-stats', 'COLUMN', NULL, NULL,
    'ROLE_USER', 15, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE' AND component_id = 'goal_stats_card'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, group_direction, allowed_roles, sort_order, is_visible
)
SELECT
    'MAIN_PAGE', 'goal_stats_card_header', 'GROUP', 'goal_stats_card',
    'header row', 'card-header', 'ROW', 'ROLE_USER', 1, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE' AND component_id = 'goal_stats_card_header'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible
)
SELECT
    'MAIN_PAGE', 'goal_stats_card_title', 'TEXT', 'goal_stats_card_header',
    '🎯 이번 달 달성률', 'bento-card-title', 'ROLE_USER', 1, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE' AND component_id = 'goal_stats_card_title'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, action_type, action_url,
    allowed_roles, sort_order, is_visible
)
SELECT
    'MAIN_PAGE', 'goal_stats_card_btn', 'BUTTON', 'goal_stats_card_header',
    '→', 'arrow-btn', 'LINK', '/view/GOAL_STATS_PAGE',
    'ROLE_USER', 2, 'true'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE' AND component_id = 'goal_stats_card_btn'
);

INSERT INTO ui_metadata (
    screen_id, component_id, component_type, parent_group_id,
    label_text, css_class, allowed_roles, sort_order, is_visible,
    data_api_url
)
SELECT
    'MAIN_PAGE', 'goal_stats_card_rate', 'DYNAMIC_TEXT', 'goal_stats_card',
    '이번 달 도착 성공률을 확인하세요', 'card-desc', 'ROLE_USER', 2, 'true',
    '/api/goalTime/stats/monthly'
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE' AND component_id = 'goal_stats_card_rate'
);
