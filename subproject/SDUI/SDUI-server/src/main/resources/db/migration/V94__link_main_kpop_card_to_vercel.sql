-- MAIN_PAGE의 K-POP 팬 여행 카드를 독립 Vercel 웹으로 연결한다.
-- V89가 이미 적용된 운영 DB에도 반영되도록 새 마이그레이션에서 갱신한다.

UPDATE ui_metadata
SET action_type = 'LINK',
    action_url = 'https://k-movement.vercel.app/kpop'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id IN ('main_bento_kpop_btn', 'main_bento_kpop_btn_g');