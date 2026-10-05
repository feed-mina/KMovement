ALTER TABLE tour_poi ADD COLUMN IF NOT EXISTS review_reason varchar(500);

CREATE TABLE holy_review_audit (
    audit_id bigserial PRIMARY KEY,
    poi_sqno bigint NOT NULL REFERENCES tour_poi(poi_sqno),
    previous_status varchar(12) NOT NULL,
    next_status varchar(12) NOT NULL,
    reviewer varchar(60) NOT NULL,
    reason varchar(500),
    reviewed_at timestamp NOT NULL
);
CREATE INDEX idx_holy_review_audit_poi ON holy_review_audit(poi_sqno,audit_id);

-- Preserve historical rows. Stop migration if active duplicate UGC needs review;
-- never silently delete or change approval on existing submissions.
CREATE UNIQUE INDEX uq_holy_ugc_active_source
    ON tour_poi (btrim(source_url))
    WHERE source='UGC' AND review_status IN ('PENDING','APPROVED');
