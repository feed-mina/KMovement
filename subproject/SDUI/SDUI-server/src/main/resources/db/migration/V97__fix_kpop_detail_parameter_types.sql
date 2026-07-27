-- K-POP 상세 ID는 BIGINT 컬럼과 비교되므로 문자열이 아닌 long으로 바인딩한다.

UPDATE query_master
SET param_mapping = '{"contentId":"long"}',
    required_params = '["contentId"]',
    updated_at = NOW()
WHERE sql_key IN ('kpop_artist_detail', 'kpop_event_detail');