-- V124: MAIN_PAGE 액션 위계 정리 (벤치마킹 G4).
--
-- 근거: work-map-guide/ui-benchmark-20261006-165751-six-screens/kride-six-screens-ui-spec.md §3-3
--   홈에 빨간 filled Primary 가 3개(여행 시작 · K-POP 탐색 · 로그인 카드)였다.
--   소비자 앱 4/4 레퍼런스(Airbnb·토스·Trip.com·당근) 공통: 히어로 1개 → 상황 카드 → 기능 타일.
--
--   1) K-POP 팬 여행 카드를 히어로에서 "기능 타일" 로 강등 (bento-card-tile, 흰 배경 + 테두리 CTA)
--   2) 로그인 하러가기 카드를 큰 빨간 블록에서 "한 줄 배너" 로 (bento-card-login-banner)
--   3) 정렬: 히어로(5) → 로그인 배너(6) → 시간 카드(10) → K-POP 타일(12) → 커뮤니티/AI 채팅
--
-- DDL 없음. ui_metadata 행의 css_class / label_text / sort_order 만 바꾼다.

BEGIN;

-- 1) K-POP 카드 → 타일
UPDATE ui_metadata
SET css_class = 'bento-card bento-card-tile bento-card-tile-kpop',
    sort_order = 12
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_kpop_grp';

UPDATE ui_metadata SET css_class = 'bento-card-tile__kicker'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_kpop_kicker';

UPDATE ui_metadata SET css_class = 'bento-card-tile__title'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_kpop_title';

UPDATE ui_metadata SET css_class = 'bento-card-tile__desc'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_kpop_desc';

UPDATE ui_metadata SET css_class = 'bento-card-tile__cta', label_text = 'K-POP 탐색하기 →'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_kpop_btn';

-- 2) 로그인 카드 → 한 줄 배너 (GUEST 에게만 보이던 조건은 그대로)
UPDATE ui_metadata
SET css_class = 'bento-card bento-card-login-banner col-span-3',
    sort_order = 6
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_login_grp';

UPDATE ui_metadata SET css_class = 'bento-card-login-banner__body'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_login_body';

UPDATE ui_metadata
SET label_text = '로그인하면 코스와 저장 목록이 유지돼요',
    css_class = 'bento-card-login-banner__title'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_login_title';

UPDATE ui_metadata
SET label_text = '로그인 하러가기 →',
    css_class = 'bento-card-login-banner__link'
WHERE screen_id = 'MAIN_PAGE' AND component_id = 'main_bento_login_desc';

COMMIT;

-- 검증
--   /view/MAIN_PAGE (비로그인): 검은 히어로 1개 + 그 아래 한 줄 로그인 배너, K-POP 은 흰 타일
--   /view/MAIN_PAGE (로그인): 로그인 배너 없음
-- 롤백
--   UPDATE ui_metadata SET css_class='bento-card bento-card-kride col-span-3', sort_order=6
--     WHERE screen_id='MAIN_PAGE' AND component_id='main_bento_kpop_grp';
--   (kicker/title/desc/btn 은 bento-card-kride__* 로, 로그인 카드는 V8 값으로 되돌린다)
