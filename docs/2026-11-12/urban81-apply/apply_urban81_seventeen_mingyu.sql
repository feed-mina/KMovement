-- URBAN81 (kride-media-5671): attach the Mingyu V LIVE evidence to BOTH
-- SEVENTEEN (artist_id 3) and a new member-level artist row for Mingyu.
-- Owner approved on 2026-11-12 ("1번은 둘다 붙여줘").
-- Everything stays PENDING. Nothing becomes VERIFIED or visible in courses.
-- Requires V125 (artist_place_evidence, holy_content_artist, poi_visit_policy).
-- Run with: psql -v ON_ERROR_STOP=1 -1 -f this_file   (single transaction)
-- Idempotent: safe to re-run.

-- 0) Preconditions: fail loudly instead of inserting nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='125' AND success) THEN
    RAISE EXCEPTION 'V125 is not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tour_poi WHERE content_id='kride-media-5671') THEN
    RAISE EXCEPTION 'URBAN81 tour_poi row (kride-media-5671) not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artist WHERE artist_id=3 AND slug='seventeen') THEN
    RAISE EXCEPTION 'artist_id 3 is not seventeen';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM holy_content c
    JOIN holy_content_poi hcp ON hcp.content_sqno=c.content_sqno
    JOIN tour_poi p ON p.poi_sqno=hcp.poi_sqno AND p.content_id='kride-media-5671'
    WHERE c.source_ref='kride-artist-528') THEN
    RAISE EXCEPTION 'content kride-artist-528 is not linked to URBAN81';
  END IF;
END $$;

-- 1) Member-level artist row. approved_yn='N' keeps Mingyu out of the
--    onboarding artist list and out of verified_visit_catalog until the
--    owner verifies the place and flips it to 'Y'.
INSERT INTO artist (slug, name_ko, name_en, profile, official_url, approved_yn, sort_order)
VALUES ('seventeen-mingyu', '민규 (SEVENTEEN)', 'MINGYU (SEVENTEEN)',
        'SEVENTEEN member. Member-level row for evidence that features Mingyu only; does not inherit group evidence.',
        'https://www.pledis.co.kr/', 'N', 900)
ON CONFLICT (slug) DO NOTHING;

-- 2) Identity links for the V LIVE content (SEVENTEEN link normally comes from V125 backfill).
INSERT INTO holy_content_artist (content_sqno, artist_id, identity_basis)
SELECT c.content_sqno, a.artist_id,
       CASE WHEN a.slug='seventeen'
            THEN '2026-10-25 audited explicit identity; no visit verification'
            ELSE '2026-11-12 V LIVE ep.3 features Mingyu only; owner-approved member link' END
FROM holy_content c
CROSS JOIN artist a
WHERE c.source_ref='kride-artist-528' AND a.slug IN ('seventeen','seventeen-mingyu')
ON CONFLICT DO NOTHING;

-- 3) Visit policy (PENDING). Operator Kakao My Store listing read on 2026-11-10.
INSERT INTO poi_visit_policy (
  poi_sqno, poi_name_snapshot, poi_address_snapshot, poi_lat_snapshot, poi_lon_snapshot,
  weekly_hours, date_overrides, hours_source_url,
  cost_krw, cost_source_url, cost_evidence, status)
SELECT p.poi_sqno, p.title, p.addr, p.map_y, p.map_x,
  '{"mon":["08:30","19:30"],"tue":["08:30","19:30"],"wed":["08:30","19:30"],"thu":["08:30","19:30"],"fri":["08:30","19:30"],"sat":null,"sun":null}'::jsonb,
  '{}'::jsonb,
  'https://place.map.kakao.com/274201193',
  3500,
  'https://place.map.kakao.com/274201193',
  'Lowest drink price on the operator menu (Americano 3,500 KRW, menu updated 2026-06-15). No minimum-order or reservation terms published.',
  'PENDING'
FROM tour_poi p
WHERE p.content_id='kride-media-5671'
ON CONFLICT (poi_sqno) DO NOTHING;

-- 4) Artist-place evidence (PENDING) for both SEVENTEEN and Mingyu.
INSERT INTO artist_place_evidence (
  content_sqno, artist_id, poi_sqno,
  poi_name_snapshot, poi_address_snapshot, poi_lat_snapshot, poi_lon_snapshot,
  action, source_url, artist_evidence, place_evidence, action_evidence, locator, status)
SELECT hcp.content_sqno, a.artist_id, p.poi_sqno,
  p.title, p.addr, p.map_y, p.map_x,
  'CONTENT_VISIT',
  'https://www.youtube.com/watch?v=hrhzrA-z8Yg',
  'Mingyu of SEVENTEEN appears alone (V LIVE ''나의 영희가 되어줘'' ep.3, 2016-11-12). Other members do not appear; no group inheritance.',
  'Store name is not visible in frames. Link to URBAN81 relies on the 2018 Seoul Tourism Organization article. Filming predates the current 2019 business permit.',
  'Greets at the entrance terrace, makes two coffees behind the bar, then talks at a window table.',
  'entrance 00:00-00:33; bar 01:45-04:30; window table 04:39-19:23 (fan backup copy, not the official upload)',
  'PENDING'
FROM tour_poi p
JOIN holy_content_poi hcp ON hcp.poi_sqno=p.poi_sqno
JOIN holy_content c ON c.content_sqno=hcp.content_sqno AND c.source_ref='kride-artist-528'
JOIN artist a ON a.slug IN ('seventeen','seventeen-mingyu')
JOIN holy_content_artist hca ON hca.content_sqno=hcp.content_sqno AND hca.artist_id=a.artist_id
WHERE p.content_id='kride-media-5671'
  AND NOT EXISTS (
    SELECT 1 FROM artist_place_evidence e
    WHERE e.poi_sqno=p.poi_sqno AND e.artist_id=a.artist_id
      AND e.source_url='https://www.youtube.com/watch?v=hrhzrA-z8Yg');

-- 5) Result: expect 2 evidence rows (seventeen, seventeen-mingyu) and 1 policy row, all PENDING.
SELECT a.slug, e.status, e.action FROM artist_place_evidence e JOIN artist a USING (artist_id)
JOIN tour_poi p ON p.poi_sqno=e.poi_sqno WHERE p.content_id='kride-media-5671' ORDER BY a.slug;
SELECT v.status, v.cost_krw FROM poi_visit_policy v JOIN tour_poi p USING (poi_sqno) WHERE p.content_id='kride-media-5671';
