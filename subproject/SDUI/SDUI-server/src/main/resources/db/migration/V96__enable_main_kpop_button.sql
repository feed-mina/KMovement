-- ButtonField는 is_readonly=true인 버튼을 disabled 처리하므로 K-POP 진입 버튼을 활성화한다.

UPDATE ui_metadata
SET is_readonly = false
WHERE screen_id = 'MAIN_PAGE'
  AND component_id IN ('main_bento_kpop_btn', 'main_bento_kpop_btn_g');