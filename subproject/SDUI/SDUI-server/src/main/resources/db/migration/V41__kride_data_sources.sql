-- V41: KRIDE 온보딩 화면 정적 데이터 소스 추가
-- INTRO2(아티스트), INTRO3(지역), INTRO4(여행 목적) Repeater용 DATA_SOURCE + query_master 항목

-- =============================================
-- query_master: 정적 SELECT 쿼리 등록
-- =============================================

INSERT INTO query_master (sql_key, query_text, return_type, description, created_at)
VALUES
(
  'kride_artist_list',
  'SELECT id, name, ''''::text AS "imageUrl" FROM (VALUES (1,''BTS''),(2,''BLACKPINK''),(3,''IVE''),(4,''aespa''),(5,''NewJeans''),(6,''TWICE''),(7,''EXO''),(8,''STRAY KIDS''),(9,''SEVENTEEN''),(10,''LE SSERAFIM'')) AS t(id, name)',
  'MULTI', 'KRIDE 아티스트 목록 (정적)', NOW()
),
(
  'kride_region_list',
  'SELECT id, name, ''''::text AS "imageUrl" FROM (VALUES (1,''서울''),(2,''부산''),(3,''제주''),(4,''경주''),(5,''인천''),(6,''강원''),(7,''여수''),(8,''전주''),(9,''춘천''),(10,''속초''),(11,''대구''),(12,''광주'')) AS t(id, name)',
  'MULTI', 'KRIDE 지역 목록 (정적)', NOW()
),
(
  'kride_purpose_list',
  'SELECT "purposeKey" FROM (VALUES (''food''),(''kculture''),(''nature''),(''history''),(''shopping''),(''rest'')) AS t("purposeKey")',
  'MULTI', 'KRIDE 여행 목적 목록 (정적)', NOW()
)
ON CONFLICT (sql_key) DO NOTHING;

-- =============================================
-- ui_metadata: 각 INTRO 화면에 DATA_SOURCE 컴포넌트 추가
-- component_id = ref_data_id 와 일치해야 pageData['artistList'] 등에 매핑됨
-- =============================================

INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, action_type, data_sql_key, is_visible)
VALUES
('KRIDE_INTRO2', 'artistList',  'DATA_SOURCE', '', 99, 'AUTO_FETCH', 'kride_artist_list',  true),
('KRIDE_INTRO3', 'regionList',  'DATA_SOURCE', '', 99, 'AUTO_FETCH', 'kride_region_list',  true),
('KRIDE_INTRO4', 'purposeList', 'DATA_SOURCE', '', 99, 'AUTO_FETCH', 'kride_purpose_list', true);
