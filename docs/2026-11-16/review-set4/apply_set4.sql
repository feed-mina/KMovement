-- 검수 세트 4: ATEEZ 11·임영웅 10·(여자)아이들 10·ITZY 9·G-DRAGON 9·성시경 2·악뮤 1·ive 1 (53곳). 민아님 지시(2026-11-16, 추천대로 바로 반영)로 적용.
--   맞음 2(아이들 까폼, ATEEZ 백남준아트센터), 비공식 1(G-DRAGON 천짓골식당), 아님 5(ATEEZ 1, ITZY 4). 나머지 보류.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_set4.sql   (V126 필요)
-- 되돌리기: 아래 8곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_set4(slug text, poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_set4 VALUES
  ('(여자)아이들',7006,'까폼','VERIFIED','https://www.esquirekorea.co.kr/article/83928','(여자)아이들 민니 포장 음식 장면·리사 추천 압구정 태국 음식점(에스콰이어 코리아 2024-01-26)','민니·리사 추천 태국 음식점, 에스콰이어 코리아'),
  ('ATEEZ',8306,'백남준아트센터','VERIFIED','https://thetvdb.com/series/ateez-vlive-show/episodes/6985437','ATEEZ 공식 V LIVE [K-pop tour] 백남준아트센터 Tourist 에이티즈(2019-01-01)','ATEEZ V LIVE K-pop tour 2019-01-01'),
  ('G-DRAGON',7637,'천짓골식당','UNOFFICIAL',NULL,NULL,'지드래곤 방문 사진, 2차 자료'),
  ('ATEEZ',3555,'설봉공원','REVOKED',NULL,NULL,'데이터 설명이 소지섭 드라마'),
  ('ITZY',822,'아리수 한정식','REVOKED',NULL,NULL,'데이터 설명이 개리·런닝맨'),
  ('ITZY',3678,'하남 스타필드 스포츠 몬스터','REVOKED',NULL,NULL,'데이터 설명이 달려라 방탄(BTS)'),
  ('ITZY',5625,'파사주','REVOKED',NULL,NULL,'데이터 설명이 예지원 드라마'),
  ('ITZY',8386,'소울컵','REVOKED',NULL,NULL,'ITZY 근거 없음, 이 주소 폐점');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_set4 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = x.slug;
  IF n <> 8 THEN
    RAISE EXCEPTION 'expected 8 PENDING rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 검수 세트4: 맞음 (' || x.note || ')'
FROM tmp_set4 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 검수 세트4: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_set4 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 검수 세트4: 아님 (' || x.note || ')'
FROM tmp_set4 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

SELECT a.slug, e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE a.slug IN ('ATEEZ','임영웅','(여자)아이들','ITZY','G-DRAGON','성시경','악뮤(AKMU)','ive') GROUP BY 1,2 ORDER BY 1,2;
