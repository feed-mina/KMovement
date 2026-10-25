-- Additive only. Existing artist/content/place IDs and legacy links are preserved.
CREATE TABLE holy_content_artist (
 content_sqno BIGINT NOT NULL REFERENCES holy_content(content_sqno),
 artist_id BIGINT NOT NULL REFERENCES artist(artist_id),
 identity_basis TEXT NOT NULL CHECK (length(trim(identity_basis)) > 0),
 PRIMARY KEY(content_sqno, artist_id)
);
CREATE INDEX idx_hca_artist ON holy_content_artist(artist_id);

CREATE TABLE artist_place_evidence (
 evidence_id BIGSERIAL PRIMARY KEY,
 content_sqno BIGINT NOT NULL,
 artist_id BIGINT NOT NULL,
 poi_sqno BIGINT NOT NULL REFERENCES tour_poi(poi_sqno),
 poi_address_snapshot TEXT NOT NULL,
 poi_lat_snapshot DOUBLE PRECISION NOT NULL,
 poi_lon_snapshot DOUBLE PRECISION NOT NULL,
 action VARCHAR(30) NOT NULL CHECK(action IN ('MV','CONTENT_VISIT','SNS','POPUP','ALBUM_PHOTO','COLLABORATION_EVENT')),
 source_url TEXT NOT NULL CHECK(source_url ~ '^https://[^/]+'),
 artist_evidence TEXT NOT NULL CHECK(length(trim(artist_evidence)) > 0),
 place_evidence TEXT NOT NULL CHECK(length(trim(place_evidence)) > 0),
 action_evidence TEXT NOT NULL CHECK(length(trim(action_evidence)) > 0),
 locator TEXT NOT NULL CHECK(length(trim(locator)) > 0),
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REVOKED')),
 verified_at TIMESTAMPTZ,
 review_by TIMESTAMPTZ,
 reviewer TEXT,
 revoked_by TEXT,
 revoked_at TIMESTAMPTZ,
 FOREIGN KEY(content_sqno,artist_id) REFERENCES holy_content_artist(content_sqno,artist_id),
 FOREIGN KEY(content_sqno,poi_sqno) REFERENCES holy_content_poi(content_sqno,poi_sqno),
 CHECK(status <> 'VERIFIED' OR (verified_at IS NOT NULL AND review_by IS NOT NULL AND reviewer IS NOT NULL AND review_by > verified_at AND length(trim(reviewer)) > 0))
);
CREATE INDEX idx_ape_artist_poi ON artist_place_evidence(artist_id,poi_sqno) WHERE status='VERIFIED';
CREATE INDEX idx_ape_content_poi ON artist_place_evidence(content_sqno,poi_sqno);

CREATE TABLE poi_visit_policy (
 poi_sqno BIGINT PRIMARY KEY REFERENCES tour_poi(poi_sqno),
 poi_address_snapshot TEXT NOT NULL,
 poi_lat_snapshot DOUBLE PRECISION NOT NULL,
 poi_lon_snapshot DOUBLE PRECISION NOT NULL,
 weekly_hours JSONB NOT NULL CHECK(jsonb_typeof(weekly_hours)='object'),
 date_overrides JSONB NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(date_overrides)='object'),
 hours_source_url TEXT NOT NULL CHECK(hours_source_url ~ '^https://[^/]+'),
 cost_krw INTEGER NOT NULL CHECK(cost_krw BETWEEN 0 AND 100000000),
 cost_source_url TEXT NOT NULL CHECK(cost_source_url ~ '^https://[^/]+'),
 cost_evidence TEXT NOT NULL CHECK(length(trim(cost_evidence)) > 0),
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','VERIFIED','REVOKED')),
 verified_at TIMESTAMPTZ,
 review_by TIMESTAMPTZ,
 reviewer TEXT,
 revoked_by TEXT,
 revoked_at TIMESTAMPTZ,
 CHECK(status <> 'VERIFIED' OR (verified_at IS NOT NULL AND review_by IS NOT NULL AND reviewer IS NOT NULL AND review_by > verified_at AND length(trim(reviewer)) > 0))
);
-- A catalog row uses the actual poi_sqno, never an ambiguous source label.
CREATE VIEW verified_visit_catalog AS
SELECT p.poi_sqno,
 jsonb_build_object(
  'id','poi:'||p.poi_sqno, 'name',p.title, 'address',p.addr,
  'lat',p.map_y, 'lon',p.map_x, 'artist','', 'visibility','PUBLIC',
  'sourceUrl',v.hours_source_url, 'verifiedAt',v.verified_at, 'reviewBy',v.review_by,
  'openingHours',jsonb_build_object('status','verified','verifiedAt',v.verified_at,
    'reviewBy',v.review_by,'sourceUrl',v.hours_source_url,'weekly',v.weekly_hours,'dateOverrides',v.date_overrides),
  'cost',jsonb_build_object('status','verified','verifiedAt',v.verified_at,'reviewBy',v.review_by,
    'sourceUrl',v.cost_source_url,'amountKrw',v.cost_krw,'scope','per_person_visit','evidence',v.cost_evidence),
  'artistEvidence',COALESCE((
    SELECT jsonb_agg(jsonb_build_object('artistId',e.artist_id,'contentId',e.content_sqno,'poiId','poi:'||e.poi_sqno,
      'action',e.action,'sourceUrl',e.source_url,'artistEvidence',e.artist_evidence,'placeEvidence',e.place_evidence,
      'actionEvidence',e.action_evidence,'locator',e.locator,'status','verified','verifiedAt',e.verified_at,'reviewBy',e.review_by)
      ORDER BY e.evidence_id)
    FROM artist_place_evidence e JOIN artist a ON a.artist_id=e.artist_id AND a.approved_yn='Y'
    WHERE e.poi_sqno=p.poi_sqno AND e.poi_address_snapshot=p.addr AND e.poi_lat_snapshot=p.map_y AND e.poi_lon_snapshot=p.map_x AND e.status='VERIFIED' AND e.verified_at<=now() AND e.review_by>now()
  ),'[]'::jsonb)
 ) AS payload
FROM tour_poi p JOIN poi_visit_policy v ON v.poi_sqno=p.poi_sqno
WHERE p.source IN ('CRAWL','TOURAPI','SEED') AND p.review_status='APPROVED' AND p.map_y IS NOT NULL AND p.map_x IS NOT NULL
 AND v.poi_address_snapshot=p.addr AND v.poi_lat_snapshot=p.map_y AND v.poi_lon_snapshot=p.map_x
 AND v.status='VERIFIED' AND v.verified_at<=now() AND v.review_by>now();
-- Identity-only backfill is generated below from audited numeric IDs/source refs.
-- No legacy place relationship is promoted to VERIFIED.

INSERT INTO holy_content_artist(content_sqno,artist_id,identity_basis)
SELECT c.content_sqno,a.artist_id,'2026-10-25 audited explicit identity; no visit verification'
FROM (VALUES
(28,15,'kride-artist-28','ATEEZ'),
(34,22,'kride-artist-34','DAY6'),
(36,13,'kride-artist-36','EXO'),
(39,29,'kride-artist-39','ITZY'),
(42,14,'kride-artist-42','NCT'),
(47,26,'kride-artist-47','TOMORROW X TOGETHER'),
(302,28,'kride-artist-302','Red Velvet'),
(415,1,'kride-artist-416','bts'),
(466,2,'kride-artist-467','blackpink'),
(525,36,'kride-artist-526','성시경'),
(527,3,'kride-artist-528','seventeen'),
(561,12,'kride-artist-562','Stray Kids'),
(628,4,'kride-artist-629','ive'),
(630,17,'kride-artist-631','아이유(IU)'),
(642,21,'kride-artist-643','악뮤(AKMU)'),
(680,13,'kride-artist-681','EXO'),
(690,23,'kride-artist-691','(여자)아이들'),
(817,19,'kride-artist-818','임영웅'),
(860,31,'kride-artist-861','G-DRAGON'),
(942,11,'kride-artist-943','TWICE')) AS m(content_id,artist_id,source_ref,slug)
JOIN holy_content c ON c.content_sqno=m.content_id AND c.source_ref=m.source_ref
JOIN artist a ON a.artist_id=m.artist_id AND a.slug=m.slug
ON CONFLICT DO NOTHING;

-- The old onboarding list used unrelated 1..30 VALUES IDs. Never send those as artist IDs.
UPDATE query_master
SET query_text='SELECT artist_id AS id, artist_id AS "artistId", name_ko AS name, image_url AS "imageUrl" FROM artist WHERE approved_yn = ''Y'' ORDER BY sort_order, artist_id',
 updated_at=now()
WHERE sql_key='kride_artist_list';
