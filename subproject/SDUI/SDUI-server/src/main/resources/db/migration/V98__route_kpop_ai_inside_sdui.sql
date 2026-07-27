-- AI 의상 후보 흐름을 metadata-project 내부 SDUI 경로로 연결한다.

UPDATE ui_metadata
SET action_type = 'ROUTE',
    action_url = '/view/KPOP_AI_FIND',
    is_readonly = false
WHERE screen_id = 'KPOP_EXPLORE'
  AND component_id = 'kpop_ai_cta';