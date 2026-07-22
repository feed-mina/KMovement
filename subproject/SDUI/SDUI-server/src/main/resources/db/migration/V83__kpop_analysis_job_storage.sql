-- K-POP image analysis jobs keep only a short-lived, user-owned S3 object
-- reference. The worker result remains in result_json on celery_jobs.

ALTER TABLE celery_jobs
    ADD COLUMN IF NOT EXISTS source_object_key TEXT,
    ADD COLUMN IF NOT EXISTS source_content_type VARCHAR(80),
    ADD COLUMN IF NOT EXISTS source_deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS consent_scope VARCHAR(120),
    ADD COLUMN IF NOT EXISTS consented_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS uk_celery_jobs_requester_idempotency
    ON celery_jobs (requested_by, idempotency_key)
    WHERE requested_by IS NOT NULL AND idempotency_key IS NOT NULL;
