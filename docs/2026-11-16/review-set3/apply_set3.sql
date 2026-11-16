-- 검수 세트 3: Red Velvet 24곳 + 아이유 21곳 + TXT 19곳 + DAY6 14곳. 민아님 지시(2026-11-16, 추천대로 바로 반영)로 적용.
--   Red Velvet: 맞음 2 → VERIFIED, 비공식 2 → UNOFFICIAL, 아님 1 → REVOKED. DAY6: 아님 5(다른 방송·아티스트 설명). TXT: 아님 1(지수 설명). 아이유: 전부 보류.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_set3.sql   (V126 필요)
-- 되돌리기: 아래 11곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_set3(slug text, poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_set3 VALUES
  ('Red Velvet',2568,'남해독일마을','VERIFIED','https://www.imaeil.com/page/view/2018012322500891084','레드벨벳 레벨업 프로젝트 시즌2 남해 편 14~18화(2018-01)(매일신문)','레벨업 프로젝트 시즌2 남해 편, 매일신문'),
  ('Red Velvet',2569,'남해양떼목장 양모리학교','VERIFIED','https://www.edaily.co.kr/news/read?mediaCodeNo=260&newsId=02702726619179072','레드벨벳 레벨업 프로젝트 시즌2 남해 편, 웬디 양몰이(이데일리 2018-04-23)','레벨업 프로젝트 시즌2 남해 편, 이데일리'),
  ('Red Velvet',2585,'송파파크하비오워터킹덤워터파크&찜질스파','UNOFFICIAL',NULL,NULL,'런닝맨 338회 찜질방 장면, 시설 이름은 2차 자료'),
  ('Red Velvet',2587,'얼큰한 조벡이 수제비','UNOFFICIAL',NULL,NULL,'수요미식회 수제비 편 소개 식당, 가게 이름은 팬 자료'),
  ('Red Velvet',2578,'피닉스 현대백화점무역센터점','REVOKED',NULL,NULL,'슬기 방문 근거 없음, 폐점'),
  ('DAY6',1641,'추억의달동네','REVOKED',NULL,NULL,'근거 방송이 나 혼자 산다(현무학당)'),
  ('DAY6',1643,'첨성대','REVOKED',NULL,NULL,'근거 방송이 나 혼자 산다(현무학당)'),
  ('DAY6',3708,'잔비워','REVOKED',NULL,NULL,'데이터 설명이 BTS 정국 97즈'),
  ('DAY6',5217,'청양수산','REVOKED',NULL,NULL,'근거가 생방송 투데이 맛집 소개'),
  ('DAY6',7432,'영천영화 뜰','REVOKED',NULL,NULL,'전참시 181회 출연자가 DAY6 아님'),
  ('TOMORROW X TOGETHER',4403,'인스턴트펑크 압구정 플래그십 스토어','REVOKED',NULL,NULL,'데이터 설명이 지수');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_set3 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = x.slug;
  IF n <> 11 THEN
    RAISE EXCEPTION 'expected 11 PENDING rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 검수 세트3: 맞음 (' || x.note || ')'
FROM tmp_set3 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 검수 세트3: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_set3 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 검수 세트3: 아님 (' || x.note || ')'
FROM tmp_set3 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

SELECT a.slug, e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE a.slug IN ('Red Velvet','아이유(IU)','TOMORROW X TOGETHER','DAY6') GROUP BY 1,2 ORDER BY 1,2;
