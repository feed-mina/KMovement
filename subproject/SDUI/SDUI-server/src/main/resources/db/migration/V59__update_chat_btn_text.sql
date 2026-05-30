-- ─────────────────────────────────────────────────────────────────────────────
-- V59__update_chat_btn_text.sql
-- KRIDE_FOCUS 화면의 하단 채팅 진입 버튼 텍스트 변경
-- "AI 여행봇과 상담" -> "AI 여행봇 채팅"
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE ui_metadata
SET label_text = 'AI 여행봇 채팅'
WHERE screen_id = 'KRIDE_FOCUS' 
  AND component_id = 'focus_chat_btn';

COMMIT;
