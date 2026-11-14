-- BTS 확정 검수 1묶음(2026-11-14): 민아님이 '비공식'으로 고른 7곳을 PENDING → UNOFFICIAL로 바꾼다.
-- 공식 자료·언론은 장소 이름을 밝히지 않았지만 팬 자료가 같은 곳을 가리키는 장소. 화면에는 '비공식' 배지가 붙는다.
-- 반드시 V126(UNOFFICIAL 상태 추가)이 들어간 Spring 이미지가 운영에 뜬 뒤 실행한다.
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_batch1_unofficial.sql
-- 되돌리기: 같은 7곳을 status='PENDING', reviewer=NULL 로 UPDATE.

CREATE TEMP TABLE tmp_unofficial(poi_sqno bigint, title text, why text) ON COMMIT DROP;
INSERT INTO tmp_unofficial VALUES
  (3675,'까사누아','Life Goes On MV 모닥불 장면 — 팬 자료(Casanoir)'),
  (3680,'형도','봄날 MV — 언론은 근처 우음도를 촬영지로 밝힘'),
  (3755,'월미도','For You MV — 팬 사이트 1곳'),
  (3685,'경주 역사 유적지구','화양연화 pt.1 — 출처 없는 언론 언급'),
  (3770,'환상숲곶자왈공원','화양연화 Pt.2 예고 — 관광정보 2차 사이트'),
  (3664,'내린천번지점프장','달려라 방탄 EP.9 — 언론은 업체 이름 없이 언급'),
  (3668,'AD646 펜션','달려라 방탄 피크닉·마피아 편 — 팬 자료');

DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_place_evidence_unofficial_reviewer_check') THEN
    RAISE EXCEPTION 'V126 is not applied yet (UNOFFICIAL status missing)';
  END IF;
  SELECT count(*) INTO n FROM tmp_unofficial x
  JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title
  JOIN artist_place_evidence e ON e.poi_sqno = p.poi_sqno AND e.status = 'PENDING'
  JOIN artist a ON a.artist_id = e.artist_id AND a.slug = 'bts';
  IF n <> 7 THEN
    RAISE EXCEPTION 'expected 7 PENDING BTS rows, found %', n;
  END IF;
END $$;

UPDATE artist_place_evidence e
SET status = 'UNOFFICIAL',
    reviewer = '민아 2026-11-14 BTS 1묶음 검수: 팬 자료만 확인 (' || x.why || ')'
FROM tmp_unofficial x, artist a
WHERE e.poi_sqno = x.poi_sqno AND e.artist_id = a.artist_id AND a.slug = 'bts' AND e.status = 'PENDING';

SELECT e.status, count(*) FROM artist_place_evidence e JOIN artist a USING (artist_id) WHERE a.slug = 'bts' GROUP BY 1 ORDER BY 1;
