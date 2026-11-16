-- BLACKPINK 확정 검수 2묶음: 민아님이 "추천대로" 결정할 경우 적용.
--   맞음 3곳 → VERIFIED, 비공식 3곳 → UNOFFICIAL. 보류 19곳은 PENDING 그대로.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch2.sql   (V126 필요)
-- 되돌리기: 아래 6곳을 status='PENDING', verified_at/review_by/reviewer=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_bp2(poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_bp2 VALUES
  (4430,'도자기 카페 줄','VERIFIED','https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=177267',
   '24/365 with BLACKPINK(2020) 지수·로제 도자기 만들기 장면(한국관광공사)','관광공사 기준, 회차 미확인'),
  (4433,'내맘대로 폰케이스 홍대점','VERIFIED','https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=215277',
   'V LIVE ''HOW TO in V'' 지수·제니 폰케이스 만들기(한국관광공사)','관광공사 기준, 원본 영상 종료'),
  (4443,'피터팬 1978','VERIFIED','https://www.harpersbazaar.co.kr/article/62401',
   '제니 공식 유튜브 Jennierubyjane Official ''Bakery tour vlog''(2021-12-15)(하퍼스 바자 코리아)','연희동 본점'),
  (4434,'미어캣 프랜즈','UNOFFICIAL',NULL,NULL,'제니·로제 2019-08 인스타그램, ETtoday 보도. 2023년 이후 와우산로21길 20 2층으로 이전'),
  (4445,'레프레미스','UNOFFICIAL',NULL,NULL,'수요미식회 184회 로제 추천 마카롱 가게로 추정, 가게 이름 직접 보도 없음'),
  (4450,'티에이티디','UNOFFICIAL',NULL,NULL,'혜리 발언(로제가 동생 바 방문), 가게 이름은 2차 자료');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_bp2 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'blackpink';
  IF n <> 6 THEN
    RAISE EXCEPTION 'expected 6 PENDING BLACKPINK rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 BLACKPINK 2묶음 검수: 맞음 (' || x.note || ')'
FROM tmp_bp2 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'blackpink' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 BLACKPINK 2묶음 검수: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_bp2 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'blackpink' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 BLACKPINK 2묶음 검수: 아님 (' || x.note || ')'
FROM tmp_bp2 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'blackpink' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'blackpink' GROUP BY 1 ORDER BY 1;
