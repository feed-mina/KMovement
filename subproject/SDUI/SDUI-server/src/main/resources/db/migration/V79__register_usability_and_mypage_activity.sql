-- V79: 회원가입 아이디 중복 확인/입력 순서 개선 및 마이페이지 0값 지역 차트 교체.

-- 회원가입 기본 정보: 아이디 입력 + 중복 확인 버튼.
INSERT INTO ui_metadata (
    screen_id, component_id, label_text, component_type, sort_order,
    is_required, is_readonly, placeholder, css_class,
    action_type, action_url, ref_data_id,
    group_id, group_direction, parent_group_id, is_visible, component_props
)
SELECT
    'REGISTER_PAGE', 'REG_ID_ROW', '아이디 입력', 'GROUP', 1,
    false, false, NULL, 'REG_ID_ROW',
    NULL, NULL, NULL,
    'REG_ID_ROW', 'horizontal', 'INFO_SECTION', 'true', '{}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'REGISTER_PAGE' AND component_id = 'REG_ID_ROW'
);

INSERT INTO ui_metadata (
    screen_id, component_id, label_text, component_type, sort_order,
    is_required, is_readonly, placeholder, css_class,
    action_type, action_url, ref_data_id,
    group_direction, parent_group_id, is_visible, component_props
)
SELECT
    'REGISTER_PAGE', 'reg_user_id', '아이디', 'INPUT', 1,
    true, false, '영문·숫자·밑줄 4~20자', 'reg_user_id',
    NULL, NULL, 'userId',
    'COLUMN', 'REG_ID_ROW', 'true', '{}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'REGISTER_PAGE' AND component_id = 'reg_user_id'
);

INSERT INTO ui_metadata (
    screen_id, component_id, label_text, component_type, sort_order,
    is_required, is_readonly, css_class,
    action_type, action_url,
    group_direction, parent_group_id, is_visible, component_props
)
SELECT
    'REGISTER_PAGE', 'reg_id_check', '중복 확인', 'BUTTON', 2,
    false, false, 'reg_id_check',
    'CHECK_USER_ID', '/api/auth/check-user-id',
    'COLUMN', 'REG_ID_ROW', 'true', '{}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM ui_metadata
    WHERE screen_id = 'REGISTER_PAGE' AND component_id = 'reg_id_check'
);

UPDATE ui_metadata
SET sort_order = CASE component_id
    WHEN 'reg_email' THEN 2
    WHEN 'reg_pw' THEN 3
    WHEN 'reg_phone' THEN 4
    ELSE sort_order
END
WHERE screen_id = 'REGISTER_PAGE'
  AND component_id IN ('reg_email', 'reg_pw', 'reg_phone');

UPDATE ui_metadata
SET placeholder = '010-1234-5678',
    is_required = true,
    component_props = COALESCE(component_props, '{}'::jsonb) || '{"type":"tel","inputMode":"numeric","maxLength":13}'::jsonb
WHERE screen_id = 'REGISTER_PAGE'
  AND component_id = 'reg_phone';

-- 주소 입력 순서: 우편번호 → 도로명 → 상세주소 → 주소 찾기.
UPDATE ui_metadata
SET parent_group_id = 'ADDR_SECTION',
    sort_order = CASE component_id
        WHEN 'reg_zipcode' THEN 1
        WHEN 'reg_road_addr' THEN 2
        WHEN 'reg_detail_addr' THEN 3
        WHEN 'reg_addr_btn' THEN 4
        ELSE sort_order
    END
WHERE screen_id = 'REGISTER_PAGE'
  AND component_id IN ('reg_zipcode', 'reg_road_addr', 'reg_detail_addr', 'reg_addr_btn');

UPDATE ui_metadata
SET is_visible = 'false'
WHERE screen_id = 'REGISTER_PAGE'
  AND component_id = 'ADDR_SEARCH_ROW';

-- 방문 지역이 없을 때 내부 키 0값을 노출하던 차트를 실제 커뮤니티 활동으로 교체.
UPDATE ui_metadata
SET label_text = '커뮤니티 활동',
    ref_data_id = 'mypage_community_activity_source',
    css_class = 'mypage-card bar',
    component_props = '{
        "type":"bar",
        "caption":"게시글 / 좋아요 / 팔로워 / 팔로잉",
        "series":[
            {"key":"post_count","label":"게시글","color":"#e11d48"},
            {"key":"likes_received","label":"좋아요","color":"#0f9f6e"},
            {"key":"follower_count","label":"팔로워","color":"#0ea5e9"},
            {"key":"following_count","label":"팔로잉","color":"#7c3aed"}
        ]
    }'::jsonb
WHERE screen_id = 'MY_PAGE'
  AND component_id = 'mypage_route_regions_chart';
