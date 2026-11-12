-- SEVENTEEN 후보 장소 전체를 '검수 대기(PENDING)' 근거로 운영 DB에 올린다.
-- 민아님 승인(2026-11-12): "pending인 곳은 확인필요 툴팁으로 표기하고 같이 DB에 올려줘".
-- 근거는 2023 공공데이터(한국문화정보원 미디어콘텐츠 영상 촬영지, data.go.kr 15111405)의 기재 내용뿐이며
-- 공식 출처 대조 전이다. 이 행들은 VERIFIED가 아니므로 추천 코스(verified_visit_catalog)에는 들어가지 않고,
-- 지도·목록에서 '확인 필요'로만 표시된다.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f this_file   (단일 트랜잭션, 재실행 안전)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='125' AND success) THEN
    RAISE EXCEPTION 'V125 is not applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM artist WHERE artist_id=3 AND slug='seventeen') THEN
    RAISE EXCEPTION 'artist_id 3 is not seventeen';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM holy_content_artist hca JOIN holy_content c USING (content_sqno)
                 WHERE c.source_ref='kride-artist-528' AND hca.artist_id=3) THEN
    RAISE EXCEPTION 'kride-artist-528 is not identity-linked to SEVENTEEN';
  END IF;
END $$;

INSERT INTO artist_place_evidence (
  content_sqno, artist_id, poi_sqno,
  poi_name_snapshot, poi_address_snapshot, poi_lat_snapshot, poi_lon_snapshot,
  action, source_url, artist_evidence, place_evidence, action_evidence, locator, status)
SELECT hcp.content_sqno, 3, p.poi_sqno,
  p.title, p.addr, p.map_y, p.map_x,
  CASE
    WHEN p.recommend_reason ~ '(뮤직비디오|파트스위치|acoustic|안무|스페셜영상)' THEN 'MV'
    WHEN p.recommend_reason ~ '(자켓|화보)' THEN 'ALBUM_PHOTO'
    WHEN p.recommend_reason ~ '(인스타|SNS)' THEN 'SNS'
    ELSE 'CONTENT_VISIT'
  END,
  'https://www.data.go.kr/data/15111405/fileData.do',
  '2023 공공데이터 기재: 세븐틴. 공식 채널·방송 원본과 대조하지 않았음.',
  '데이터셋의 장소명·주소를 그대로 사용. 현재 영업·상호 동일성 미확인.',
  COALESCE(NULLIF(trim(p.recommend_reason),''),'데이터셋 설명 없음'),
  'kcisa_media_2023 ' || p.content_id || COALESCE(' tmp_poi_id=' || (p.raw_json->>'tmp_poi_id'), ''),
  'PENDING'
FROM holy_content c
JOIN holy_content_poi hcp ON hcp.content_sqno = c.content_sqno
JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
WHERE c.source_ref = 'kride-artist-528'
  AND p.map_y IS NOT NULL AND p.map_x IS NOT NULL AND p.addr IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = 3);

-- 결과: SEVENTEEN 근거 행 수(상태별)와 연결은 됐지만 근거가 없는 장소(좌표·주소 누락 등).
SELECT status, action, count(*) FROM artist_place_evidence WHERE artist_id=3 GROUP BY 1,2 ORDER BY 1,2;
SELECT p.poi_sqno, p.title FROM holy_content c
JOIN holy_content_poi hcp ON hcp.content_sqno=c.content_sqno JOIN tour_poi p ON p.poi_sqno=hcp.poi_sqno
WHERE c.source_ref='kride-artist-528'
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e WHERE e.poi_sqno=p.poi_sqno AND e.artist_id=3);
