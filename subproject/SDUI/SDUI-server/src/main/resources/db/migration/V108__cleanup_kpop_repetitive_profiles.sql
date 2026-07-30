-- Replace repetitive English fallback profile copy with concise Korean copy.

UPDATE artist
SET profile = '퍼포먼스 중심 무대와 팬 이동 동선을 함께 볼 수 있는 아티스트입니다.',
    updated_at = NOW()
WHERE profile = 'Performance-focused K-POP artist for event-led routes.';

UPDATE artist
SET profile = '트렌드 기반 팬 여행 탐색에 적합한 아티스트입니다.',
    updated_at = NOW()
WHERE profile = 'Trend-forward K-POP artist for fan travel discovery.';