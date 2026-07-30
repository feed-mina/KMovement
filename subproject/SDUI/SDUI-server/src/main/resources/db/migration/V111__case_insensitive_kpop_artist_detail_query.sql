-- Keep artist detail lookup tolerant to route slug casing in SDUI execute flows.

UPDATE query_master
SET query_text = 'SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn", profile, image_url AS "imageUrl", official_url AS "officialUrl", instagram_url AS "instagramUrl", youtube_url AS "youtubeUrl", x_url AS "xUrl" FROM artist WHERE approved_yn = ''Y'' AND (LOWER(slug) = LOWER(:contentId) OR CASE WHEN :contentId ~ ''^[0-9]+$'' THEN artist_id = CAST(:contentId AS BIGINT) ELSE FALSE END)',
    updated_at = NOW()
WHERE sql_key = 'kpop_artist_detail';