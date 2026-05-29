-- =============================================
-- V55: 커뮤니티 애니메이션 Job 추적 테이블
-- =============================================

CREATE TABLE IF NOT EXISTS community_animation_jobs (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_post(post_id) ON DELETE CASCADE,
    runpod_job_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'QUEUED',
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animation_jobs_post ON community_animation_jobs(post_id);
CREATE INDEX IF NOT EXISTS idx_animation_jobs_status ON community_animation_jobs(status);
