-- Extend SNS examples beyond the initial four artists.
-- NOTE: Verified accounts should be curated continuously by operations.

UPDATE artist
SET instagram_url = 'https://www.instagram.com/aespa_official/',
    youtube_url = 'https://www.youtube.com/@aespa',
    x_url = 'https://x.com/aespa_official',
    updated_at = NOW()
WHERE lower(slug) = 'aespa';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/newjeans_official/',
    youtube_url = 'https://www.youtube.com/@NewJeans_official',
    x_url = 'https://x.com/NewJeans_ADOR',
    updated_at = NOW()
WHERE lower(slug) = 'newjeans';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/twicetagram/',
    youtube_url = 'https://www.youtube.com/@TWICE',
    x_url = 'https://x.com/JYPETWICE',
    updated_at = NOW()
WHERE lower(slug) = 'twice';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/realstraykids/',
    youtube_url = 'https://www.youtube.com/@StrayKids',
    x_url = 'https://x.com/Stray_Kids',
    updated_at = NOW()
WHERE lower(slug) = 'stray kids';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/weareone.exo/',
    youtube_url = 'https://www.youtube.com/@EXO',
    x_url = 'https://x.com/weareoneEXO',
    updated_at = NOW()
WHERE lower(slug) = 'exo';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/nct/',
    youtube_url = 'https://www.youtube.com/@NCT',
    x_url = 'https://x.com/NCTsmtown',
    updated_at = NOW()
WHERE lower(slug) = 'nct';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/ateez_official_/',
    youtube_url = 'https://www.youtube.com/@ATEEZofficial',
    x_url = 'https://x.com/ATEEZofficial',
    updated_at = NOW()
WHERE lower(slug) = 'ateez';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/le_sserafim/',
    youtube_url = 'https://www.youtube.com/@LESSERAFIM_official',
    x_url = 'https://x.com/le_sserafim',
    updated_at = NOW()
WHERE lower(slug) = 'le sserafim';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/rv.smtown/',
    youtube_url = 'https://www.youtube.com/@RedVelvet',
    x_url = 'https://x.com/RVsmtown',
    updated_at = NOW()
WHERE lower(slug) = 'red velvet';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/itzy.all.in.us/',
    youtube_url = 'https://www.youtube.com/@ITZY',
    x_url = 'https://x.com/ITZYofficial',
    updated_at = NOW()
WHERE lower(slug) = 'itzy';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/txt_bighit/',
    youtube_url = 'https://www.youtube.com/@TXT_official',
    x_url = 'https://x.com/TXT_bighit',
    updated_at = NOW()
WHERE lower(slug) = 'tomorrow x together';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/enhypen/',
    youtube_url = 'https://www.youtube.com/@ENHYPENOFFICIAL',
    x_url = 'https://x.com/ENHYPEN',
    updated_at = NOW()
WHERE lower(slug) = 'enhypen';

UPDATE artist
SET instagram_url = 'https://www.instagram.com/day6kilogram/',
    youtube_url = 'https://www.youtube.com/@DAY6Official',
    x_url = 'https://x.com/day6official',
    updated_at = NOW()
WHERE lower(slug) = 'day6';