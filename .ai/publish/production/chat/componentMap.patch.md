# componentMap.tsx 패치 안내

`metadata-project/components/constants/componentMap.tsx` 에 추가할 매핑.

## 권장: 단일 component_type 등록

`AIChatComponentV2` 와 동일한 패턴 — 채팅 UI 전체를 **하나의 SDUI 컴포넌트**로 묶어 등록합니다. 헤더/스레드/입력창/카드는 컴포넌트 내부에서 직접 렌더하므로 SDUI 메타데이터로 분해할 필요가 없습니다.

```tsx
// import 추가 (기존 import 블록 맨 아래)
import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";

// componentMap 객체 안에 한 줄 추가
// (다른 KRIDE_* 매핑들 옆에 두는 게 가독성 좋음)
KRIDE_CHAT: withRenderTrack(KrideChatComponent, "KrideChatComponent"),
```

### 적용된 componentMap.tsx 의 diff

```diff
 import TypewriterText from "@/components/fields/kride/TypewriterText";
+import KrideChatComponent from "@/components/fields/kride/chat/KrideChatComponent";

 const GroupComponent: React.FC<any> = ({ children }) => <>{children}</>;

 export const componentMap: Record<string, React.FC<any>> = {
     // ...
     TYPEWRITER_TEXT: withRenderTrack(TypewriterText, "TypewriterText"),
+    KRIDE_CHAT: withRenderTrack(KrideChatComponent, "KrideChatComponent"),
 };
```

## SDUI 메타데이터 사용 예 (V50 마이그레이션에서)

```sql
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, label_text,
   order_index, ref_data_id, parent_id, layout_direction,
   css_class, image_url, action_type, link_url, ref_field, visible, validation)
VALUES
  ('KRIDE_CHAT', 'chat_root', 'KRIDE_CHAT', 'K-RIDE 여행봇',
   1, 'chat_root', NULL, NULL,
   'kride-chat-container', NULL, NULL, NULL, NULL, true, NULL);
```

`KrideChatComponent` 가 `meta.labelText` 를 헤더 타이틀로 사용하고, 내부 상태(메시지/POI/일정)는 자체 관리합니다. SDUI 메타데이터는 **컨테이너만 정의**하면 됩니다.

## ❌ 비권장: 세분화 등록

다음과 같이 8개 component_type 으로 쪼개는 것은 SDUI 가 제공하는 가치(메타데이터로 동적 구성)와 맞지 않으니 피하세요. 채팅 UI 는 상태가 깊고(스트리밍/스크롤/입력) DB 메타로 표현하기 어렵습니다.

```
KRIDE_CHAT_SCREEN      ← X
KRIDE_CHAT_HEADER      ← X
KRIDE_CHAT_THREAD      ← X
KRIDE_CHAT_BUBBLE      ← X
KRIDE_CHAT_POI_CARD    ← X
KRIDE_CHAT_ITINERARY   ← X
KRIDE_CHAT_SUGGESTIONS ← X
KRIDE_CHAT_COMPOSER    ← X
```

대신 `KrideChatComponent` 내부에서 React 컴포넌트로 직접 조합 (publish/chat.jsx 참조).

## 컴포넌트 파일 위치

```
metadata-project/components/fields/kride/chat/
├── KrideChatComponent.tsx        ← componentMap 에 등록되는 SDUI 컨테이너
├── Header.tsx
├── Thread.tsx
├── Bubble.tsx
├── PoiCard.tsx
├── ItineraryCard.tsx
├── Suggestions.tsx
├── EmptyState.tsx
└── Composer.tsx
```

각 파일은 `publish/chat.jsx` 의 동일 이름 함수에서 그대로 추출하면 됩니다 (TypeScript 변환만 필요).
