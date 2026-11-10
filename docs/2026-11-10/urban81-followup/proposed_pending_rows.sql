-- DRAFT ONLY. Not a Flyway migration and not applied anywhere.
-- Source: dataset/reviews/urban81-current-conditions-20261110.json
-- Purpose: record URBAN81 (kride-media-5671) current conditions and the
-- Mingyu-only V LIVE evidence as PENDING rows for later human review.
-- Applying this to the production DB, or flipping status to VERIFIED,
-- needs the owner's explicit approval first.

BEGIN;

-- 1) Visit policy (PENDING). Hours and prices are the operator's Kakao My Store
--    listing as read on 2026-11-10; they are not field verified.
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
WHERE p.content_id = 'kride-media-5671'
ON CONFLICT (poi_sqno) DO NOTHING;

-- 2) Artist-place evidence (PENDING). There is no member-level artist row for
--    Mingyu, so this attaches to SEVENTEEN (artist_id 3) and states in the text
--    that only Mingyu appears. It must not be read as a group visit.
INSERT INTO artist_place_evidence (
  content_sqno, artist_id, poi_sqno,
  poi_name_snapshot, poi_address_snapshot, poi_lat_snapshot, poi_lon_snapshot,
  action, source_url, artist_evidence, place_evidence, action_evidence, locator, status)
SELECT hcp.content_sqno, 3, p.poi_sqno,
  p.title, p.addr, p.map_y, p.map_x,
  'CONTENT_VISIT',
  'https://www.youtube.com/watch?v=hrhzrA-z8Yg',
  'Mingyu of SEVENTEEN appears alone (V LIVE ''나의 영희가 되어줘'' ep.3, 2016-11-12). Other members do not appear; no group inheritance.',
  'Store name is not visible in frames. Link to URBAN81 relies on the 2018 Seoul Tourism Organization article. Filming predates the current 2019 business permit.',
  'Greets at the entrance terrace, makes two coffees behind the bar, then talks at a window table.',
  'entrance 00:00-00:33; bar 01:45-04:30; window table 04:39-19:23 (fan backup copy, not the official upload)',
  'PENDING'
FROM tour_poi p
JOIN holy_content_poi hcp ON hcp.poi_sqno = p.poi_sqno
JOIN holy_content c ON c.content_sqno = hcp.content_sqno AND c.source_ref = 'kride-artist-528'
JOIN holy_content_artist hca ON hca.content_sqno = hcp.content_sqno AND hca.artist_id = 3
WHERE p.content_id = 'kride-media-5671'
  AND NOT EXISTS (
    SELECT 1 FROM artist_place_evidence e
    WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = 3
      AND e.source_url = 'https://www.youtube.com/watch?v=hrhzrA-z8Yg');

ROLLBACK; -- keep as a dry run until approved
