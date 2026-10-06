-- V123: KRIDE_INTRO2(아티스트 선택) 벤치마킹 G3 반영.
--
-- 근거: work-map-guide/ui-benchmark-20261006-165751-six-screens/kride-six-screens-ui-spec.md §3-2
--   1) 선택 수/상한 카운터가 없었다 → KRIDE_SELECT_COUNT 행 추가 ("2 / 5 선택")
--      (ui_metadata.component_type 은 varchar(20) → 20자 이하 이름만 가능)
--   2) 다음 버튼에 하한 검사가 없었다 → component_props 로 checkKey/minCount 부여
--      (프론트 KrideNextButton 은 하한 미만이면 숨기지 않고 비활성 + 이유 문구로 보여준다)
--   3) 부제 문구에 하한을 함께 적는다
--   4) V56 이 준 이미지 경로 중 존재하지 않는 .png 를 바로잡고, 실제로 존재하는 jpg 를 추가로 매핑한다
--      (public/artists 에 있는 파일만. 없는 아티스트 12명은 브랜드 톤 이니셜 폴백으로 표시)
--
-- DDL 없음. ui_metadata / query_master 행만 수정한다. Redis 화면 캐시는 갱신 지연이 있을 수 있다.

BEGIN;

-- 1) 그리드 이후 형제들의 sort_order 를 뒤로 밀고 카운터를 끼워 넣는다
UPDATE ui_metadata
SET sort_order = sort_order + 10
WHERE screen_id = 'KRIDE_INTRO2'
  AND parent_group_id = 'intro2_root'
  AND sort_order >= 4;

DELETE FROM ui_metadata WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'intro2_counter';

INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text, sort_order, ref_data_id, parent_group_id,
   group_direction, css_class, action_type, action_url, data_api_url, data_sql_key, is_readonly, is_visible, component_props)
VALUES
  ('KRIDE_INTRO2', 'intro2_counter', 'KRIDE_SELECT_COUNT', '', 4, NULL, 'intro2_root',
   NULL, '', NULL, NULL, NULL, NULL, true, 'true',
   '{"checkKey":"selectedArtists","min":1,"max":5,"unit":"명"}');

-- 2) 다음 버튼: 1명 이상 골라야 활성
UPDATE ui_metadata
SET component_props = '{"checkKey":"selectedArtists","minCount":1,"unit":"명"}'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'intro2_next';

-- 3) 부제
UPDATE ui_metadata
SET label_text = '1명 이상, 최대 5명까지 고를 수 있어요'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'intro2_sub';

-- 4) 이미지 경로 정정 (존재하는 파일만 매핑)
UPDATE query_master
SET query_text = 'SELECT id, name,
  CASE
    WHEN name = ''BTS'' THEN ''/artists/BTS.jpg''
    WHEN name = ''BLACKPINK'' THEN ''/artists/BLACKPINK.jpg''
    WHEN name = ''EXO'' THEN ''/artists/EXO.jpg''
    WHEN name = ''TWICE'' THEN ''/artists/TWICE.jpg''
    WHEN name = ''SEVENTEEN'' THEN ''/artists/SEVENTEEN.jpg''
    WHEN name = ''aespa'' THEN ''/artists/aespa.jpg''
    WHEN name = ''Stray Kids'' THEN ''/artists/Stray Kids.jpg''
    WHEN name = ''IVE'' THEN ''/artists/IVE.jpg''
    WHEN name = ''NewJeans'' THEN ''/artists/NewJeans.jpg''
    WHEN name = ''LE SSERAFIM'' THEN ''/artists/LE SSERAFIM.jpg''
    WHEN name = ''NCT 127'' THEN ''/artists/NCT 127.jpg''
    WHEN name = ''Red Velvet'' THEN ''/artists/Red Velvet.jpg''
    WHEN name = ''GOT7'' THEN ''/artists/GOT7.jpg''
    WHEN name = ''MAMAMOO'' THEN ''/artists/MAMAMOO.jpg''
    WHEN name = ''ATEEZ'' THEN ''/artists/ATEEZ.jpg''
    WHEN name = ''ITZY'' THEN ''/artists/ITZY.jpg''
    WHEN name = ''SHINee'' THEN ''/artists/SHINee.jpg''
    WHEN name = ''BTOB'' THEN ''/artists/BTOB.jpg''
    ELSE ''''
  END AS "imageUrl"
FROM (VALUES
  (1,''BTS''),(2,''BLACKPINK''),(3,''EXO''),(4,''TWICE''),(5,''SEVENTEEN''),
  (6,''aespa''),(7,''Stray Kids''),(8,''IVE''),(9,''NewJeans''),(10,''LE SSERAFIM''),
  (11,''NCT 127''),(12,''Red Velvet''),(13,''GOT7''),(14,''MAMAMOO''),(15,''ATEEZ''),
  (16,''TXT''),(17,''ENHYPEN''),(18,''ITZY''),(19,''(G)I-DLE''),(20,''MONSTA X''),
  (21,''SHINee''),(22,''WINNER''),(23,''iKON''),(24,''DAY6''),(25,''BTOB''),
  (26,''ASTRO''),(27,''THE BOYZ''),(28,''Kep1er''),(29,''NMIXX''),(30,''TREASURE'')
) AS t(id, name)',
    updated_at = NOW()
WHERE sql_key = 'kride_artist_list';

COMMIT;

-- 검증
--   curl .../api/ui/KRIDE_INTRO2 | jq '.[] | select(.componentId=="intro2_counter")'
--   /view/INTRO2 진입 → "0 / 5 선택" 카운터, 다음 버튼 비활성 + "1명 이상 골라야…" 문구
-- 롤백
--   DELETE FROM ui_metadata WHERE screen_id='KRIDE_INTRO2' AND component_id='intro2_counter';
--   UPDATE ui_metadata SET component_props=NULL WHERE screen_id='KRIDE_INTRO2' AND component_id='intro2_next';
