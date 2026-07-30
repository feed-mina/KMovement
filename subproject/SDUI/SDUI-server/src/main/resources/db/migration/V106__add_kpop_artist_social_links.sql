-- K-POP 아티스트의 공식 홈페이지와 SNS 링크를 분리 저장한다.

ALTER TABLE artist
    ADD COLUMN IF NOT EXISTS instagram_url TEXT,
    ADD COLUMN IF NOT EXISTS youtube_url TEXT,
    ADD COLUMN IF NOT EXISTS x_url TEXT;

UPDATE artist
SET instagram_url = 'https://www.instagram.com/bts.bighitofficial/',
    youtube_url = 'https://www.youtube.com/@BTS',
    x_url = 'https://x.com/BTS_twt',
    updated_at = NOW()
WHERE slug = 'bts';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/blackpinkofficial/',
    youtube_url = 'https://www.youtube.com/@BLACKPINK',
    x_url = 'https://x.com/BLACKPINK',
    updated_at = NOW()
WHERE slug = 'blackpink';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/pledis_17/',
    youtube_url = 'https://www.youtube.com/@SEVENTEEN',
    x_url = 'https://x.com/pledis_17',
    updated_at = NOW()
WHERE slug = 'seventeen';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/ivestarship/',
    youtube_url = 'https://www.youtube.com/@IVE',
    x_url = 'https://x.com/IVEstarship',
    updated_at = NOW()
WHERE slug = 'ive';