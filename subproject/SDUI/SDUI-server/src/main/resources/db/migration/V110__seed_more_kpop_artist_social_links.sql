-- Add more SNS coverage for later K-POP catalog pages where public profiles are
-- available. Unknown/uncurated links remain NULL intentionally.

UPDATE artist
SET instagram_url = 'https://www.instagram.com/xxxibgdrgn/',
    updated_at = NOW()
WHERE lower(slug) = 'g-dragon';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/yerin_the_genuine/',
    updated_at = NOW()
WHERE lower(slug) = '백예린';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/youngji_02/',
    youtube_url = 'https://www.youtube.com/@youngji_boxmedia',
    updated_at = NOW()
WHERE lower(slug) = '이영지';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/eunwo.o_c/',
    updated_at = NOW()
WHERE lower(slug) = '차은우';

UPDATE artist
SET youtube_url = 'https://www.youtube.com/@sungsikyung',
    updated_at = NOW()
WHERE lower(slug) = '성시경';