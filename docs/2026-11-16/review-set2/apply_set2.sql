-- 검수 세트 2: NCT 30곳 + TWICE 30곳 + EXO 25곳. 민아님 지시(2026-11-16, 추천대로 바로 반영)로 적용.
--   EXO: 맞음 2 → VERIFIED. NCT: 비공식 1 → UNOFFICIAL, 아님 7 → REVOKED(대부분 다른 아티스트 설명이 잘못 붙음). TWICE: 전부 보류.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_set2.sql   (V126 필요)
-- 되돌리기: 아래 10곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_set2(slug text, poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_set2 VALUES
  ('EXO',6956,'투썸플레이스 춘천구봉산점','VERIFIED','https://japanese.kpopstarz.com/articles/48842/20160127/exo-chanyeol-sehun.htm','찬열 @real__pcy 2016-01-25·세훈 @oohsehun 2016-01 인스타그램, 투썸플레이스 춘천 스카이워크(KpopStarz)','찬열·세훈 인스타그램 2016-01, KpopStarz 보도'),
  ('EXO',6968,'커피더쏠','VERIFIED','https://www.esquirekorea.co.kr/article/62700','시우민 슈윗타임 팬미팅 영상 촬영지·인스타그램 셀카(에스콰이어 코리아 2022-01-05)','시우민 팬미팅 영상 촬영·인스타그램, 에스콰이어 코리아'),
  ('NCT',8504,'춘천의암호스카이워크','UNOFFICIAL',NULL,NULL,'NCT LIFE 춘천·홍천 편, 관광정보 사이트 기준'),
  ('NCT',808,'센토리','REVOKED',NULL,NULL,'데이터 설명이 강다니엘'),
  ('NCT',3703,'도산족발&칼국수','REVOKED',NULL,NULL,'데이터 설명이 BTS(지민·뷔·진)'),
  ('NCT',4413,'고센인코퍼레이티드 청담점','REVOKED',NULL,NULL,'데이터 설명이 리사·민니'),
  ('NCT',6804,'볼링볼링','REVOKED',NULL,NULL,'데이터 설명이 아이즈원'),
  ('NCT',6914,'서울스카이','REVOKED',NULL,NULL,'근거 방송이 NCT와 무관(어서와 4화 멕시코 편)'),
  ('NCT',7202,'꾸머카페','REVOKED',NULL,NULL,'꾸머카페 폐점, 현재 다른 가게'),
  ('NCT',7322,'도쿄수플레','REVOKED',NULL,NULL,'데이터 설명이 이홍기');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_set2 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = x.slug;
  IF n <> 10 THEN
    RAISE EXCEPTION 'expected 10 PENDING rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 검수 세트2: 맞음 (' || x.note || ')'
FROM tmp_set2 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 검수 세트2: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_set2 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 검수 세트2: 아님 (' || x.note || ')'
FROM tmp_set2 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

SELECT a.slug, e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE a.slug IN ('NCT','TWICE','EXO') GROUP BY 1,2 ORDER BY 1,2;
