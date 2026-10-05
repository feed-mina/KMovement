-- F6-B also protects the old SDUI SQL fallback. V103 itself remains immutable.
-- Runtime event screens use the existing REST API; this is for older clients.
UPDATE query_master
SET query_text = CASE
        WHEN query_text LIKE '%a.approved_yn%' THEN query_text
        ELSE REPLACE(query_text,
            'WHERE e.approved_yn = ''Y''',
            'WHERE e.approved_yn = ''Y'' AND a.approved_yn = ''Y''')
    END,
    use_redis_yn = 'N',
    updated_at = NOW()
WHERE sql_key IN ('kpop_event_cards', 'kpop_event_detail');
