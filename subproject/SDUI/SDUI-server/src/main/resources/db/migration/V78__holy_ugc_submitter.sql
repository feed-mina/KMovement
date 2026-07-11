ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS submitted_by BIGINT REFERENCES users(user_sqno);
CREATE INDEX IF NOT EXISTS idx_tour_poi_holy_submitter ON tour_poi(submitted_by) WHERE source = 'UGC';
CREATE UNIQUE INDEX IF NOT EXISTS uq_tour_poi_pending_source_url
    ON tour_poi(source_url) WHERE review_status = 'PENDING' AND source_url IS NOT NULL;

COMMENT ON COLUMN tour_poi.submitted_by IS 'UGC submitter retained for moderation audit; never exposed through the public holy POI DTO.';
