CREATE TABLE IF NOT EXISTS b2b_partner (
    partner_id BIGSERIAL PRIMARY KEY,
    owner_user_sqno BIGINT NOT NULL REFERENCES users(user_sqno),
    partner_name VARCHAR(120) NOT NULL,
    partner_type VARCHAR(20) NOT NULL DEFAULT 'BUSINESS',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner_user_sqno)
);

CREATE TABLE IF NOT EXISTS b2b_exposure_slot (
    slot_id BIGSERIAL PRIMARY KEY,
    partner_id BIGINT NOT NULL REFERENCES b2b_partner(partner_id),
    poi_sqno BIGINT REFERENCES tour_poi(poi_sqno),
    slot_key VARCHAR(80) NOT NULL,
    title VARCHAR(120) NOT NULL,
    destination_url VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    approved_by BIGINT REFERENCES users(user_sqno),
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_b2b_slot_status CHECK (status IN ('PENDING', 'ACTIVE', 'PAUSED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_b2b_slot_partner_status ON b2b_exposure_slot(partner_id, status);

CREATE TABLE IF NOT EXISTS b2b_slot_event (
    event_id BIGSERIAL PRIMARY KEY,
    slot_id BIGINT NOT NULL REFERENCES b2b_exposure_slot(slot_id),
    event_type VARCHAR(20) NOT NULL,
    session_key VARCHAR(100),
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_b2b_event_type CHECK (event_type IN ('IMPRESSION', 'CLICK', 'CONVERSION'))
);

CREATE INDEX IF NOT EXISTS idx_b2b_event_slot_time ON b2b_slot_event(slot_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_b2b_event_type_time ON b2b_slot_event(event_type, occurred_at);

COMMENT ON TABLE b2b_exposure_slot IS 'Dev-5 manual-approval pilot exposure slots; billing stays outside the product until pricing is validated.';
