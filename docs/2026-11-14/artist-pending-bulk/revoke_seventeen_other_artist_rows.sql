-- 2026-11-12에 SEVENTEEN PENDING으로 올린 62곳 중, 데이터셋이 다른 가수·드라마·예능 장소로 적은 16곳을 REVOKED로 내린다.
-- (삭제가 아니라 상태만 바꾼다. '확인 필요' 배지는 PENDING만 보므로 지도·목록에서 SEVENTEEN 표시가 빠진다.)
-- 데이터셋 이름이 다르지만 실제로 SEVENTEEN 관련인 4곳(가평 리버하임 펜션=고잉세븐틴, 란수사=세븐틴 리얼리티,
-- 잔비워·우돈청=97즈 모임)은 PENDING으로 둔다.
-- 민아님 승인 후에만 실행. 실행: psql -v ON_ERROR_STOP=1 -1 -f this_file

CREATE TEMP TABLE tmp_revoke(poi_sqno bigint, title text, why text) ON COMMIT DROP;
INSERT INTO tmp_revoke VALUES
  (102,'협재해수욕장','1박2일 이승기'),
  (912,'동작대교','드라마 검법남녀 2'),
  (963,'계명대학교 대명캠퍼스','배우 강동원'),
  (977,'마로니에 공원','드라마 겨울연가'),
  (1115,'우리옛돌박물관','드라마 공항 가는 길'),
  (2212,'광안리해수욕장','드라마 장면'),
  (2248,'볼트 스테이크하우스','드라마 장면'),
  (2316,'월정사 전나무 숲길','드라마 도깨비'),
  (2429,'함덕해수욕장','다른 사람 브이로그'),
  (2530,'알베르','런닝맨 438회'),
  (2614,'성읍랜드','로꼬 뮤직비디오'),
  (3525,'청춘식당 미래소년','무한도전'),
  (3787,'메밀꽃필무렵','배틀트립'),
  (4395,'용두 휴게소','로제 뮤직비디오'),
  (4507,'베이힐풀앤빌라','빅스'),
  (4551,'연남장','드라마 사내맞선');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM tmp_revoke x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'seventeen';
  IF n <> 16 THEN
    RAISE EXCEPTION 'expected 16 PENDING SEVENTEEN rows to revoke, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '2026-11-14 데이터셋 표기 대조: 다른 가수·드라마·예능 장소'
FROM tmp_revoke x, artist a
WHERE e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'seventeen' AND e.status = 'PENDING';

SELECT status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug='seventeen' GROUP BY 1;
