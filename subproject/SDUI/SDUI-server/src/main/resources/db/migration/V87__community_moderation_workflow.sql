-- Community moderation workflow, report triage, comments, and immutable audit history.
-- Existing published posts remain visible; posts created after this migration start PENDING.

ALTER TABLE community_post
    ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS moderated_by BIGINT REFERENCES users(user_sqno),
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS moderation_note VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS moderation_due_at TIMESTAMP;

UPDATE community_post
SET moderation_status = 'APPROVED',
    moderated_at = COALESCE(moderated_at, created_at)
WHERE moderation_status IS NULL;

ALTER TABLE community_post
    ALTER COLUMN moderation_status SET DEFAULT 'PENDING',
    ALTER COLUMN moderation_status SET NOT NULL;

UPDATE community_post
SET moderation_due_at = COALESCE(moderation_due_at, created_at + INTERVAL '24 hours')
WHERE moderation_due_at IS NULL;

ALTER TABLE community_post
    ALTER COLUMN moderation_due_at SET DEFAULT (NOW() + INTERVAL '24 hours'),
    ALTER COLUMN moderation_due_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_community_post_moderation_status'
    ) THEN
        ALTER TABLE community_post
            ADD CONSTRAINT chk_community_post_moderation_status
            CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS post_comment (
    comment_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_post(post_id) ON DELETE CASCADE,
    author_sqno BIGINT NOT NULL REFERENCES users(user_sqno),
    content VARCHAR(2000) NOT NULL,
    moderation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    moderated_by BIGINT REFERENCES users(user_sqno),
    moderated_at TIMESTAMP,
    moderation_note VARCHAR(1000),
    moderation_due_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    del_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_post_comment_moderation_status
        CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_post_comment_del_yn CHECK (del_yn IN ('Y', 'N'))
);

ALTER TABLE post_report
    ALTER COLUMN detail_text TYPE VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS assigned_admin_sqno BIGINT REFERENCES users(user_sqno),
    ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS resolution_note VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

UPDATE post_report
SET status = COALESCE(status, 'OPEN'),
    review_due_at = COALESCE(review_due_at, created_at + INTERVAL '24 hours'),
    updated_at = COALESCE(updated_at, created_at)
WHERE status IS NULL OR review_due_at IS NULL OR updated_at IS NULL;

ALTER TABLE post_report
    ALTER COLUMN status SET DEFAULT 'OPEN',
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN review_due_at SET DEFAULT (NOW() + INTERVAL '24 hours'),
    ALTER COLUMN review_due_at SET NOT NULL,
    ALTER COLUMN updated_at SET DEFAULT NOW(),
    ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_post_report_status'
    ) THEN
        ALTER TABLE post_report
            ADD CONSTRAINT chk_post_report_status
            CHECK (status IN ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_post_moderation_queue
    ON community_post(moderation_status, moderation_due_at, post_id);
CREATE INDEX IF NOT EXISTS idx_post_comment_post_status
    ON post_comment(post_id, moderation_status, created_at, comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comment_moderation_queue
    ON post_comment(moderation_status, moderation_due_at, comment_id);
CREATE INDEX IF NOT EXISTS idx_post_report_moderation_queue
    ON post_report(status, review_due_at, post_report_id);
CREATE INDEX IF NOT EXISTS idx_kpop_moderation_audit_target_created
    ON kpop_moderation_audit(target_type, target_id, created_at, audit_id);
