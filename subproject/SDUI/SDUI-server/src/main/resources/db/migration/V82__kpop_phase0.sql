-- K-POP Phase 0: artist/event base, async analysis shell, saved items,
-- moderation audit, query allowlists, and SDUI seed screens.

ALTER TABLE query_master
    ADD COLUMN IF NOT EXISTS required_params TEXT;

-- `celery_jobs` was historically created by Hibernate ddl-auto rather than a
-- Flyway migration. Flyway runs first on a clean database, so define the table
-- here before the K-POP job shell alters or inserts into it.
CREATE TABLE IF NOT EXISTS celery_jobs (
    id BIGSERIAL PRIMARY KEY,
    celery_task_id VARCHAR(100) UNIQUE,
    task_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) DEFAULT 'QUEUED',
    result_json TEXT,
    error_message TEXT,
    progress_step VARCHAR(50),
    progress_pct INTEGER,
    requested_by BIGINT,
    notif_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artist (
    artist_id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(120) UNIQUE NOT NULL,
    name_ko VARCHAR(120) NOT NULL,
    name_en VARCHAR(120) NOT NULL,
    profile TEXT,
    image_url TEXT,
    official_url TEXT,
    approved_yn CHAR(1) NOT NULL DEFAULT 'Y',
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event (
    event_id BIGSERIAL PRIMARY KEY,
    artist_id BIGINT NOT NULL REFERENCES artist(artist_id),
    title_ko VARCHAR(200) NOT NULL,
    title_en VARCHAR(200) NOT NULL,
    region VARCHAR(80) NOT NULL,
    venue VARCHAR(200),
    event_date DATE NOT NULL,
    description TEXT,
    official_url TEXT,
    approved_yn CHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artist_follow (
    artist_follow_id BIGSERIAL PRIMARY KEY,
    user_sqno BIGINT NOT NULL,
    artist_id BIGINT NOT NULL REFERENCES artist(artist_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_artist_follow_user_artist UNIQUE (user_sqno, artist_id)
);

CREATE TABLE IF NOT EXISTS event_bookmark (
    event_bookmark_id BIGSERIAL PRIMARY KEY,
    user_sqno BIGINT NOT NULL,
    event_id BIGINT NOT NULL REFERENCES event(event_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_event_bookmark_user_event UNIQUE (user_sqno, event_id)
);

CREATE TABLE IF NOT EXISTS product_candidate (
    product_candidate_id BIGSERIAL PRIMARY KEY,
    artist_id BIGINT REFERENCES artist(artist_id),
    event_id BIGINT REFERENCES event(event_id),
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(120),
    evidence_grade VARCHAR(40) NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE',
    confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
    evidence_text TEXT,
    official_url TEXT,
    approved_yn CHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_product_candidate_grade CHECK (evidence_grade IN ('EXACT_CANDIDATE','SIMILAR','INSUFFICIENT_EVIDENCE'))
);

CREATE TABLE IF NOT EXISTS saved_item (
    saved_item_id BIGSERIAL PRIMARY KEY,
    user_sqno BIGINT NOT NULL,
    item_type VARCHAR(40) NOT NULL,
    item_ref BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_saved_item_user_type_ref UNIQUE (user_sqno, item_type, item_ref),
    CONSTRAINT ck_saved_item_type CHECK (item_type IN ('ARTIST','EVENT','PRODUCT_CANDIDATE'))
);

CREATE TABLE IF NOT EXISTS kpop_moderation_audit (
    audit_id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(50) NOT NULL,
    target_id BIGINT NOT NULL,
    from_status VARCHAR(40),
    to_status VARCHAR(40) NOT NULL,
    actor_user_sqno BIGINT,
    reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE celery_jobs
    ALTER COLUMN status TYPE VARCHAR(30);

INSERT INTO artist (slug, name_ko, name_en, profile, image_url, official_url, sort_order)
VALUES
('bts', 'BTS', 'BTS', 'Global K-POP artist with Seoul travel demand.', NULL, 'https://ibighit.com/bts', 1),
('blackpink', 'BLACKPINK', 'BLACKPINK', 'K-POP artist connected to pop-up, fashion, and concert routes.', NULL, 'https://www.ygfamily.com', 2),
('seventeen', 'SEVENTEEN', 'SEVENTEEN', 'Performance-focused K-POP artist for event-led routes.', NULL, 'https://www.pledis.co.kr', 3),
('ive', 'IVE', 'IVE', 'Trend-forward K-POP artist for fan travel discovery.', NULL, 'https://www.starship-ent.com', 4)
ON CONFLICT (slug) DO UPDATE SET
    name_ko = EXCLUDED.name_ko,
    name_en = EXCLUDED.name_en,
    profile = EXCLUDED.profile,
    image_url = EXCLUDED.image_url,
    official_url = EXCLUDED.official_url,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

INSERT INTO event (artist_id, title_ko, title_en, region, venue, event_date, description, official_url)
SELECT artist_id, 'Seoul fan route sample', 'Seoul fan route sample', 'Seoul', 'Hongdae / Seongsu', DATE '2026-08-15',
       'Seed event for K-POP route and bookmark smoke tests.', official_url
FROM artist
WHERE slug IN ('bts','blackpink','seventeen','ive')
ON CONFLICT DO NOTHING;

INSERT INTO product_candidate (artist_id, name, brand, evidence_grade, confidence, evidence_text, official_url)
SELECT artist_id, 'Official light stick / merch candidate', 'Official store', 'SIMILAR', 72.5,
       'Seed candidate for evidence grading UI. Do not claim exact match without stronger evidence.', official_url
FROM artist
WHERE slug IN ('bts','blackpink')
ON CONFLICT DO NOTHING;

INSERT INTO query_master (sql_key, query_text, return_type, description, required_params, param_mapping, use_redis_yn, redis_ttl_sec, required_role)
VALUES
('kpop_artist_cards',
 'SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn", profile, image_url AS "imageUrl", official_url AS "officialUrl" FROM artist WHERE approved_yn = ''Y'' ORDER BY sort_order ASC, name_ko ASC',
 'MULTI', 'KPOP artist card list', '[]', '{}', 'Y', 300, NULL),
('kpop_event_cards',
 'SELECT e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo", e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue, e.event_date AS date, e.official_url AS "officialUrl" FROM event e JOIN artist a ON a.artist_id = e.artist_id WHERE e.approved_yn = ''Y'' AND (:region IS NULL OR e.region = :region) ORDER BY e.event_date ASC, e.event_id ASC',
 'MULTI', 'KPOP event card list with region allowlist', '["region"]', '{"region":"params.region"}', 'Y', 180, NULL)
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

DELETE FROM ui_metadata WHERE screen_id IN ('KPOP_EXPLORE','KPOP_ARTIST_DETAIL','KPOP_EVENTS','KPOP_EVENT_DETAIL');

INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, ref_data_id, parent_group_id, group_direction, css_class, action_type, action_url, data_sql_key, is_readonly, is_visible, component_props)
VALUES
('KPOP_EXPLORE','kpop_root','GROUP','',1,NULL,NULL,'COLUMN','kpop-screen',NULL,NULL,NULL,true,'true','{}'),
('KPOP_EXPLORE','kpop_title','TEXT','K-POP fan travel',2,NULL,'kpop_root',NULL,'kpop-title',NULL,NULL,NULL,true,'true','{}'),
('KPOP_EXPLORE','kpop_subtitle','TEXT','Pick an artist, follow events, and save reliable candidates.',3,NULL,'kpop_root',NULL,'kpop-subtitle',NULL,NULL,NULL,true,'true','{}'),
('KPOP_EXPLORE','kpop_artist_grid','GROUP','',4,'artists','kpop_root','ROW','kpop-grid',NULL,NULL,'kpop_artist_cards',true,'true','{}'),
('KPOP_EXPLORE','kpop_artist_card','ARTIST_CARD','',5,NULL,'kpop_artist_grid',NULL,'', 'ROUTE', '/kpop/artists', NULL, false,'true','{}'),
('KPOP_EXPLORE','kpop_events_cta','BUTTON','View events',6,NULL,'kpop_root',NULL,'kpop-primary-btn','ROUTE','/kpop/events',NULL,false,'true','{}'),

('KPOP_EVENTS','kpop_events_root','GROUP','',1,NULL,NULL,'COLUMN','kpop-screen',NULL,NULL,NULL,true,'true','{}'),
('KPOP_EVENTS','kpop_events_title','TEXT','K-POP events',2,NULL,'kpop_events_root',NULL,'kpop-title',NULL,NULL,NULL,true,'true','{}'),
('KPOP_EVENTS','kpop_events_grid','GROUP','',3,'events','kpop_events_root','COLUMN','kpop-list',NULL,NULL,'kpop_event_cards',true,'true','{}'),
('KPOP_EVENTS','kpop_event_card','EVENT_CARD','',4,NULL,'kpop_events_grid',NULL,'','ROUTE','/kpop/event',NULL,false,'true','{}'),

('KPOP_ARTIST_DETAIL','kpop_artist_detail_root','GROUP','',1,NULL,NULL,'COLUMN','kpop-screen',NULL,NULL,NULL,true,'true','{}'),
('KPOP_ARTIST_DETAIL','kpop_artist_detail','ARTIST_CARD','Artist detail',2,'artist','kpop_artist_detail_root',NULL,'kpop-detail-card',NULL,NULL,NULL,true,'true','{}'),

('KPOP_EVENT_DETAIL','kpop_event_detail_root','GROUP','',1,NULL,NULL,'COLUMN','kpop-screen',NULL,NULL,NULL,true,'true','{}'),
('KPOP_EVENT_DETAIL','kpop_event_detail','EVENT_CARD','Event detail',2,'event','kpop_event_detail_root',NULL,'kpop-detail-card',NULL,NULL,NULL,true,'true','{}');
