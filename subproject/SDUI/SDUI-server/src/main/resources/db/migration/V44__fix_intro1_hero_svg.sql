-- V44: intro1_hero IMAGE label_text를 .svg 확장자로 수정
UPDATE ui_metadata
SET label_text = 'kride/intro1_hero.svg'
WHERE screen_id = 'KRIDE_INTRO1'
  AND component_id = 'intro1_hero';
