-- MAIN_PAGE tutorial cleanup and AI language chat cards.
-- Keep the cards visible to guests so selecting one can route them to login.

UPDATE ui_metadata
SET is_visible = 'false'
WHERE screen_id IN ('MAIN_PAGE', 'SIDE_MENU')
  AND component_id IN (
      'go_tutorial_btn',
      'menu_tutorial',
      'MAIN_TUTORIAL_CARD',
      'TUTORIAL_LEFT_CONTENT',
      'tutorial_card_title',
      'tutorial_card_desc',
      'main_bento_tutorial_btn'
  );

INSERT INTO ui_metadata (
    screen_id,
    component_id,
    component_type,
    parent_group_id,
    label_text,
    css_class,
    group_direction,
    allowed_roles,
    sort_order,
    is_visible
)
SELECT
    'MAIN_PAGE',
    'main_ai_chat_grid',
    'GROUP',
    'MAIN_SECTION',
    '',
    'main-ai-chat-grid col-span-3',
    'ROW',
    'ROLE_GUEST,ROLE_USER',
    40,
    'true'
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE'
      AND component_id = 'main_ai_chat_grid'
);

UPDATE ui_metadata
SET parent_group_id = 'main_ai_chat_grid',
    label_text = '',
    css_class = 'bento-card bento-card-ai bento-card-ai-en',
    group_direction = 'COLUMN',
    action_type = 'LINK',
    action_url = '/view/AI_ENGLISH_CHAT_PAGE',
    allowed_roles = 'ROLE_GUEST,ROLE_USER',
    sort_order = 41,
    is_visible = 'true'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id = 'main_bento_tutorial_grp';

UPDATE ui_metadata
SET allowed_roles = 'ROLE_GUEST,ROLE_USER',
    sort_order = 42,
    is_visible = 'true'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id = 'main_bento_tutorial_body';

UPDATE ui_metadata
SET label_text = 'AI 영어 채팅',
    css_class = 'bento-card-title premium-badge',
    allowed_roles = 'ROLE_GUEST,ROLE_USER',
    sort_order = 43,
    is_visible = 'true'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id = 'main_bento_tutorial_title';

UPDATE ui_metadata
SET label_text = 'AI와 영어 대화 연습을 시작해요.',
    allowed_roles = 'ROLE_GUEST,ROLE_USER',
    sort_order = 44,
    is_visible = 'true'
WHERE screen_id = 'MAIN_PAGE'
  AND component_id = 'main_bento_tutorial_desc';

INSERT INTO ui_metadata (
    screen_id,
    component_id,
    component_type,
    parent_group_id,
    label_text,
    css_class,
    group_direction,
    action_type,
    action_url,
    allowed_roles,
    sort_order,
    is_visible
)
SELECT
    'MAIN_PAGE',
    'main_bento_ai_japanese_grp',
    'GROUP',
    'main_ai_chat_grid',
    '',
    'bento-card bento-card-ai bento-card-ai-ja',
    'COLUMN',
    'LINK',
    '/view/AI_JAPANESE_CHAT_PAGE',
    'ROLE_GUEST,ROLE_USER',
    46,
    'true'
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE'
      AND component_id = 'main_bento_ai_japanese_grp'
);

INSERT INTO ui_metadata (
    screen_id,
    component_id,
    component_type,
    parent_group_id,
    label_text,
    css_class,
    group_direction,
    allowed_roles,
    sort_order,
    is_visible
)
SELECT
    'MAIN_PAGE',
    'main_bento_ai_japanese_body',
    'GROUP',
    'main_bento_ai_japanese_grp',
    '',
    'bento-card-body',
    'COLUMN',
    'ROLE_GUEST,ROLE_USER',
    47,
    'true'
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE'
      AND component_id = 'main_bento_ai_japanese_body'
);

INSERT INTO ui_metadata (
    screen_id,
    component_id,
    component_type,
    parent_group_id,
    label_text,
    css_class,
    allowed_roles,
    sort_order,
    is_visible
)
SELECT
    'MAIN_PAGE',
    'main_bento_ai_japanese_title',
    'TEXT',
    'main_bento_ai_japanese_body',
    'AI 일본어 채팅',
    'bento-card-title premium-badge',
    'ROLE_GUEST,ROLE_USER',
    48,
    'true'
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE'
      AND component_id = 'main_bento_ai_japanese_title'
);

INSERT INTO ui_metadata (
    screen_id,
    component_id,
    component_type,
    parent_group_id,
    label_text,
    css_class,
    allowed_roles,
    sort_order,
    is_visible
)
SELECT
    'MAIN_PAGE',
    'main_bento_ai_japanese_desc',
    'TEXT',
    'main_bento_ai_japanese_body',
    'AI와 일본어 대화 연습을 시작해요.',
    'bento-card-desc',
    'ROLE_GUEST,ROLE_USER',
    49,
    'true'
WHERE NOT EXISTS (
    SELECT 1
    FROM ui_metadata
    WHERE screen_id = 'MAIN_PAGE'
      AND component_id = 'main_bento_ai_japanese_desc'
);
