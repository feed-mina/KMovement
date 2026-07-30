-- return_type 이 비어 있거나 허용되지 않은 값이라 /api/execute 가 500으로 실패하던 쿼리를 고친다.
--
-- CommonQueryController 는 return_type 이 SINGLE/MULTI/COMMAND 중 하나가 아니면
-- QUERY_CONFIGURATION_ERROR("The query return type is not configured safely.") 로 500을 반환한다.
-- V53 은 kride_artist_list / kride_region_list 를 return_type 없이 INSERT 했고, 이후 이 안전장치가
-- 추가되면서 KRIDE_INTRO2 / KRIDE_INTRO3 진입이 alert 와 함께 실패하게 됐다.
--
-- 아래 쿼리는 모두 행 목록을 반환하고, 이를 소비하는 컴포넌트도 배열을 기대하는 리피터 GROUP 이다.
--   kride_artist_list  -> KRIDE_INTRO2.intro2_artist_grid (GROUP, ref_data_id='artists')
--   kride_region_list  -> KRIDE_INTRO3.intro3_region_grid (GROUP, ref_data_id='regions')
--   GET_ADMIN_STATS    -> MAIN_PAGE.admin_stats_row       (GROUP, ref_data_id='admin_stats_source')
--   GET_SYSTEM_LOGS    -> MAIN_PAGE.admin_logs_list       (GROUP, ref_data_id='admin_logs_source')
--   GET_FANBOARD_LIST  -> 현재 참조하는 화면 없음. 'LIST' 는 허용되지 않는 값이라 함께 정정한다.

UPDATE query_master
SET return_type = 'MULTI',
    updated_at = NOW()
WHERE sql_key IN (
        'kride_artist_list',
        'kride_region_list',
        'GET_ADMIN_STATS',
        'GET_SYSTEM_LOGS',
        'GET_FANBOARD_LIST'
    )
  AND (
        return_type IS NULL
        OR UPPER(BTRIM(return_type)) NOT IN ('SINGLE', 'MULTI', 'COMMAND')
    );

-- 남아 있는 잘못된 설정이 있으면 배포 로그에 남긴다.
DO $$
DECLARE
    unsafe_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unsafe_count
    FROM query_master
    WHERE return_type IS NULL
       OR UPPER(BTRIM(return_type)) NOT IN ('SINGLE', 'MULTI', 'COMMAND');

    IF unsafe_count > 0 THEN
        RAISE WARNING 'V116: % query_master row(s) still have an unusable return_type', unsafe_count;
    END IF;
END $$;
