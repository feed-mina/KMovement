-- V45: INTRO4 서브타이틀을 단일 선택으로 변경
UPDATE ui_metadata
SET label_text = '1개만 선택할 수 있어요'
WHERE screen_id = 'KRIDE_INTRO4'
  AND component_id = 'intro4_sub';
