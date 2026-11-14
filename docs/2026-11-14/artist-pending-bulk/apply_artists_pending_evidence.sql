-- SEVENTEEN 외 후보 장소가 있는 아티스트 18명의 연결 장소를 '검수 대기(PENDING)' 근거로 운영 DB에 올린다.
-- 민아님 승인(2026-11-14): "1번(18명 일괄 '확인 필요' 업로드) 진행해줘".
-- SEVENTEEN(2026-11-12, docs/2026-11-12/seventeen-review/apply_seventeen_pending_evidence.sql)과 같은 규칙이다.
-- 근거는 2023 공공데이터(한국문화정보원 미디어콘텐츠 영상 촬영지, data.go.kr 15111405)의 기재 내용뿐이며
-- 공식 출처 대조 전이다. VERIFIED가 아니므로 추천 코스(verified_visit_catalog)에는 들어가지 않고,
-- 지도·목록에서 '확인 필요'로만 표시된다.
-- 대상: V125가 2026-10-25 감사 기준으로 넣은 아티스트-콘텐츠 연결(identity_basis 고정 문구)뿐.
--   SEVENTEEN(artist 3)은 이미 처리되어 제외하고, 숨김(approved_yn<>'Y') 아티스트(예: seventeen-mingyu)도 제외한다.
-- 한 아티스트에 같은 장소가 여러 콘텐츠로 걸려 있으면(EXO 등) 근거는 1행만 만든다(가장 작은 content_sqno).
-- 종류(action) 판정은 SEVENTEEN 규칙에 '뮤비·MV·티저(=MV)', '재킷·컨셉포토(=ALBUM_PHOTO)', '트위터·위버스(=SNS)'를 더했다.
--   이 18명 데이터에는 이 표기가 많아서다. SEVENTEEN 행은 건드리지 않는다.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f this_file   (단일 트랜잭션, 재실행 안전)

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

DO $$
DECLARE
  expected CONSTANT text[] := ARRAY['bts','blackpink','TWICE','EXO','NCT','Red Velvet','아이유(IU)',
    'TOMORROW X TOGETHER','G-DRAGON','(여자)아이들','DAY6','ATEEZ','임영웅','ITZY','Stray Kids',
    '악뮤(AKMU)','성시경','ive'];
  found text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version='125' AND success) THEN
    RAISE EXCEPTION 'V125 is not applied';
  END IF;
  SELECT array_agg(DISTINCT a.slug ORDER BY a.slug) INTO found
  FROM holy_content_artist hca JOIN artist a USING (artist_id)
  WHERE hca.identity_basis = '2026-10-25 audited explicit identity; no visit verification'
    AND a.approved_yn = 'Y' AND a.slug <> 'seventeen';
  IF found IS DISTINCT FROM (SELECT array_agg(s ORDER BY s) FROM unnest(expected) s) THEN
    RAISE EXCEPTION 'audited artist set differs from the 18 expected: %', found;
  END IF;
  -- 아래에서 번호로 빼는 장소가 운영에서도 같은 장소인지 확인(번호·이름이 다르면 중단).
  IF EXISTS (SELECT 1 FROM tmp_excluded x WHERE NOT EXISTS (
      SELECT 1 FROM artist a
      JOIN holy_content_artist hca ON hca.artist_id = a.artist_id
       AND hca.identity_basis = '2026-10-25 audited explicit identity; no visit verification'
      JOIN holy_content_poi hcp ON hcp.content_sqno = hca.content_sqno
      JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
      WHERE a.slug = x.slug AND p.poi_sqno = x.poi_sqno AND p.title = x.title)) THEN
    RAISE EXCEPTION 'excluded (artist, poi) pairs do not match this database';
  END IF;
END $$;

INSERT INTO artist_place_evidence (
  content_sqno, artist_id, poi_sqno,
  poi_name_snapshot, poi_address_snapshot, poi_lat_snapshot, poi_lon_snapshot,
  action, source_url, artist_evidence, place_evidence, action_evidence, locator, status)
SELECT DISTINCT ON (a.artist_id, p.poi_sqno)
  hcp.content_sqno, a.artist_id, p.poi_sqno,
  p.title, p.addr, p.map_y, p.map_x,
  CASE
    WHEN p.recommend_reason ~ '(뮤직비디오|뮤비|M/V|티저|파트스위치|acoustic|안무|스페셜영상)'
      OR p.recommend_reason ~ '(^|[^A-Za-z])MV([^A-Za-z]|$)' THEN 'MV'
    WHEN p.recommend_reason ~ '(자켓|재킷|화보|컨셉포토|컨셉 포토)' THEN 'ALBUM_PHOTO'
    WHEN p.recommend_reason ~* '(인스타|SNS|트위터|twitter|위버스)' THEN 'SNS'
    ELSE 'CONTENT_VISIT'
  END,
  'https://www.data.go.kr/data/15111405/fileData.do',
  '2023 공공데이터 기재: ' || a.name_ko || '. 공식 채널·방송 원본과 대조하지 않았음.',
  '데이터셋의 장소명·주소를 그대로 사용. 현재 영업·상호 동일성 미확인.',
  COALESCE(NULLIF(trim(p.recommend_reason),''),'데이터셋 설명 없음'),
  'kcisa_media_2023 ' || p.content_id || COALESCE(' tmp_poi_id=' || (p.raw_json->>'tmp_poi_id'), ''),
  'PENDING'
FROM holy_content_artist hca
JOIN artist a ON a.artist_id = hca.artist_id AND a.approved_yn = 'Y' AND a.slug <> 'seventeen'
JOIN holy_content_poi hcp ON hcp.content_sqno = hca.content_sqno
JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
WHERE hca.identity_basis = '2026-10-25 audited explicit identity; no visit verification'
  AND p.map_y IS NOT NULL AND p.map_x IS NOT NULL AND p.addr IS NOT NULL
  AND p.content_id IS NOT NULL
  AND NULLIF(trim(p.addr), '') IS NOT NULL
  AND p.review_status = 'APPROVED'
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = a.artist_id)
  AND EXISTS (SELECT 1 FROM tmp_dataset_name m WHERE m.slug = a.slug AND m.ds = p.artist)
  AND NOT EXISTS (SELECT 1 FROM tmp_excluded x WHERE x.slug = a.slug AND x.poi_sqno = p.poi_sqno)
ORDER BY a.artist_id, p.poi_sqno, hcp.content_sqno;

-- 결과 1: 아티스트별 근거 행 수(상태·종류별).
SELECT a.slug, e.status, e.action, count(*)
FROM artist_place_evidence e JOIN artist a USING (artist_id)
GROUP BY 1,2,3 ORDER BY 1,2,3;
-- 결과 2: 연결은 됐지만 올리지 않은 장소(다른 이름으로 적힘·제외 목록·좌표 누락). 사람이 훑어볼 목록.
SELECT a.slug, p.poi_sqno, p.title, p.artist AS dataset_artist
FROM holy_content_artist hca
JOIN artist a ON a.artist_id = hca.artist_id AND a.approved_yn = 'Y' AND a.slug <> 'seventeen'
JOIN holy_content_poi hcp ON hcp.content_sqno = hca.content_sqno
JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
WHERE hca.identity_basis = '2026-10-25 audited explicit identity; no visit verification'
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = a.artist_id)
ORDER BY 1,2;
