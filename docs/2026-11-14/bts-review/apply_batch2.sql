-- BTS 확정 검수 2묶음: 민아님이 2026-11-15 "추천대로" 결정.
--   맞음 6곳 → VERIFIED, 비공식 3곳 → UNOFFICIAL, 아님 4곳 → REVOKED. 보류 12곳은 PENDING 그대로.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch2.sql   (V126 필요)
-- 되돌리기: 아래 13곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_b2(poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_b2 VALUES
  (3676,'구하우스미술관','VERIFIED','https://www.hankyung.com/article/2026080691391',
   'RM 개인 방문(날짜 미상), 한국경제 2026-08-06 관장 인터뷰','RM 방문 장소, 촬영지 아님'),
  (3689,'동래밀면 본점','VERIFIED','https://www.koreajoongangdaily.com/lifestyle/traces-of-purple-how-busan-remembers-bts-ahead-of-its-arirang-concerts-in-june/12608046',
   'RM 개인 방문(날짜 미상), 코리아중앙데일리 2026-05-29','RM 방문 식당, 촬영지 아님'),
  (3692,'부산시민공원','VERIFIED','https://sbsstar.net/article/N1005314535/busan-kindly-informs-the-park-where-bts-v-has-recently-walked',
   'BTS 공식 트위터 2019-06-15 뷔 사진(부산 5th MUSTER 기간)','부산시설공단 동선 안내'),
  (3698,'학동공원','VERIFIED','https://mediahub.seoul.go.kr/archives/2008221',
   '연습생 시절 휴식처, 달려라 방탄 텔레파시 편(2022-08)','서울시 미디어허브'),
  (3705,'유정식당','VERIFIED','https://www.gangnam.go.kr/gangnamlife/2026/html/vol367/sub01_07.html',
   '연습생 시절 단골 식당(강남구청 소식지 367호, AP 2026-03-20)','강남구청·AP'),
  (3710,'K STAR ROAD','VERIFIED','https://www.visitgangnam.net/en/kpop',
   'K-Star Road의 BTS 강남돌(아트토이 조형물)','BTS 아트토이 전시, 방문·촬영지 아님'),
  (3687,'용문각','UNOFFICIAL',NULL,NULL,'지민 단골 중국집으로 알려짐: 부산나비·팬플러스'),
  (3688,'오륙도','UNOFFICIAL',NULL,NULL,'지민 BTS 로그 2015 오륙도 선착장: allkpop·남구 포토존'),
  (3691,'콘피오','UNOFFICIAL',NULL,NULL,'뷔·박보검 2019-06-14 방문: SBS Star(이름 없음)·사장님 SNS'),
  (3660,'엠꼼마카롱','REVOKED',NULL,NULL,'RM 방문 근거 없음, 휴업'),
  (3699,'은행골 신사점','REVOKED',NULL,NULL,'BTS 근거 없음, 폐점'),
  (3700,'네모집 논현점','REVOKED',NULL,NULL,'BTS 근거 없음, 상호 변경 후 폐업'),
  (3704,'지아니스나폴리 가로수길점','REVOKED',NULL,NULL,'진 근거 없음, 폐점');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_b2 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts';
  IF n <> 13 THEN
    RAISE EXCEPTION 'expected 13 PENDING BTS rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-15 BTS 2묶음 검수: 맞음 (' || x.note || ')'
FROM tmp_b2 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-15 BTS 2묶음 검수: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_b2 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-15 BTS 2묶음 검수: 아님 (' || x.note || ')'
FROM tmp_b2 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'bts' GROUP BY 1 ORDER BY 1;
