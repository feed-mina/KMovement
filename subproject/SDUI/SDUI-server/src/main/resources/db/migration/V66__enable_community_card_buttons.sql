-- Community card buttons were inserted without is_readonly, so the column
-- default made them render as disabled buttons in the frontend.
UPDATE ui_metadata
SET is_readonly = FALSE,
    component_type = 'BUTTON',
    action_type = 'LINK',
    action_url = '/view/COMMUNITY_LIST'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id IN (
      'main_bento_community_btn',
      'main_bento_community_btn_g'
  );
