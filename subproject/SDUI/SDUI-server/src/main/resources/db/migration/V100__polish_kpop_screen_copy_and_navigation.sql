-- K-POP 화면 카피를 한국어로 통일하고 상세 화면의 정보 위계를 보강한다.

UPDATE ui_metadata
SET label_text = CASE component_id
        WHEN 'kpop_title' THEN 'K-POP 팬 여행 탐색'
        WHEN 'kpop_subtitle' THEN '좋아하는 아티스트를 따라 이벤트와 팬 여행 정보를 한곳에서 확인해 보세요.'
        WHEN 'kpop_events_cta' THEN '다가오는 이벤트 보기'
    END
WHERE screen_id = 'KPOP_EXPLORE'
  AND component_id IN ('kpop_title', 'kpop_subtitle', 'kpop_events_cta');

UPDATE ui_metadata
SET label_text = 'K-POP 이벤트 일정'
WHERE screen_id = 'KPOP_EVENTS'
  AND component_id = 'kpop_events_title';

-- 대화형 AI 컴포넌트 자체에 명확한 h2가 있어 중복 화면 제목은 숨긴다.
UPDATE ui_metadata
SET is_visible = 'false'
WHERE screen_id IN ('KPOP_AI_FIND', 'KPOP_AI_RESULT')
  AND component_id IN ('kpop_ai_find_title', 'kpop_ai_result_title');

DELETE FROM ui_metadata
WHERE screen_id IN ('KPOP_ARTIST_DETAIL', 'KPOP_EVENT_DETAIL')
  AND component_id IN (
    'kpop_artist_detail_title',
    'kpop_artist_detail_back',
    'kpop_event_detail_title',
    'kpop_event_detail_back'
  );

INSERT INTO ui_metadata (
  screen_id, component_id, component_type, label_text, sort_order,
  ref_data_id, parent_group_id, group_direction, css_class,
  action_type, action_url, data_sql_key, is_readonly, is_visible, component_props
)
VALUES
('KPOP_ARTIST_DETAIL', 'kpop_artist_detail_title', 'TEXT', '아티스트 상세', 2,
 NULL, 'kpop_artist_detail_root', NULL, 'kpop-title',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_ARTIST_DETAIL', 'kpop_artist_detail_back', 'BUTTON', '아티스트 목록으로 돌아가기', 4,
 NULL, 'kpop_artist_detail_root', NULL, 'kpop-back-btn',
 'ROUTE', '/view/KPOP_EXPLORE', NULL, false, 'true', '{}'),
('KPOP_EVENT_DETAIL', 'kpop_event_detail_title', 'TEXT', '이벤트 상세', 2,
 NULL, 'kpop_event_detail_root', NULL, 'kpop-title',
 NULL, NULL, NULL, true, 'true', '{}'),
('KPOP_EVENT_DETAIL', 'kpop_event_detail_back', 'BUTTON', '이벤트 목록으로 돌아가기', 4,
 NULL, 'kpop_event_detail_root', NULL, 'kpop-back-btn',
 'ROUTE', '/view/KPOP_EVENTS', NULL, false, 'true', '{}');

UPDATE ui_metadata
SET sort_order = 3
WHERE screen_id IN ('KPOP_ARTIST_DETAIL', 'KPOP_EVENT_DETAIL')
  AND component_id IN ('kpop_artist_detail', 'kpop_event_detail');