-- ─────────────────────────────────────────────────────────────────────────────
-- V50__kride_chat_screen.sql
-- KRIDE_CHAT 화면 메타데이터 등록.
--
-- 단일 component_type 'KRIDE_CHAT' 만 사용 — 채팅 UI 전체는 React 컴포넌트
-- 내부에서 자체 렌더 (AIChatComponentV2 패턴 동일).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- chat_root: 화면 컨테이너. KrideChatComponent.tsx 가 meta.labelText 를 헤더 타이틀로 사용.
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   order_index, ref_data_id, parent_id, layout_direction,
   css_class, image_url, action_type, link_url, ref_field, visible, validation)
VALUES
  ('KRIDE_CHAT', 'chat_root', 'KRIDE_CHAT', 'K-RIDE 여행봇',
   1, 'chat_root', NULL, NULL,
   'kride-chat-container', NULL, NULL, NULL, NULL, true, NULL);

-- screenMap.ts 에서도 경로 매핑 필요:
--   "/CHAT": "KRIDE_CHAT"
-- (이는 SQL 이 아니라 metadata-project/components/constants/screenMap.ts 수정)

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 검증
--   1. Redis 캐시 flush (docker exec sdui-redis redis-cli FLUSHDB)
--   2. curl http://localhost:8080/api/ui/KRIDE_CHAT
--   3. /view/KRIDE_CHAT 진입 → 챗봇 UI 노출 확인
-- ─────────────────────────────────────────────────────────────────────────────

-- 롤백:
--   DELETE FROM ui_metadata WHERE screen_id = 'KRIDE_CHAT';
