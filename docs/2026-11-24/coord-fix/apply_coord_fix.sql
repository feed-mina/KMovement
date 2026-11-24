-- 좌표 미해결 2곳 정리 (2026-11-24)
--  7292 신전리 방파제('이번 생은 처음이라' 11화): 남해군 촬영은 경남매일(2017-11-09)·남해신문(2017-11-11) 보도로 확인.
--       저장된 좌표(34.770928, 127.9527)는 남해군 이동면 신전리(앵강만, 소상공인 상가정보 2025-12 신전리 업소 좌표와 일치)라 그대로 두고 주소만 고침.
--  1788 조이스커피숍('너도 인간이니' 21회): 주소(경주시 안강읍 안현로 1536)는 소상공인 상가정보 2025-12 등록 업소와 같음.
--       좌표만 그 등록 좌표(35.9922293, 129.2285632)로 고침(기존 좌표는 세종 조치원).
-- 실행: psql -v ON_ERROR_STOP=1 -1 -f apply_coord_fix.sql
-- 되돌리기: tmp_cf 의 old 값으로 tour_poi 와 근거 스냅숏을 되돌림.

CREATE TEMP TABLE tmp_cf(poi_sqno bigint, title text, old_addr text, old_lat double precision, old_lon double precision, new_lat double precision, new_lon double precision, new_addr text) ON COMMIT DROP;
INSERT INTO tmp_cf VALUES
  (7292,'신전리 방파제','전라남도 고흥군 금산면 신전리',34.770928,127.9527,34.770928,127.9527,'경상남도 남해군 이동면 신전리'),
  (1788,'조이스커피숍','경상북도 경주시 안강읍 안현로 1536',36.603148,127.29702,35.9922293,129.2285632,NULL);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM tmp_cf x JOIN tour_poi p ON p.poi_sqno = x.poi_sqno AND p.title = x.title AND p.addr = x.old_addr AND p.map_y = x.old_lat AND p.map_x = x.old_lon;
  IF n <> 2 THEN RAISE EXCEPTION 'expected 2 places with old values, found %', n; END IF;
END $$;

UPDATE tour_poi p SET map_y = x.new_lat, map_x = x.new_lon, addr = COALESCE(x.new_addr, p.addr), updated_at = now()
FROM tmp_cf x WHERE p.poi_sqno = x.poi_sqno AND p.map_y = x.old_lat AND p.map_x = x.old_lon AND p.addr = x.old_addr;

UPDATE artist_place_evidence e SET poi_lat_snapshot = p.map_y, poi_lon_snapshot = p.map_x, poi_address_snapshot = p.addr
FROM tmp_cf x JOIN tour_poi p ON p.poi_sqno = x.poi_sqno
WHERE e.poi_sqno = x.poi_sqno;

SELECT x.poi_sqno, p.title, p.map_y, p.map_x, p.addr FROM tmp_cf x JOIN tour_poi p USING (poi_sqno) ORDER BY 1;
