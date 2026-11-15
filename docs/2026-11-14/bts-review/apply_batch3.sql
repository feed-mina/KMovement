-- BTS 확정 검수 3묶음: 민아님이 "추천대로" 결정할 경우 적용.
--   맞음 2곳 → VERIFIED, 비공식 2곳 → UNOFFICIAL, 아님 5곳 → REVOKED. 보류 16곳은 PENDING 그대로.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch3.sql   (V126 필요)
-- 되돌리기: 아래 9곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_b3(poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_b3 VALUES
  (3761,'오성한옥마을','VERIFIED','https://www.jjan.kr/articleAmp/20190914689153',
   'BTS 2019 SUMMER PACKAGE in KOREA 촬영지(전북일보 2019-09-14, 세계일보 2022-06)','썸머패키지 촬영 마을'),
  (3762,'아원','VERIFIED','https://www.bizhankook.com/bk/article/32194',
   'BTS 2019 SUMMER PACKAGE in KOREA 주무대 아원고택(비즈한국, 세계일보 2022-06)','유료 입장, 8세 미만 불가'),
  (3721,'안동참찜닭 본점','UNOFFICIAL',NULL,NULL,'진 사인·방문: 핫플헌터·팬 방문기'),
  (3741,'해쉬더우드','UNOFFICIAL',NULL,NULL,'슈가 목공방 VLOG(BANGTANTV 2022-08) 공방명은 팬 자료'),
  (3716,'개그맨 정용국의 용곱창 강남본점','REVOKED',NULL,NULL,'BTS 근거 없음, 폐점'),
  (3719,'NY B&B','REVOKED',NULL,NULL,'RM 근거 리뷰 1건, 폐점'),
  (3722,'쑤담샤브샤브','REVOKED',NULL,NULL,'진 근거 없음, 폐점'),
  (3726,'고메오드','REVOKED',NULL,NULL,'진 근거 없음, 이전 후 폐점'),
  (3729,'CaFace','REVOKED',NULL,NULL,'BTS 근거 없음, 폐업');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_b3 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts';
  IF n <> 9 THEN
    RAISE EXCEPTION 'expected 9 PENDING BTS rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-15 BTS 3묶음 검수: 맞음 (' || x.note || ')'
FROM tmp_b3 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-15 BTS 3묶음 검수: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_b3 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-15 BTS 3묶음 검수: 아님 (' || x.note || ')'
FROM tmp_b3 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'bts' GROUP BY 1 ORDER BY 1;
