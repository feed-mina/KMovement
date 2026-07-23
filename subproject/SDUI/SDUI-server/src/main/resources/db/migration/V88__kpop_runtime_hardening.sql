-- KPOP runtime hardening: durable request fingerprints, typed query allowlists,
-- and catalog cache invalidation notifications.

ALTER TABLE celery_jobs
    ADD COLUMN IF NOT EXISTS request_fingerprint VARCHAR(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_celery_jobs_request_fingerprint'
    ) THEN
        ALTER TABLE celery_jobs
            ADD CONSTRAINT chk_celery_jobs_request_fingerprint
            CHECK (request_fingerprint IS NULL OR request_fingerprint ~ '^[0-9a-f]{64}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_celery_jobs_kpop_rate_window
    ON celery_jobs(requested_by, task_type, created_at)
    WHERE requested_by IS NOT NULL AND task_type = 'KPOP_OUTFIT_ANALYSIS';

UPDATE query_master
SET required_params = '[]'
WHERE required_params IS NULL OR BTRIM(required_params) = '';

-- Identity values are never client allowlist entries. Remove legacy reserved
-- names only from syntactically valid arrays; malformed metadata is preserved
-- so the runtime policy can fail closed instead of silently repairing it.
DO $$
DECLARE
    query_row RECORD;
    parsed JSONB;
    sanitized JSONB;
BEGIN
    FOR query_row IN
        SELECT sql_key, required_params
        FROM query_master
        WHERE required_params IS NOT NULL
    LOOP
        BEGIN
            parsed := query_row.required_params::jsonb;
            IF jsonb_typeof(parsed) = 'array' THEN
                SELECT COALESCE(jsonb_agg(item.value), '[]'::jsonb)
                INTO sanitized
                FROM jsonb_array_elements(parsed) AS item(value)
                WHERE item.value <> '"userSqno"'::jsonb
                  AND item.value <> '"userId"'::jsonb;

                IF sanitized IS DISTINCT FROM parsed THEN
                    UPDATE query_master
                    SET required_params = sanitized::text,
                        updated_at = NOW()
                    WHERE sql_key = query_row.sql_key;
                END IF;
            END IF;
        EXCEPTION WHEN invalid_text_representation THEN
            NULL;
        END;
    END LOOP;
END $$;

UPDATE query_master
SET param_mapping = param_mapping - 'userSqno' - 'userId',
    updated_at = NOW()
WHERE jsonb_typeof(param_mapping) = 'object'
  AND (param_mapping ? 'userSqno' OR param_mapping ? 'userId');

-- Generate a conservative typed allowlist for legacy query definitions that
-- predate param_mapping. Reserved identity fields remain server-only.
WITH sanitized AS (
    SELECT q.*,
           regexp_replace(
               regexp_replace(
                   regexp_replace(q.query_text, '''(?:''''|[^''])*''', ' ', 'g'),
                   '/\*([^*]|\*+[^*/])*\*+/',
                   ' ',
                   'g'
               ),
               '--[^\r\n]*',
               ' ',
               'g'
           ) AS query_without_literals_or_comments
    FROM query_master q
), extracted AS (
    SELECT DISTINCT
           q.sql_key,
           match[2] AS param_name
    FROM sanitized q
    CROSS JOIN LATERAL regexp_matches(
        q.query_without_literals_or_comments,
        '(^|[^:]):([A-Za-z][A-Za-z0-9_]*)',
        'g'
    ) AS match
    WHERE match[2] NOT IN ('userSqno', 'userId')
), generated AS (
    SELECT sql_key,
           jsonb_object_agg(
               param_name,
               jsonb_build_object(
                   'source', 'params.' || param_name,
                   'type', CASE
                       WHEN param_name IN ('contentId', 'content_id', 'lastUpdtUspsSqno') THEN 'long'
                       WHEN param_name IN ('pageSize', 'offset', 'emotion') THEN 'integer'
                       WHEN param_name = 'is_private' THEN 'boolean'
                       WHEN param_name IN ('selected_times', 'daily_slots') THEN 'json'
                       WHEN param_name = 'contentIdList' THEN 'long_list'
                       WHEN param_name = 'recordedTime' THEN 'datetime'
                       ELSE 'string'
                   END,
                   'required', false
               )
           ) AS mapping
    FROM extracted
    GROUP BY sql_key
)
UPDATE query_master q
SET param_mapping = generated.mapping,
    updated_at = NOW()
FROM generated
WHERE q.sql_key = generated.sql_key
  AND (q.param_mapping IS NULL OR q.param_mapping = '{}'::jsonb);

UPDATE query_master
SET required_params = '[]',
    param_mapping = '{"region":{"source":"params.region","type":"string","required":false}}'::jsonb,
    updated_at = NOW()
WHERE sql_key = 'kpop_event_cards';

UPDATE query_master
SET required_params = '[]',
    param_mapping = '{}'::jsonb,
    updated_at = NOW()
WHERE sql_key = 'kpop_artist_cards';

CREATE OR REPLACE FUNCTION notify_kpop_catalog_cache_eviction()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM pg_notify(
        'cache_eviction_channel',
        json_build_object('table', 'kpop_catalog', 'key', TG_TABLE_NAME)::text
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_artist_kpop_cache_evict ON artist;
CREATE TRIGGER trg_artist_kpop_cache_evict
AFTER INSERT OR UPDATE OR DELETE ON artist
FOR EACH STATEMENT EXECUTE FUNCTION notify_kpop_catalog_cache_eviction();

DROP TRIGGER IF EXISTS trg_event_kpop_cache_evict ON event;
CREATE TRIGGER trg_event_kpop_cache_evict
AFTER INSERT OR UPDATE OR DELETE ON event
FOR EACH STATEMENT EXECUTE FUNCTION notify_kpop_catalog_cache_eviction();

DROP TRIGGER IF EXISTS trg_product_candidate_kpop_cache_evict ON product_candidate;
CREATE TRIGGER trg_product_candidate_kpop_cache_evict
AFTER INSERT OR UPDATE OR DELETE ON product_candidate
FOR EACH STATEMENT EXECUTE FUNCTION notify_kpop_catalog_cache_eviction();

DROP TRIGGER IF EXISTS trg_kpop_analysis_candidate_cache_evict ON kpop_analysis_candidate;
CREATE TRIGGER trg_kpop_analysis_candidate_cache_evict
AFTER INSERT OR UPDATE OR DELETE ON kpop_analysis_candidate
FOR EACH STATEMENT EXECUTE FUNCTION notify_kpop_catalog_cache_eviction();
