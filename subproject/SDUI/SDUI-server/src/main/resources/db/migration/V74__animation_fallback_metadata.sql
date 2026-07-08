ALTER TABLE community_animation_jobs
    ADD COLUMN IF NOT EXISTS actual_model_executed BOOLEAN;

ALTER TABLE community_animation_jobs
    ADD COLUMN IF NOT EXISTS fallback_type VARCHAR(100);

ALTER TABLE community_animation_jobs
    ADD COLUMN IF NOT EXISTS fallback_reason TEXT;
