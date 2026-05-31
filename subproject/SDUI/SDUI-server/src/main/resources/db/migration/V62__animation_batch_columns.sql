-- Add batch video support columns to community_animation_jobs
ALTER TABLE community_animation_jobs ADD COLUMN IF NOT EXISTS total_images INTEGER;
ALTER TABLE community_animation_jobs ADD COLUMN IF NOT EXISTS processed_images INTEGER DEFAULT 0;
ALTER TABLE community_animation_jobs ADD COLUMN IF NOT EXISTS route VARCHAR(50);
