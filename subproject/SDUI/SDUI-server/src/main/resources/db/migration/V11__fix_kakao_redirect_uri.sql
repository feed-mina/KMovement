-- V11: 카카오 로그인 버튼 action_url의 redirect_uri를 Vercel 프록시 URL로 변경
-- 기존: /api/kakao/callback 이 백엔드 직접 URL → 쿠키가 백엔드 도메인에 설정되어 Vercel에서 읽지 못함
-- 변경: Next.js 프록시 경유 URL → 쿠키가 yerin.duckdns.org 도메인에 설정됨

UPDATE ui_metadata
SET action_url = REGEXP_REPLACE(
    action_url,
    'redirect_uri=[^&]+',
    'redirect_uri=https://yerin.duckdns.org/api/kakao/callback'
)
WHERE action_url LIKE '%kauth.kakao.com%'
  AND action_url LIKE '%redirect_uri=%';

DO $$ BEGIN RAISE NOTICE 'V11: 카카오 redirect_uri → Vercel 프록시 URL로 변경 완료'; END $$;
