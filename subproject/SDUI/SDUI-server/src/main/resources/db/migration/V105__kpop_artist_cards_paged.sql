-- K-POP explore lists should page artists 8 at a time while exposing the
-- total count for the SDUI pagination controls.

UPDATE query_master
SET query_text = 'SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn", profile, image_url AS "imageUrl", official_url AS "officialUrl", COUNT(*) OVER() AS total_count FROM artist WHERE approved_yn = ''Y'' ORDER BY sort_order ASC, name_ko ASC LIMIT :pageSize OFFSET :offset',
    required_params = '["pageSize","offset"]',
    param_mapping = '{"pageSize":"integer","offset":"integer"}',
    updated_at = NOW()
WHERE sql_key = 'kpop_artist_cards';