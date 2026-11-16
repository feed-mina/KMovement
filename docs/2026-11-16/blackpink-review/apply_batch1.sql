-- BLACKPINK 확정 검수 1묶음: 민아님이 "추천대로" 결정할 경우 적용.
--   맞음 2곳 → VERIFIED, 비공식 2곳 → UNOFFICIAL, 아님 3곳 → REVOKED. 보류 18곳은 PENDING 그대로.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch1.sql   (V126 필요)
-- 되돌리기: 아래 7곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_bp1(poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_bp1 VALUES
  (4392,'대관령 하늘목장','VERIFIED','https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=70249',
   'BLACKPINK ''Lovesick Girls'' 공식 MV(2020-10-02), 들판 스포츠카 장면(한국관광공사)','관광공사 기준, 소속사 언급 없음'),
  (4398,'흥환간이해수욕장','VERIFIED','https://www.elle.co.kr/article/56498',
   'JTBC ''바라던 바다''(2021) 포항 흥환리 편, 로제 알바생 출연(엘르 코리아)','바 건물은 촬영 후 없을 수 있음'),
  (4396,'벅구베이크','UNOFFICIAL',NULL,NULL,'24/365 with BLACKPINK EP.9(2020-08) 반려견 간식 만들기, 가게 이름은 팬 자료'),
  (4420,'블레스 유 플라워','UNOFFICIAL',NULL,NULL,'강남구 가이드북은 같은 건물 카페 뉘앙스를 로제·리사 방문지로 소개'),
  (4412,'수아에피스','REVOKED',NULL,NULL,'리사·민니가 간 곳은 근처 다른 가게(까폼)'),
  (4418,'CELINE 플래그십스토어','REVOKED',NULL,NULL,'리사 행사는 더현대 팝업, 플래그십은 2024년 이전'),
  (4421,'쏭타이 역삼점','REVOKED',NULL,NULL,'리사 근거 없음, 폐점');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_bp1 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'blackpink';
  IF n <> 7 THEN
    RAISE EXCEPTION 'expected 7 PENDING BLACKPINK rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 BLACKPINK 1묶음 검수: 맞음 (' || x.note || ')'
FROM tmp_bp1 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'blackpink' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 BLACKPINK 1묶음 검수: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_bp1 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'blackpink' AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 BLACKPINK 1묶음 검수: 아님 (' || x.note || ')'
FROM tmp_bp1 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'blackpink' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'blackpink' GROUP BY 1 ORDER BY 1;
