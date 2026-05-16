-- V47: INTRO3/INTRO4 UX 문제 수정 (스크린샷 피드백 반영 — 0517 아침)
-- 문제_5 (INTRO3): TypewriterText 효과 제거 + 다음 버튼 스크롤 없이 표시
-- 문제_6 (INTRO4): '여' 글자 겹침 수정 + INTRO5 이동 버튼 표시

-- ─────────────────────────────────────────────────────────────
-- INTRO3: TypewriterText → TEXT 복원
-- V46에서 intro3_title이 TYPEWRITER_TEXT로 잘못 설정된 경우 복원
-- ─────────────────────────────────────────────────────────────
UPDATE ui_metadata
SET component_type = 'TEXT'
WHERE screen_id = 'KRIDE_INTRO3'
  AND component_id = 'intro3_title'
  AND component_type = 'TYPEWRITER_TEXT';

-- ─────────────────────────────────────────────────────────────
-- INTRO4: purpose_grid per-item 과도한 패딩 제거
-- REPEATER 아이템 div에 pb-24(96px)가 개별 적용되어 총 576px 낭비
-- → w-full만 유지 (height 낭비 제거)
-- ─────────────────────────────────────────────────────────────
UPDATE ui_metadata
SET css_class = 'w-full'
WHERE screen_id = 'KRIDE_INTRO4'
  AND component_id = 'purpose_grid';

-- ─────────────────────────────────────────────────────────────
-- INTRO4: root 레이아웃 재설정
-- gap-6 → gap-3, py-10 → pt-4 pb-28 (버튼 고정 영역 확보)
-- 예상 콘텐츠 총 높이: ~1260px → ~656px (viewport 844px 내)
-- ─────────────────────────────────────────────────────────────
UPDATE ui_metadata
SET css_class = 'min-h-screen bg-black flex flex-col px-6 pt-4 pb-28 gap-3'
WHERE screen_id = 'KRIDE_INTRO4'
  AND component_id = 'intro4_root';

-- ─────────────────────────────────────────────────────────────
-- INTRO4: title sticky 추가 (INTRO2/3과 동일한 패턴)
-- 스크롤 시 title이 가려져 '여' 글자가 잘리는 문제 방지
-- ─────────────────────────────────────────────────────────────
UPDATE ui_metadata
SET css_class = 'sticky top-0 bg-black z-10 py-3 text-2xl font-bold text-white'
WHERE screen_id = 'KRIDE_INTRO4'
  AND component_id = 'intro4_title';

-- ─────────────────────────────────────────────────────────────
-- INTRO4: next button wrapper에 z-50 추가
-- purpose card들에 가려지는 문제 방지 + 버튼 항상 최상단 표시
-- ─────────────────────────────────────────────────────────────
UPDATE ui_metadata
SET css_class = 'fixed bottom-0 left-0 right-0 px-6 pb-6 pt-10 bg-gradient-to-t from-black to-transparent z-50'
WHERE screen_id = 'KRIDE_INTRO4'
  AND component_id = 'intro4_next_wrap';
