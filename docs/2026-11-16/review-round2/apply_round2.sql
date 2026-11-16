-- 검수 2차: 보류 장소 다시 보기 + 좌표 정리. 민아님 지시(2026-11-16, 추천대로 바로 반영)로 적용.
--   좌표 고침 20곳(주소도 고침 2곳), 맞음 7·비공식 1·아님 2 (일영역·도자기카페 줄은 이미 확정이라 좌표·스냅숏만 고침). 나머지 보류.
--   좌표를 고치면 근거 행의 장소 스냅숏도 같이 고친다(V125 뷰는 스냅숏과 tour_poi가 같아야 확정 근거를 보여 줌).
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_round2.sql   (V126 필요)
-- 되돌리기: tmp_coord의 old 값으로 tour_poi·스냅숏을 되돌리고, tmp_r2 10곳을 status='PENDING', verified_at/review_by/reviewer/revoked_at/revoked_by=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_coord(poi_sqno bigint, title text, old_addr text, old_lat double precision, old_lon double precision, new_lat double precision, new_lon double precision, new_addr text) ON COMMIT DROP;
INSERT INTO tmp_coord VALUES
  (1041,'은행어린이공원','서울특별시 마포구 성미산로29길 17-3',35.564575,124.92228,37.564634,126.922412,NULL),
  (1195,'해금강마을, 거제도','경상남도 거제시 남부면 갈곶리 해금강마을',37.558888,126.93903,34.737807,128.67322,NULL),
  (1254,'압구정나들목','서울특별시 강남구 압구정동 압구정나들목',37.373988,126.43924,37.53059,127.04164,NULL),
  (2107,'강남역','서울특별시 강남구 강남대로 396',37.493168,126.43448,37.4979278,127.0275833,NULL),
  (2129,'도경리역','강원도 삼척시 도경북길 126',37.543482,126.987688,37.442675,129.115109,'강원도 삼척시 도경북길 121'),
  (3673,'일영역','경기도 양주시 장흥면 일영로647번길 25',37.700649,128.790479,37.700698,126.929166,NULL),
  (8217,'사승봉도 해변 야영지','인천광역시 옹진군 자월면 승봉로 1010',35.179685,127.480611,37.1333,126.2667,NULL),
  (8264,'대포항 등대','강원도 속초시 대포항 등대',37.516844,126.92897,38.174953,128.60746,NULL),
  (8318,'마블 스트라이크','강원도 춘천시 아침길 10',36.602055,126.669228,37.87882,127.730267,NULL),
  (8890,'세빛둥둥섬','서울시 서초구 올림픽대로',37.35957,127.10539,37.512436,126.995962,'서울특별시 서초구 올림픽대로 2085-14 (반포동)'),
  (388,'등구령쉼터','전라북도 남원시 산내면 중황리 16',37.5254027,127.6580241,35.4288,127.658,NULL),
  (3489,'이미커피','서울특별시 마포구 동교로25길 7',37.851097,127.143475,37.557475,126.92192,NULL),
  (4266,'영동교집 위례직영점','경기도 성남시 수정구 위례서일로1길 3-12 1층',33.5416012,126.6654291,37.4667259,127.1373316,NULL),
  (4380,'해운대 속씨원한대구탕 해운대점','부산광역시 해운대구 해운대로570번길 11 2층',37.689736,128.753045,35.1608472,129.1554332,NULL),
  (4516,'살롱드파이브','서울특별시 서초구 서운로 26길 9',37.997214,128.199847,37.5026625,127.0227768,NULL),
  (4638,'오븐에빠진닭 강릉유천점','강원도 강릉시 선수촌로 79-15 에이플러스 2층 201호',35.2008606,129.1190829,37.7578091,128.8687316,NULL),
  (4927,'태백애물닭갈비','경기도 시흥시 은계번영길 21 2층 205호',36.5655018,128.7283406,37.437156,126.803494,NULL),
  (7005,'양계장집아들 시흥은계점','경기도 시흥시 은계번영길 27 104-105호',37.3692368,126.7269221,37.43654,126.803967,NULL),
  (4430,'도자기 카페 줄','서울특별시 마포구 신촌로4길 11 세광빌딩 3층',37.556508,126.929983,37.5573822,126.9285064,NULL),
  (6979,'마노커피하우스','제주특별자치도 서귀포시 중문상로 97',37.506139,127.041331,33.2569,126.4276,NULL);

CREATE TEMP TABLE tmp_r2(slug text, poi_sqno bigint, title text, new_status text, url text, locator text, note text) ON COMMIT DROP;
INSERT INTO tmp_r2 VALUES
  ('Red Velvet',2579,'엘림들깨수제비칼국수','VERIFIED','https://www.asiatoday.co.kr/kn/view.php?key=20180214002348213','tvN 수요미식회 157회 수제비 편(2018-02-14, 웬디·슬기·예리 출연 회차에 소개)','출연 회차 소개 맛집, 아시아투데이·경인일보'),
  ('blackpink',4409,'고운님','VERIFIED','https://news.jkn.co.kr/post/798513','tvN 수요미식회 오징어 편(2017-08-23, 지수 출연 회차에 소개)','출연 회차 소개 식당, 재경일보'),
  ('blackpink',4422,'상도실내포장마차','VERIFIED','https://news.jkn.co.kr/post/798513','tvN 수요미식회 오징어 편(2017-08-23, 지수 출연 회차에 소개)','출연 회차 소개 식당, 재경일보'),
  ('blackpink',4432,'경주식당','VERIFIED','https://english.visitseoul.net/hallyu/the-drama-that-stimulates-your-love-cells/ENN041167','Netflix ''BLACKPINK: Light Up the Sky''(2020) 식사 장면(서울관광재단 소개)','서울관광재단 VisitSeoul 소개'),
  ('EXO',6972,'카몽','VERIFIED','https://korean.visitseoul.net/restaurants/%EC%B9%B4%EB%AA%BDKAMONG/KOP020257','카이 누나가 운영하는 카페(서울관광재단 VisitSeoul, 2026-05 수정)','서울관광재단 VisitSeoul 소개'),
  ('ITZY',8388,'성수미술관','VERIFIED','https://english.visitkorea.or.kr/svc/whereToGo/locIntrdn/rgnContentsView.do?vcontsId=215135','유나 방문 드로잉 카페(한국관광공사 영문 소개)','한국관광공사 소개'),
  ('DAY6',8348,'영진돼지국밥 본점','VERIFIED','https://www.youtube.com/watch?v=bdn0nWiDfOM','JYP 공식 ''박성찐이야'' 시즌2 EP.31(2024-10), 자막 ''영진돼지국밥 본점 입성''','JYP 공식 영상 자막에 본점 명시'),
  ('seventeen',5676,'포동푸딩','UNOFFICIAL',NULL,NULL,'승관 인스타 사진, 팬·여행 플랫폼 자료'),
  ('bts',3745,'돈의문 박물관 마을','REVOKED',NULL,NULL,'2025-08 운영 종료, 철거·공원화 예정'),
  ('blackpink',4442,'르솔레이','REVOKED',NULL,NULL,'연희동 매장 2023-12 폐점, 한남동 이전');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet';
  END IF;
  SELECT count(*) INTO n FROM tmp_coord x JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title AND p.addr = x.old_addr AND p.map_y = x.old_lat AND p.map_x = x.old_lon;
  IF n <> 20 THEN RAISE EXCEPTION 'expected 20 places with old coordinates, found %', n; END IF;
  SELECT count(*) INTO n FROM tmp_r2 x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = x.slug;
  IF n <> 10 THEN RAISE EXCEPTION 'expected 10 PENDING rows, found %', n; END IF;
END $$;

-- 1) 좌표·주소 고치기 + 근거 스냅숏 맞추기
UPDATE tour_poi p SET map_y = x.new_lat, map_x = x.new_lon, addr = COALESCE(x.new_addr, p.addr), updated_at = now()
FROM tmp_coord x WHERE p.poi_sqno = x.poi_sqno AND p.map_y = x.old_lat AND p.map_x = x.old_lon;

UPDATE artist_place_evidence e SET poi_lat_snapshot = p.map_y, poi_lon_snapshot = p.map_x, poi_address_snapshot = p.addr
FROM tmp_coord x JOIN tour_poi p ON p.poi_sqno = x.poi_sqno
WHERE e.poi_sqno = x.poi_sqno;

-- 2) 판정 반영
UPDATE artist_place_evidence e
SET status = 'VERIFIED', source_url = x.url, locator = x.locator,
    verified_at = now(), review_by = now() + interval '1 year',
    reviewer = '민아 2026-11-16 검수 2차: 맞음 (' || x.note || ')'
FROM tmp_r2 x, artist a
WHERE x.new_status = 'VERIFIED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-16 검수 2차: 팬 자료만 확인 (' || x.note || ')'
FROM tmp_r2 x, artist a
WHERE x.new_status = 'UNOFFICIAL' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '민아 2026-11-16 검수 2차: 아님 (' || x.note || ')'
FROM tmp_r2 x, artist a
WHERE x.new_status = 'REVOKED' AND e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = x.slug AND e.status = 'PENDING';

-- 확인: 좌표 고친 곳, 판정 결과, 확정 근거가 뷰 조건(스냅숏 일치)을 통과하는지(기대값 9: 새 확정 7 + 일영역·도자기카페 줄)
SELECT x.poi_sqno, p.title, p.map_y, p.map_x, p.addr FROM tmp_coord x JOIN tour_poi p USING (poi_sqno) ORDER BY 1;
SELECT a.slug, e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE e.poi_sqno IN (SELECT poi_sqno FROM tmp_r2) GROUP BY 1,2 ORDER BY 1,2;
SELECT count(*) AS verified_snapshot_ok FROM artist_place_evidence e JOIN tour_poi p USING (poi_sqno)
WHERE e.poi_sqno IN (SELECT poi_sqno FROM tmp_r2 UNION SELECT poi_sqno FROM tmp_coord) AND e.status='VERIFIED'
  AND e.poi_name_snapshot=p.title AND e.poi_address_snapshot=p.addr AND e.poi_lat_snapshot=p.map_y AND e.poi_lon_snapshot=p.map_x;
