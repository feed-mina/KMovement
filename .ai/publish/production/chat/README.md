# KRIDE Chat — Production Handoff

`publish/KRIDE Chat.html` 프로토타입을 실제 SDUI 코드베이스에 적용하기 위한 파일들.

## 백엔드 API 확인 (변경 불필요)

- `POST /api/v1/kride/chat` — 통합 응답 `{intent, reply, pois, recommendationText, itinerary}`
- `POST /api/v1/kride/chat/stream` — SSE 텍스트 chunks
  - 이벤트: `data: {"content": "<chunk>"}` 반복 → 종료 시 `data: "[DONE]"`
  - **주의:** 스트리밍 엔드포인트는 텍스트 chunks 만 보냅니다. POI/itinerary 구조 데이터는 non-stream 엔드포인트 응답에만 포함.
- SecurityConfig: `/api/v1/kride/chat/**` → `permitAll`

## 권장 사용 패턴 (하이브리드)

```
유저 입력
  ↓
  intent 분류 (프론트에서 간단 판별 OR 백엔드 위임)
    ├─ "itinerary" / "recommend" → POST /chat (non-stream)
    │     → 텍스트는 즉시 표시 + POI/itinerary 카드 부착
    └─ "qa" (자유 질문)           → POST /chat/stream (SSE)
          → 토큰 단위 표시 (UX 향상)
```

이렇게 하면 일정/POI 같은 구조 데이터가 필요한 응답은 즉시 한 번에, 텍스트 위주의 Q&A는 스트리밍으로 자연스럽게 표시됩니다.

## 파일

| 파일 | 위치 | 용도 |
|---|---|---|
| `types.ts` | `metadata-project/lib/types/krideChat.ts` | DTO 타입 |
| `useKrideChatStream.ts` | `metadata-project/lib/hooks/` | 채팅 상태 + SSE/non-SSE 호출 |
| `KrideChatComponent.tsx` | `metadata-project/components/fields/kride/chat/` | SDUI 컨테이너 (AIChatComponentV2 대응) |
| `components/*.tsx` | 위 폴더 | 프레젠테이션 컴포넌트 (Header, Bubble, PoiCard, ItineraryCard, Composer 등) |
| `componentMap.patch.md` | — | `components/constants/componentMap.tsx` 에 추가할 매핑 안내 |
| `KRIDE_CHAT.css` | `app/styles/` | 채팅 전용 스타일 |
| `V50__kride_chat_screen.sql` | `SDUI-server/.../db/migration/` | ui_metadata 에 KRIDE_CHAT 화면 추가 |

## 적용 순서

1. **타입 + 훅 + 컴포넌트** 파일 복사 (위 표 위치)
2. **`componentMap.tsx`** 에 신규 component_type 매핑 추가 — `componentMap.patch.md` 참조
3. **`globals.css`** 에 `@import "./styles/KRIDE_CHAT.css";` 한 줄 추가
4. **V50 마이그레이션** 배치 → 백엔드 재시작 → Redis FLUSHDB
5. `/view/KRIDE_CHAT` 진입 확인

## 무수정 파일 (안전 보장)

- `next.config.ts`, `tailwind safelist`, `DynamicEngine 코어`, `SecurityConfig`
- 기존 `AIChatComponentV2.tsx` 및 `useAIChatLogic.ts` (별도 도메인 — 영어 튜터)
- `KRIDE.css` 기존 규칙 (.kride-artist-grid 등)
