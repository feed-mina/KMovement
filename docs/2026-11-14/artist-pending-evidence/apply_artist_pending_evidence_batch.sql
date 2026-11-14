-- 장소는 연결됐지만 근거가 없는 아티스트 18명의 후보 장소를 '검수 대기(PENDING)' 근거로 운영 DB에 올린다.
-- 민아님 승인(2026-11-14): "1번(18명 일괄 '확인 필요' 업로드) 진행해줘".
-- SEVENTEEN(docs/2026-11-12/seventeen-review/apply_seventeen_pending_evidence.sql)과 같은 방식이다.
-- 근거는 2023 공공데이터(한국문화정보원 미디어콘텐츠 영상 촬영지, data.go.kr 15111405)의 기재 내용뿐이며
-- 공식 출처 대조 전이다. VERIFIED가 아니므로 추천 코스(verified_visit_catalog)에는 들어가지 않고,
-- 지도·목록에서 '확인 필요'로만 표시된다.
-- 대상: holy_content_artist 의 identity_basis 가 '2026-10-25 audited explicit identity' 인 kride-artist-* 연결 중
--       아래 18명. 같은 (artist, poi)가 여러 콘텐츠에 걸치면(EXO 36·680) 하나만 넣는다.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f this_file   (단일 트랜잭션, 재실행 안전)

CREATE TEMP TABLE batch_artist(artist_id bigint PRIMARY KEY, slug text NOT NULL) ON COMMIT DROP;
INSERT INTO batch_artist VALUES
  (1,'bts'),(2,'blackpink'),(4,'ive'),(11,'TWICE'),(12,'Stray Kids'),(13,'EXO'),(14,'NCT'),
  (15,'ATEEZ'),(17,'아이유(IU)'),(19,'임영웅'),(21,'악뮤(AKMU)'),(22,'DAY6'),(23,'(여자)아이들'),
  (26,'TOMORROW X TOGETHER'),(28,'Red Velvet'),(29,'ITZY'),(31,'G-DRAGON'),(36,'성시경');

DO $$
DECLARE missing text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='125' AND success) THEN
    RAISE EXCEPTION 'V125 is not applied';
  END IF;
  SELECT string_agg(b.artist_id || ':' || b.slug, ', ') INTO missing
  FROM batch_artist b LEFT JOIN artist a ON a.artist_id = b.artist_id AND a.slug = b.slug
  WHERE a.artist_id IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'artist id/slug mismatch: %', missing;
  END IF;
  SELECT string_agg(b.slug, ', ') INTO missing
  FROM batch_artist b
  WHERE NOT EXISTS (SELECT 1 FROM holy_content_artist hca JOIN holy_content c USING (content_sqno)
                    WHERE hca.artist_id = b.artist_id AND c.source_ref LIKE 'kride-artist-%'
                      AND hca.identity_basis LIKE '2026-10-25 audited explicit identity%');
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'no audited kride-artist link for: %', missing;
  END IF;
END $$;

INSERT INTO artist_place_evidence (
  content_sqno, artist_id, poi_sqno,
  poi_name_snapshot, poi_address_snapshot, poi_lat_snapshot, poi_lon_snapshot,
  action, source_url, artist_evidence, place_evidence, action_evidence, locator, status)
SELECT DISTINCT ON (hca.artist_id, p.poi_sqno)
  hcp.content_sqno, hca.artist_id, p.poi_sqno,
  p.title, p.addr, p.map_y, p.map_x,
  CASE
    WHEN p.recommend_reason ~ '(뮤직비디오|파트스위치|acoustic|안무|스페셜영상)' THEN 'MV'
    WHEN p.recommend_reason ~ '(자켓|화보)' THEN 'ALBUM_PHOTO'
    WHEN p.recommend_reason ~ '(인스타|SNS)' THEN 'SNS'
    ELSE 'CONTENT_VISIT'
  END,
  'https://www.data.go.kr/data/15111405/fileData.do',
  '2023 공공데이터 기재: ' || c.name || '. 공식 채널·방송 원본과 대조하지 않았음.',
  '데이터셋의 장소명·주소를 그대로 사용. 현재 영업·상호 동일성 미확인.',
  COALESCE(NULLIF(trim(p.recommend_reason),''),'데이터셋 설명 없음'),
  'kcisa_media_2023 ' || p.content_id || COALESCE(' tmp_poi_id=' || (p.raw_json->>'tmp_poi_id'), ''),
  'PENDING'
FROM batch_artist b
JOIN holy_content_artist hca ON hca.artist_id = b.artist_id
  AND hca.identity_basis LIKE '2026-10-25 audited explicit identity%'
JOIN holy_content c ON c.content_sqno = hca.content_sqno AND c.source_ref LIKE 'kride-artist-%'
JOIN holy_content_poi hcp ON hcp.content_sqno = c.content_sqno
JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
WHERE p.map_y IS NOT NULL AND p.map_x IS NOT NULL AND p.addr IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e
                  WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = hca.artist_id)
ORDER BY hca.artist_id, p.poi_sqno, hcp.content_sqno;

-- 결과 1: 아티스트별 근거 행 수(상태별).
SELECT a.artist_id, a.slug, e.status, count(*)
FROM artist_place_evidence e JOIN batch_artist b USING (artist_id) JOIN artist a USING (artist_id)
GROUP BY 1,2,3 ORDER BY 1,3;
-- 결과 2: 종류별 합계.
SELECT e.status, e.action, count(*)
FROM artist_place_evidence e JOIN batch_artist b USING (artist_id)
GROUP BY 1,2 ORDER BY 1,2;
-- 결과 3: 연결은 됐지만 근거가 없는 장소(좌표·주소 누락 등). 0행이어야 한다.
SELECT hca.artist_id, p.poi_sqno, p.title
FROM batch_artist b
JOIN holy_content_artist hca ON hca.artist_id = b.artist_id
JOIN holy_content_poi hcp ON hcp.content_sqno = hca.content_sqno
JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
WHERE NOT EXISTS (SELECT 1 FROM artist_place_evidence e
                  WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = hca.artist_id);
