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
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = a.artist_id)
  -- 데이터셋 설명이 다른 사람을 가리키는 5건은 '확인 필요'로도 띄우지 않는다(README 참고).
  AND (a.slug, p.title) NOT IN (
    ('NCT','볼하우스 한남'),            -- "제니와 리사가 방문한 볼링장" = BLACKPINK
    ('EXO','성읍랜드'),                 -- "로꼬의 Summer Go Loco 뮤비" = 로꼬
    ('ITZY','파사주'),                  -- "제니퍼(예지원)가 셰프" = 드라마 배역
    ('ATEEZ','광안리해수욕장'),         -- "현재의 수현과 태호의 우정" = 드라마 장면
    ('Stray Kids','광안리해수욕장'))
ORDER BY a.artist_id, p.poi_sqno, hcp.content_sqno;

-- 결과 1: 아티스트별 근거 행 수(상태·종류별).
SELECT a.slug, e.status, e.action, count(*)
FROM artist_place_evidence e JOIN artist a USING (artist_id)
GROUP BY 1,2,3 ORDER BY 1,2,3;
-- 결과 2: 연결은 됐지만 근거가 없는 장소. 위에서 일부러 뺀 5행만 나와야 정상(그 외는 좌표·주소 누락 등).
SELECT a.slug, p.poi_sqno, p.title
FROM holy_content_artist hca
JOIN artist a ON a.artist_id = hca.artist_id AND a.approved_yn = 'Y'
JOIN holy_content_poi hcp ON hcp.content_sqno = hca.content_sqno
JOIN tour_poi p ON p.poi_sqno = hcp.poi_sqno
WHERE hca.identity_basis = '2026-10-25 audited explicit identity; no visit verification'
  AND NOT EXISTS (SELECT 1 FROM artist_place_evidence e WHERE e.poi_sqno = p.poi_sqno AND e.artist_id = a.artist_id)
ORDER BY 1,2;
