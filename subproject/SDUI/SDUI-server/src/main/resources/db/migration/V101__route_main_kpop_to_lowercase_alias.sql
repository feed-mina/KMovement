-- MAIN_PAGE K-POP 진입 버튼을 Vercel 외부 링크 대신
-- metadata-project 내부 소문자 진입 경로(/view/kpop)로 고정한다.

UPDATE ui_metadata
SET action_type = 'ROUTE',
    action_url = '/view/kpop',
    is_readonly = false
WHERE screen_id = 'MAIN_PAGE'
  AND component_id IN ('main_bento_kpop_btn', 'main_bento_kpop_btn_g');
