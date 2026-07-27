-- K-POP 진입부터 상세 화면까지 metadata-project 내부 SDUI 라우터로 통합한다.

UPDATE ui_metadata
SET action_type = 'ROUTE',
    action_url = '/view/KPOP_EXPLORE'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id IN ('main_bento_kpop_btn', 'main_bento_kpop_btn_g');

UPDATE ui_metadata
SET action_type = 'ROUTE',
    action_url = '/view/KPOP_EVENTS'
WHERE screen_id = 'KPOP_EXPLORE'
  AND component_id = 'kpop_events_cta';

-- 기본 이벤트 목록은 별도 필터 없이 전체 검수 완료 일정을 반환한다.
UPDATE query_master
SET query_text = 'SELECT e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo", e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue, e.event_date AS date, e.official_url AS "officialUrl" FROM event e JOIN artist a ON a.artist_id = e.artist_id WHERE e.approved_yn = ''Y'' ORDER BY e.event_date ASC, e.event_id ASC',
    required_params = '[]',
    param_mapping = '{}',
    updated_at = NOW()
WHERE sql_key = 'kpop_event_cards';

INSERT INTO query_master
    (sql_key, query_text, return_type, description, required_params,
     param_mapping, use_redis_yn, redis_ttl_sec, required_role)
VALUES
    ('kpop_artist_detail',
     'SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn", profile, image_url AS "imageUrl", official_url AS "officialUrl" FROM artist WHERE approved_yn = ''Y'' AND artist_id = :contentId',
     'MULTI', 'KPOP artist detail', '["contentId"]',
     '{"contentId":"params.contentId"}', 'Y', 300, NULL),
    ('kpop_event_detail',
     'SELECT e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo", e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue, e.event_date AS date, e.description, e.official_url AS "officialUrl" FROM event e JOIN artist a ON a.artist_id = e.artist_id WHERE e.approved_yn = ''Y'' AND e.event_id = :contentId',
     'MULTI', 'KPOP event detail', '["contentId"]',
     '{"contentId":"params.contentId"}', 'Y', 180, NULL)
ON CONFLICT (sql_key) DO UPDATE SET
    query_text = EXCLUDED.query_text,
    return_type = EXCLUDED.return_type,
    description = EXCLUDED.description,
    required_params = EXCLUDED.required_params,
    param_mapping = EXCLUDED.param_mapping,
    use_redis_yn = EXCLUDED.use_redis_yn,
    redis_ttl_sec = EXCLUDED.redis_ttl_sec,
    required_role = EXCLUDED.required_role,
    updated_at = NOW();

UPDATE ui_metadata
SET ref_data_id = 'artist',
    data_sql_key = 'kpop_artist_detail'
WHERE screen_id = 'KPOP_ARTIST_DETAIL'
  AND component_id = 'kpop_artist_detail_root';

UPDATE ui_metadata
SET ref_data_id = 'event',
    data_sql_key = 'kpop_event_detail'
WHERE screen_id = 'KPOP_EVENT_DETAIL'
  AND component_id = 'kpop_event_detail_root';