-- BTS 확정 검수 4묶음: 민아님이 "추천대로" 결정할 경우 적용.
--   맞음 5곳 → VERIFIED, 비공식 2곳 → UNOFFICIAL. 보류 18곳은 PENDING 그대로(아님 추천 없음).
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch4.sql   (V126 필요)
-- 되돌리기: 아래 7곳을 status='PENDING', verified_at/review_by/reviewer/source_url/locator=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_b4(poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_b4 VALUES
  (3659,'정동심곡 바다부채길','VERIFIED','https://www.kado.net/news/articleView.html?idxno=1188034',
   'RM 개인 SNS 방문 사진(원 게시물 미확인), 강원도민일보 2023-06-13','RM이 SNS에 사진을 올린 곳'),
  (3683,'불국사','VERIFIED','https://www.ibulgyo.com/news/articleView.html?idxno=172278',
   '@BTS_twt RM 2019-01-04·01-08 경주 여행 사진(석가탑·회랑), 불교신문 2019-03-04','RM 트위터 사진'),
  (3684,'한국대중음악박물관','VERIFIED','https://www.trotnews.co.kr/article/2627',
   'RM 방문·SNS 후기(원 게시물 미확인), 트롯뉴스 2026-06-02·헤이팝 2024-11-12','RM 방문 후기'),
  (3696,'부산시립미술관','VERIFIED','https://busan.go.kr/eng/bsnews01/1520316',
   'RM 인스타그램 2022-02-07 볼탕스키전 4.4 사진(부산시 뉴스·KPI뉴스)','트위터 아님, 인스타그램'),
  (3724,'서울시립 북서울미술관','VERIFIED','https://entertainment.inquirer.net/348357/bts-leader-rms-special-love-of-korean-paintings',
   '@BTS_twt RM 2019-07-09 근대미술전 사진 3장(코리아헤럴드/ANN)','RM 트위터 사진'),
  (3773,'문쏘 제주협재점','UNOFFICIAL',NULL,NULL,'지민 2021-12 제주 방문: allkpop·SBS Star 사장 발언·팬 후기'),
  (3679,'검단산','UNOFFICIAL',NULL,NULL,'@BTS_twt 2019-03-18 진·정국 등산 사진, 산 이름은 해외매체 추정');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_b4 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts';
  IF n <> 7 THEN
    RAISE EXCEPTION 'expected 7 PENDING BTS rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 BTS 4묶음 검수: 맞음 (' || x.note || ')'
FROM tmp_b4 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 BTS 4묶음 검수: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_b4 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 BTS 4묶음 검수: 아님 (' || x.note || ')'
FROM tmp_b4 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'bts' GROUP BY 1 ORDER BY 1;
