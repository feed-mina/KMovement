-- Extend later-page social coverage using only high-confidence official/public
-- channel URLs. Ambiguous or unverified accounts remain NULL.

UPDATE artist
SET instagram_url = 'https://www.instagram.com/official_bol4/',
    youtube_url = 'https://www.youtube.com/@official_bol4',
    updated_at = NOW()
WHERE lower(slug) = '볼빨간사춘기';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@psickuniv',
    updated_at = NOW()
WHERE lower(slug) = '피식대학';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@shortbox',
    updated_at = NOW()
WHERE lower(slug) = '숏박스';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@workman',
    updated_at = NOW()
WHERE lower(slug) = '워크맨';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@dingomusic',
    updated_at = NOW()
WHERE lower(slug) = '딩고뮤직';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@tzuyang',
    updated_at = NOW()
WHERE lower(slug) = '쯔양';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@PaniBottle',
    updated_at = NOW()
WHERE lower(slug) = '빠니보틀';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@gamst',
    updated_at = NOW()
WHERE lower(slug) = '감스트';