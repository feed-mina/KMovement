-- ─────────────────────────────────────────────────────────────────────────────
-- V49__kride_intro1_fit_fix.sql
-- KRIDE_INTRO1 화면 비율 및 한글 텍스트 오버플로 수정.
--
-- 작업 범위: ui_metadata 의 css_class 컬럼만 UPDATE.
--   • DDL 변경 없음 (테이블/컬럼 추가 없음)
--   • 새 component_id 추가 없음 (기존 5개 컴포넌트 그대로)
--   • DynamicEngine 라우팅 키워드(`flex`, `flex-col`, `grid` 등)는 유지
--
-- 함께 적용해야 하는 파일:
--   • metadata-project/app/styles/KRIDE.css  ← 새 헬퍼 클래스 append
--     (publish/production/KRIDE.css.append.css 참조)
--
-- 영향받지 않는 파일 (수정 금지):
--   • next.config.ts
--   • app/globals.css 의 @source inline safelist
--   • components/constants/componentMap.tsx
--   • SDUI DynamicEngine 코어
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. intro1_root
--    Before: 'min-h-screen bg-black flex flex-col items-center px-6 pt-12 pb-8 gap-6'
--    After : 동일한 구조 유지 + .kride-intro1-root 가 padding/gap 재정의
--    items-center 제거: 자식 요소가 폭을 직접 제어하도록.
UPDATE ui_metadata
SET css_class = 'min-h-screen bg-black flex flex-col kride-intro1-root'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_root';

-- 2. intro1_hero
--    Before: 'w-full max-w-xs h-56 object-contain mx-auto'  ← 320×224 박스 + object-contain 으로 흰 여백 발생
--    After : 16:10 aspect-ratio 슬롯. 폭 100%, 높이는 비율 따라 자동.
UPDATE ui_metadata
SET css_class = 'w-full kride-intro1-hero-slot'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_hero';

-- 3. intro1_title (TYPEWRITER_TEXT)
--    Before: 'text-3xl font-black text-white text-center leading-snug'
--    After : 좌측 정렬, word-break: keep-all 로 한글 줄바꿈 정상화,
--            font-size 를 28px 로 낮춰 360px 폭 기기에서도 안전.
UPDATE ui_metadata
SET css_class = 'text-white kride-intro1-title'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_title';

-- 4. intro1_sub
--    Before: 'text-gray-400 text-base text-center mb-4'
--    After : 좌측 정렬 + word-break: keep-all + 적정 line-height.
UPDATE ui_metadata
SET css_class = 'kride-intro1-sub'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_sub';

-- 5. intro1_buttons (COLUMN GROUP — DURATION_BUTTON × 3)
--    Before: 'flex flex-col gap-4 w-full max-w-sm mt-6'
--    After : margin-top: auto 로 하단 고정. max-w 제거 — 좌우 padding 으로 폭 제어.
UPDATE ui_metadata
SET css_class = 'flex flex-col w-full kride-intro1-buttons'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_buttons';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
--   1. Redis 캐시 flush (production: docker exec sdui-redis redis-cli FLUSHDB)
--   2. curl http://localhost:8080/api/ui/KRIDE_INTRO1
--      → intro1_root.cssClass = 'min-h-screen bg-black flex flex-col kride-intro1-root'
--   3. 프론트엔드 /view/KRIDE_INTRO1 진입 → 360×640 기기 에뮬레이션으로 확인
--      ✓ K-RIDE 히어로 슬롯이 화면 폭에 맞춰 16:10 비율 유지
--      ✓ 한글 타이틀 "어떤 여행을 떠나실 건가요?" 한 줄 또는 자연스러운 두 줄 (어절 단위 줄바꿈)
--      ✓ 버튼 3개가 하단에 고정, 홈 인디케이터와 겹치지 않음
-- ─────────────────────────────────────────────────────────────────────────────
