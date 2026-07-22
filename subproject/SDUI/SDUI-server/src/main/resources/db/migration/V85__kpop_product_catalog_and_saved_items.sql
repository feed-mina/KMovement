-- K-POP product candidates are a curated catalog.  Worker output may refer to
-- catalog rows, but it must never become trusted product metadata by itself.

ALTER TABLE product_candidate
    ADD COLUMN IF NOT EXISTS catalog_source VARCHAR(40) NOT NULL DEFAULT 'MANUAL_CURATED',
    ADD COLUMN IF NOT EXISTS provider_product_ref VARCHAR(180),
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS rights_checked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb;

-- The phase-0 seed copied artist homepages into official_url even though no
-- product-link rights review had happened.  Preserve those URLs as internal
-- evidence only and keep every public link gated by rights_checked.
UPDATE product_candidate
SET source_url = COALESCE(source_url, official_url),
    official_url = NULL,
    rights_checked = FALSE,
    provider_product_ref = COALESCE(
        provider_product_ref,
        CONCAT('manual:', product_candidate_id)
    );

ALTER TABLE product_candidate
    ALTER COLUMN provider_product_ref SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_product_candidate_provider_ref
    ON product_candidate (provider_product_ref)
    WHERE provider_product_ref IS NOT NULL;

ALTER TABLE product_candidate
    ADD CONSTRAINT ck_product_candidate_catalog_source
        CHECK (catalog_source IN ('MANUAL_CURATED')),
    ADD CONSTRAINT ck_product_candidate_confidence_range
        CHECK (confidence >= 0 AND confidence <= 100);

CREATE INDEX IF NOT EXISTS idx_product_candidate_artist_event
    ON product_candidate (artist_id, event_id, approved_yn);

CREATE INDEX IF NOT EXISTS idx_saved_item_user_sqno
    ON saved_item (user_sqno);

-- Production may contain phase-0 orphan rows.  NOT VALID protects the deploy
-- while enforcing the FK for every new or updated saved item.
ALTER TABLE saved_item
    ADD CONSTRAINT fk_saved_item_user
        FOREIGN KEY (user_sqno) REFERENCES users(user_sqno) NOT VALID;

CREATE TABLE IF NOT EXISTS kpop_analysis_candidate (
    kpop_analysis_candidate_id BIGSERIAL PRIMARY KEY,
    analysis_job_id BIGINT NOT NULL REFERENCES celery_jobs(id) ON DELETE CASCADE,
    product_candidate_id BIGINT NOT NULL REFERENCES product_candidate(product_candidate_id),
    rank INTEGER NOT NULL,
    evidence_grade VARCHAR(40) NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE',
    confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
    evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_kpop_analysis_candidate_rank CHECK (rank > 0),
    CONSTRAINT ck_kpop_analysis_candidate_grade CHECK (
        evidence_grade IN ('EXACT_CANDIDATE', 'SIMILAR', 'INSUFFICIENT_EVIDENCE')
    ),
    CONSTRAINT ck_kpop_analysis_candidate_confidence CHECK (
        confidence >= 0 AND confidence <= 100
    ),
    CONSTRAINT uk_kpop_analysis_candidate_ref UNIQUE (
        analysis_job_id, product_candidate_id
    ),
    CONSTRAINT uk_kpop_analysis_candidate_rank UNIQUE (
        analysis_job_id, rank
    )
);

CREATE INDEX IF NOT EXISTS idx_kpop_analysis_candidate_job
    ON kpop_analysis_candidate (analysis_job_id, rank);
