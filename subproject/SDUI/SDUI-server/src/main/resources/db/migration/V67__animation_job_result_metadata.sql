ALTER TABLE community_animation_jobs
    ADD COLUMN IF NOT EXISTS actual_model VARCHAR(100);

ALTER TABLE community_animation_jobs
    ADD COLUMN IF NOT EXISTS failed_image_indexes TEXT;

CREATE INDEX IF NOT EXISTS idx_animation_jobs_created_at
    ON community_animation_jobs (created_at);
