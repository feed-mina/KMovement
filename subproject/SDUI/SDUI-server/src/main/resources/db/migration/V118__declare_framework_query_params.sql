-- V118__declare_framework_query_params.sql
-- 프레임워크 파라미터(pageSize/offset/filterId/contentId)를 메타데이터가 선언하게 한다.
--
-- 배경: 프론트가 sql_key 접두사로 "이 쿼리는 페이징을 쓸 것이다"를 추측해 왔다.
-- 백엔드 QueryParameterPolicy 는 param_mapping 에 없는 파라미터를 거절하므로,
-- 추측이 틀리면 QUERY_PARAMETER_NOT_ALLOWED 로 화면이 통째로 실패한다.
-- mypage_ 에서 한 번(aeba6bb), admin_ 에서 또 한 번 같은 사고가 났다.
--
-- 이제 프론트는 component_props.frameworkParams 에 적힌 것만 보낸다.
-- 선언이 없으면 아무것도 보내지 않는다 — 모르면 안 보내는 쪽이 안전하다.
--
-- 선언은 손으로 나열하지 않고 query_master 의 SQL 본문에서 끌어낸다.
-- SQL 이 :pageSize 를 쓰면 그 소스는 pageSize 를 선언해야 한다는 뜻이고,
-- 이 둘이 어긋날 수 없게 하는 것이 이 마이그레이션의 목적이다.

BEGIN;

UPDATE ui_metadata m
SET component_props = COALESCE(m.component_props, '{}'::jsonb)
    || jsonb_build_object('frameworkParams', needed.params)
FROM (
    SELECT
        q.sql_key,
        (
            SELECT jsonb_agg(name ORDER BY ord)
            FROM (
                VALUES
                    ('pageSize', 1), ('offset', 2), ('filterId', 3), ('contentId', 4)
            ) AS candidate(name, ord)
            WHERE q.query_text LIKE '%:' || candidate.name || '%'
        ) AS params
    FROM query_master q
) AS needed
WHERE m.data_sql_key = needed.sql_key
  AND needed.params IS NOT NULL;

COMMIT;
