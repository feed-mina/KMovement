UPDATE ui_metadata
SET action_url = REPLACE(
    action_url,
    'redirect_uri=https://yerin.duckdns.org/api/kakao/callback',
    'redirect_uri=https://yerin.duckdns.org/api/kakao/callback'
)
WHERE action_url LIKE '%kauth.kakao.com%'
  AND action_url LIKE '%redirect_uri=%';
