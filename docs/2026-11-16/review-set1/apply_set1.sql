-- 검수 세트 1: BLACKPINK 3묶음(25곳) + SEVENTEEN 1~2묶음(45곳). 민아님 지시(2026-11-16, 추천대로 바로 반영)로 적용.
--   BLACKPINK: 맞음 2 → VERIFIED, 비공식 1 → UNOFFICIAL, 아님 3 → REVOKED. 보류 19곳은 PENDING 그대로.
--   SEVENTEEN: 맞음 1 → VERIFIED, 비공식 1 → UNOFFICIAL, 아님 2 → REVOKED. 보류 41곳은 PENDING 그대로.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_set1.sql   (V126 필요)
-- 되돌리기: 아래 10곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_set1(slug text, poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_set1 VALUES
  ('blackpink',4455,'카페콤포트','VERIFIED','https://www.harpersbazaar.co.kr/article/67576',
   '제니 인스타그램 @jennierubyjane 2022년 6월경 콤포트 서울 게시물(하퍼스 바자 코리아)','제니 인스타그램, GD 방문은 근거 약함'),
  ('blackpink',4464,'이정의댁','VERIFIED','https://www.cosmopolitan.co.kr/article/67055',
   '지수 인스타그램 @sooyaaa__ 2022-05-10 제주 게시물, 이정의댁 주황색 의자 사진(코스모폴리탄 코리아)','코스모폴리탄 코리아 2022-06-08'),
  ('blackpink',4466,'오일장떡볶이','UNOFFICIAL',NULL,NULL,'블핑하우스 제주 편 동문시장 떡볶이, 가게 이름은 여행·팬 자료'),
  ('blackpink',4456,'HOPE GARDEN HANNAM','REVOKED',NULL,NULL,'로제 근거 없음, 폐점'),
  ('blackpink',4417,'클라로','REVOKED',NULL,NULL,'지수 근거 없음, 2023년 폐점(제시카 레스토랑)'),
  ('blackpink',4431,'Mon Cafe Gregory','REVOKED',NULL,NULL,'지수 근거 없음, 폐점'),
  ('seventeen',5649,'평창 송어축제','VERIFIED','https://www.tenasia.co.kr/article/2018020419134',
   'KBS2 배틀트립 평창·강릉 특집(2018-02-03) 민규·승관 평창 편(텐아시아)','겨울 한정 축제'),
  ('seventeen',5654,'33호 할머니 칼국수','UNOFFICIAL',NULL,NULL,'GOING SEVENTEEN 2020 EP.44 TTT 대부도 칼국수 장면, 가게 이름은 팬 지도'),
  ('seventeen',5672,'고수포차','REVOKED',NULL,NULL,'세븐틴 단골 근거 없음, 이 주소 폐점'),
  ('seventeen',5674,'비안빈','REVOKED',NULL,NULL,'V LIVE 근거 없음, 폐점');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_set1 x
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
    reviewer = '민아 2026-11-16 검수 세트1: 맞음 (' || x.note || ')'
FROM tmp_set1 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 검수 세트1: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_set1 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 검수 세트1: 아님 (' || x.note || ')'
FROM tmp_set1 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

SELECT a.slug, e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE a.slug IN ('blackpink','seventeen') GROUP BY 1,2 ORDER BY 1,2;
