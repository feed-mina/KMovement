-- V93: MAIN_PAGE 진입 카드(KRIDE 여행/K-POP)를 역할 무관 단일 세트로 통합.
--
-- 문제: V51/V89는 같은 카드를 ROLE_USER용·ROLE_GUEST용(_g) 두 벌로 시드했다.
-- UiService의 RBAC 필터는 allowed_roles가 비면 모두에게 보여주고, 값이 있으면
-- 정확히 일치하는 역할에게만 보여준다. 그 결과 ROLE_ADMIN·ROLE_PARTNER 등
-- 다른 역할로 로그인하면 두 벌 모두 걸러져 '여행 시작하기(INTRO)'와
-- 'K-POP 탐색하기' 진입 경로가 화면에서 통째로 사라졌다 (모바일은 이 카드가
-- 유일한 UI 진입점이라 특히 치명적).
--
-- 해결: 기본 세트는 allowed_roles를 비워 모두에게 노출하고, _g 중복 세트는 삭제.
-- 두 카드의 문구/동작은 역할별 차이가 없었으므로 UX 변화 없음.
-- 적용 후 화면 메타 캐시(Redis)가 있다면 갱신 지연이 있을 수 있다.

UPDATE ui_metadata
SET allowed_roles = NULL
WHERE screen_id = 'MAIN_PAGE'
  AND (component_id LIKE 'main\_bento\_kride\_%' ESCAPE '\'
       OR component_id LIKE 'main\_bento\_kpop\_%' ESCAPE '\')
  AND component_id NOT LIKE '%\_g' ESCAPE '\';

DELETE FROM ui_metadata
WHERE screen_id = 'MAIN_PAGE'
  AND (component_id LIKE 'main\_bento\_kride\_%\_g' ESCAPE '\'
       OR component_id LIKE 'main\_bento\_kpop\_%\_g' ESCAPE '\');
