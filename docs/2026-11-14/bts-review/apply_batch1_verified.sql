-- BTS 확정 검수 1묶음: 민아님이 2026-11-15 "맞음"으로 확정한 8곳을 PENDING → VERIFIED로 바꾼다.
-- 언론이나 관광공사가 촬영지라고 직접 밝혔고 지금도 갈 수 있는 곳. 확정되면 '확인 필요' 배지가 사라진다.
-- 근거 링크(source_url)와 위치 설명(locator)을 조사한 1차 출처로 바꾼다. 재검토 기한은 1년 뒤.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch1_verified.sql
-- 되돌리기: 같은 8곳을 status='PENDING', verified_at=NULL, review_by=NULL, reviewer=NULL 로 UPDATE.
-- 일영역(3673) 좌표 오류(경도 128.79 → 양주 약 126.9x)는 정확한 좌표를 확인한 뒤 따로 고친다.

CREATE TEMP TABLE tmp_verified(poi_sqno bigint, title text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_verified VALUES
  (3673,'일영역','https://www.seoul.co.kr/news/newsView.php?id=20190322033002',
   'BTS ''봄날'' 공식 MV(2017-02-13) 도입부, 뷔가 철길에 귀를 대는 장면','서울신문·양주시 발표 기사'),
  (3677,'용인대장금파크','https://www.thejakartapost.com/travel/2020/07/05/daejanggeum-park-birthplace-of-k-drama.html',
   '슈가(Agust D) 솔로 곡 ''대취타'' 공식 MV(2020-05-22), 궁궐 세트 장면','그룹이 아니라 슈가 솔로 곡'),
  (3759,'새만금홍보관','https://www.koreajoongangdaily.com/korea/the-bts-tour-has-fans-traveling-far-and-wide-recordbreaking-boy-bands-dedicated-army-tracks-down-filming-locations-across-korea/11672886',
   'BTS ''Save ME'' 공식 MV(2016-05), 홍보관 앞 매립지 군무 장면','건물이 아니라 건물 앞 매립지'),
  (3775,'제천 모산 비행장','https://www.seoul.co.kr/news/newsView.php?id=20190322033002',
   'BTS ''EPILOGUE : Young Forever'' 공식 MV(2016-04), 활주로 질주 장면','서울신문·트위그24'),
  (3661,'향호해변','https://www.koreaherald.com/view.php?ud=20190701000619',
   'BTS ''YOU NEVER WALK ALONE'' 앨범 재킷(2017-02-13), 해변 버스정류장','코리아헤럴드'),
  (3662,'맹방해수욕장','https://www.koreatimes.co.kr/amp/southkorea/society/20210804/local-governments-working-on-bts-place-marketing',
   'BTS ''Butter'' 재킷·컨셉 사진(2021-03 촬영)','코리아타임스·세계일보'),
  (3674,'서후리숲','https://www.kbmaeil.com/article/20250713500238',
   'BTS 2019 SEASON''S GREETINGS(2018-12) 화보·영상','경북매일'),
  (3731,'길상도예','https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=215078',
   '달려라 방탄(Run BTS!) 2018 EP.46 ''방탄공방''','한국관광공사');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM tmp_verified x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts';
  IF n <> 8 THEN
    RAISE EXCEPTION 'expected 8 PENDING BTS rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'VERIFIED',
    source_url = x.url,
    locator = x.locator,
    verified_at = now(),
    review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-15 BTS 1묶음 검수: 맞음 (' || x.note || ')'
FROM tmp_verified x, artist a
WHERE e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'bts' GROUP BY 1 ORDER BY 1;
