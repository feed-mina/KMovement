UPDATE query_master
SET query_text =
  'INSERT INTO content (
       user_sqno, user_id, title, content, emotion,
       selected_times, daily_slots, day_tag1, day_tag2, day_tag3,
       is_private, reg_dt
   ) VALUES (
       :userSqno, :userId, :title, :content, CAST(:emotion AS INTEGER),
       CAST(:selected_times AS jsonb), CAST(:daily_slots AS jsonb),
       :day_tag1, :day_tag2, :day_tag3,
       COALESCE(CAST(:is_private AS BOOLEAN), false), NOW()
   )'
WHERE sql_key = 'INSERT_CONTENT';

UPDATE query_master
SET query_text =
  'UPDATE content
      SET title          = :title,
          content        = :content,
          emotion        = CAST(:emotion AS INTEGER),
          selected_times = CAST(:selected_times AS jsonb),
          daily_slots    = CAST(:daily_slots AS jsonb),
          day_tag1       = :day_tag1,
          day_tag2       = :day_tag2,
          day_tag3       = :day_tag3,
          is_private     = COALESCE(CAST(:is_private AS BOOLEAN), false)
    WHERE content_id     = CAST(:content_id AS BIGINT)
      AND user_sqno      = :userSqno'
WHERE sql_key = 'UPDATE_CONTENT_DETAIL';
