-- approved_yn remains the single persisted moderation value. This view reflects
-- Y -> N and N -> Y immediately without stale per-user copies or cache entries.
CREATE OR REPLACE VIEW kpop_saved_catalog AS
SELECT 'artists' AS kind, artist_id AS item_ref,
       CASE WHEN approved_yn='Y' THEN 'PUBLIC' ELSE 'PRIVATE' END AS visibility,
       CASE WHEN approved_yn='Y' THEN COALESCE(name_ko,name_en,'아티스트') ELSE NULL END AS title
FROM artist
UNION ALL
SELECT 'events',e.event_id,
       CASE WHEN e.approved_yn='Y' AND a.approved_yn='Y' THEN 'PUBLIC' ELSE 'PRIVATE' END,
       CASE WHEN e.approved_yn='Y' AND a.approved_yn='Y' THEN COALESCE(e.title_ko,e.title_en,'이벤트') ELSE NULL END
FROM event e LEFT JOIN artist a ON a.artist_id=e.artist_id
UNION ALL
SELECT 'products',product_candidate_id,
       CASE WHEN approved_yn='Y' THEN 'PUBLIC' ELSE 'PRIVATE' END,
       CASE WHEN approved_yn='Y' THEN name ELSE NULL END
FROM product_candidate;

CREATE INDEX IF NOT EXISTS idx_artist_follow_owner_page ON artist_follow(user_sqno,created_at DESC,artist_follow_id DESC);
CREATE INDEX IF NOT EXISTS idx_event_bookmark_owner_page ON event_bookmark(user_sqno,created_at DESC,event_bookmark_id DESC);
CREATE INDEX IF NOT EXISTS idx_saved_item_owner_type_page ON saved_item(user_sqno,item_type,created_at DESC,saved_item_id DESC);
