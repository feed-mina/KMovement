-- 2026-11-14 운영에 18명 후보 566곳이 데이터셋 표기 확인 없이 PENDING으로 올라갔다(apply_artists_pending_evidence.sql 이전 판).
-- 그중 데이터셋에 다른 가수·드라마·예능으로 적힌 166곳을 REVOKED로 내리고(삭제 아님),
-- 남은 400곳의 종류(action)를 개선된 규칙(뮤비·MV·티저 / 재킷·컨셉포토 / 트위터·위버스)으로 다시 매긴다.
-- 결과는 apply_artists_pending_evidence.sql 현재 판을 빈 상태에서 돌린 것과 같다(PENDING 400).
-- 민아님 승인 후에만 실행. 실행: psql -v ON_ERROR_STOP=1 -1 -f this_file

-- 데이터셋(tour_poi.artist)에 적힌 이름 ↔ 아티스트. 이 이름으로 적힌 장소만 올린다.
-- holy_content_poi 연결에는 다른 가수·드라마·예능 장소가 섞여 있어서다(약 150곳).
CREATE TEMP TABLE tmp_dataset_name(slug text, ds text) ON COMMIT DROP;
INSERT INTO tmp_dataset_name VALUES
  ('bts','방탄소년단'),('blackpink','블랙핑크'),('TWICE','트와이스'),('EXO','엑소'),('EXO','EXO'),
  ('NCT','NCT'),('Red Velvet','레드벨벳'),('아이유(IU)','아이유'),('TOMORROW X TOGETHER','TXT'),
  ('G-DRAGON','지드래곤'),('(여자)아이들','여자아이들'),('DAY6','Day6'),('ATEEZ','ATEEZ'),
  ('임영웅','임영웅'),('ITZY','Itzy'),('Stray Kids','스트레이키즈'),('악뮤(AKMU)','악뮤'),
  ('성시경','성시경'),('ive','아이브');

-- 데이터셋 이름은 맞지만 설명이 드라마 장면이나 다른 사람 이야기인 장소(번호+이름으로 고정).
CREATE TEMP TABLE tmp_excluded(slug text, poi_sqno bigint, title text, why text) ON COMMIT DROP;
INSERT INTO tmp_excluded VALUES
  ('ATEEZ',1517,'삼청동 코리아게스트 하우스','드라마 7회 이시우(송강) 장면'),
  ('EXO',942,'경기영어마을 파주캠퍼스','드라마 차현(이다희)·설지환(이재욱) 장면'),
  ('EXO',2273,'강촌레일파크','드라마 더 킹 장면'),
  ('ITZY',6847,'인생네컷 종로익선동한옥거리점','드라마 6회 앤서니(음문석) 장면'),
  ('NCT',986,'울프강 스테이크 하우스','드라마 5화 경우연(신예은) 장면'),
  ('NCT',1206,'망원한강공원','드라마 6회 방명수(변요한) 장면'),
  ('NCT',4299,'두리랜드','보아와 손현주가 방문'),
  ('TOMORROW X TOGETHER',7096,'우텐더','지호 출연 수요미식회 158회'),
  ('TOMORROW X TOGETHER',7673,'최인아 책방','드라마 6회 윤태오(지수) 장면');

CREATE TEMP TABLE tmp_target AS
SELECT e.evidence_id,
  (EXISTS (SELECT 1 FROM tmp_dataset_name m WHERE m.slug = a.slug AND m.ds = p.artist)
   AND NOT EXISTS (SELECT 1 FROM tmp_excluded x WHERE x.slug = a.slug AND x.poi_sqno = p.poi_sqno)) AS keep
FROM artist_place_evidence e
JOIN artist a ON a.artist_id = e.artist_id AND a.approved_yn = 'Y' AND a.slug <> 'seventeen'
JOIN tour_poi p ON p.poi_sqno = e.poi_sqno
WHERE e.status = 'PENDING' AND e.source_url = 'https://www.data.go.kr/data/15111405/fileData.do';

DO $$
DECLARE k int; r int;
BEGIN
  IF EXISTS (SELECT 1 FROM tmp_excluded x WHERE NOT EXISTS (
      SELECT 1 FROM artist a
      JOIN holy_content_artist hca ON hca.artist_id = a.artist_id
       AND hca.identity_basis = '2026-10-25 audited explicit identity; no visit verification'
      JOIN holy_content_poi hcp ON hcp.content_sqno = hca.content_sqno
      JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
      WHERE a.slug = x.slug AND p.poi_sqno = x.poi_sqno AND p.title = x.title)) THEN
    RAISE EXCEPTION 'excluded (artist, poi) pairs do not match this database';
  END IF;
  SELECT count(*) FILTER (WHERE keep), count(*) FILTER (WHERE NOT keep) INTO k, r FROM tmp_target;
  IF k <> 400 OR r <> 166 THEN
    RAISE EXCEPTION 'expected keep 400 / revoke 166, found keep % / revoke %', k, r;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'REVOKED', revoked_at = now(),
    revoked_by = '2026-11-14 데이터셋 표기 대조: 다른 가수·드라마·예능 장소'
FROM tmp_target t
WHERE e.evidence_id = t.evidence_id AND NOT t.keep;

UPDATE artist_place_evidence e
SET action = CASE
    WHEN p.recommend_reason ~ '(뮤직비디오|뮤비|M/V|티저|파트스위치|acoustic|안무|스페셜영상)'
      OR p.recommend_reason ~ '(^|[^A-Za-z])MV([^A-Za-z]|$)' THEN 'MV'
    WHEN p.recommend_reason ~ '(자켓|재킷|화보|컨셉포토|컨셉 포토)' THEN 'ALBUM_PHOTO'
    WHEN p.recommend_reason ~* '(인스타|SNS|트위터|twitter|위버스)' THEN 'SNS'
    ELSE 'CONTENT_VISIT'
  END
FROM tmp_target t, tour_poi p
WHERE e.evidence_id = t.evidence_id AND t.keep AND p.poi_sqno = e.poi_sqno;

DROP TABLE tmp_target;

SELECT a.slug, e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE a.approved_yn = 'Y' AND a.slug <> 'seventeen' GROUP BY 1,2 ORDER BY 1,2;
SELECT e.action, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id)
WHERE a.approved_yn = 'Y' AND a.slug <> 'seventeen' AND e.status = 'PENDING' GROUP BY 1 ORDER BY 1;
