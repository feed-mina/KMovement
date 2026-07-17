# kride 모바일(Expo) — 남은 마이그레이션 계획

> 이슈 #111의 P4~P6에 해당하는 남은 작업 계획입니다.
> 이번 세션에서 **앱이 실기기에서 실데이터를 렌더하는 기반**까지 완성했고(아래 "완료"), 그 위에 쌓을 작업을 정리합니다.
> 관련: [web-to-app-dev-guide.md](web-to-app-dev-guide.md), `../../ARCHITECTURE.md`, 메모리 `kride-mobile-expo-build`.

---

## ✅ 완료된 기반 (이번 세션)

- Expo 번들·실기기 실행 (Metro/Watchman/네트워크/의존성 전부 해결)
- `useUiScreen`로 서버 `ui_metadata` 로드 → `DynamicEngine` 렌더
- 무한 리렌더 버그 수정(`[screenId].tsx`에서 인자 참조 안정화)
- 네비게이션 어댑터 1차(`/view/<id>` → `/<id>` 정규화)
- 지원 컴포넌트: **GROUP / TEXT / BUTTON**(base) + 온보딩 리프(CARD_IMAGE, MAP_VIEW, SELECTION_CARD 등)

## 현재 한계 (= 남은 작업의 이유)

1. **컴포넌트 커버리지 미완** — 미포팅 타입은 `null`로 렌더되어 화면이 비어 보임
2. **스타일 미적용** — 서버 `css_class`가 웹 CSS 클래스명이라 NativeWind가 무시
3. **레이아웃** — GROUP의 웹 레이아웃 클래스(`flex-row-layout` 등)가 모바일에서 안 먹음
4. **개발 서버 안정성** — LAN 끊김 시 dev-middleware 인스펙터 프록시가 Metro를 죽임

---

## P4 — 컴포넌트 포팅 (핵심, 가장 큰 덩어리)

미포팅 `component_type`을 `apps/mobile/src/componentMap.tsx`(+ 필요 시 `leaves.tsx`/`composites.tsx`)에 하나씩 추가한다.

### 우선순위 (화면 사용 빈도 기준)

| 순위 | component_type | 쓰이는 화면 | 비고 |
|:--:|---|---|---|
| P0 | **INPUT** | LOGIN, REGISTER, 검색 등 | `TextInput` + formData 바인딩(`onChange`) |
| P0 | **PASSWORD** | LOGIN, REGISTER | `TextInput secureTextEntry` |
| P0 | **EMAIL_SELECT** | LOGIN, REGISTER | 이메일 도메인 선택 UI |
| P1 | **SNS_BUTTON** | LOGIN | 카카오/구글 로그인 버튼 (딥링크/OAuth 어댑터 필요) |
| P1 | **TIME_RECORD_WIDGET** | MAIN | 목표시간 위젯 |
| P2 | IMAGE, MODAL, LIST/REPEATER 등 | 여러 화면 | 웹 `componentMap` 전수 대조 후 목록화 |

### 전체 미포팅 목록 뽑는 법
```
# 웹이 지원하는 타입(진실의 원천)
grep -oE "'[A-Z_]+':" metadata-project/components/constants/componentMap.tsx  # 또는 kride 웹의 componentMap

# 모바일이 지원하는 타입
apps/mobile/src/componentMap.tsx 의 키 + createBaseComponentMap(GROUP/TEXT/BUTTON)

# 차집합 = 포팅 대상
```
또는 주요 화면의 API를 훑어 실제 사용 타입을 수집:
`GET https://yerin.duckdns.org/api/ui/<SCREEN_ID>` → `componentType` 재귀 수집.

### 컴포넌트 추가 방법 (레시피)
1. `apps/mobile/src/leaves.tsx`(표시) 또는 `composites.tsx`(상호작용)에 RN 컴포넌트 작성 — `SduiLeafProps`(`meta`, `data`, `onChange`, `onAction`) 사용
2. `apps/mobile/src/componentMap.tsx`의 `mobileComponentMap`에 `TYPE: Component` 등록
3. 입력형은 `onChange?.(componentId, value)`로 formData에 반영
4. 액션형은 `onAction?.(meta)` 호출 → 코어 `useBusinessActions`가 라우팅

---

## P4b — 스타일 번역 (css_class → NativeWind)

서버가 주는 웹 CSS 클래스를 모바일 스타일로 잇는다. 택1 또는 혼합:

- **(A) 매핑 테이블** — `apps/mobile/src/primitives.tsx`(Box/Txt/Btn)에서 className을 NativeWind 유틸리티로 치환하는 map. 예: `main-bento → gap-3 p-4`, `flex-row-layout → flex-row`, `flex-col-layout → flex-col`. **가장 현실적, DB 무변경.**
- (B) 서버가 유틸리티 클래스 전송 — `ui_metadata.css_class`를 Tailwind 유틸리티로 통일(웹/모바일 공용). 근본적이나 DB 마이그레이션 필요 → **결정 필요**.
- (C) 화면별 모바일 스타일 프리셋.

우선 (A)로 레이아웃 핵심 클래스(`flex-row/col-layout`, `*-bento`, 간격/카드)부터 매핑.

---

## P5 — 라우팅·액션 어댑터 마무리

- `/view/<id>` 외 다른 웹 경로 패턴이 나오면 `[screenId].tsx`의 `push` 정규화에 추가
- `SET_DURATION → /movies`, `GOTO_FOCUS → /focus` 등 코어의 하드코딩 경로가 모바일 라우트(`app/`)에 실제 존재하는지 확인 → 없으면 라우트 파일 추가 또는 경로 매핑
- SNS 로그인/OAuth: 딥링크 스킴(`kride://`) + `expo-web-browser`/`expo-auth-session` 어댑터

---

## P6 — 개발 환경 안정화 & 배포

- **연결 안정성**: 실기기 스모크는 `npx expo start --tunnel` 권장(LAN 끊김 회피). `j`(디버거)는 인스펙터 프록시 크래시 유발하니 지양.
- **`.env`**: `.env`는 gitignore됨 → 신규 개발자는 `.env.example`을 복사해 `EXPO_PUBLIC_API_BASE` 설정 필요. README에 명시.
- **지도 화면**: `react-native-maps`는 Expo Go 미지원 → dev build(`expo run:android`) 또는 EAS dev client에서 검증.
- **빌드 산출물**: EAS build로 preview APK → 내부 테스트 → 스토어.

---

## 권장 진행 순서

1. **P4 P0**(INPUT/PASSWORD/EMAIL_SELECT) — 로그인/회원가입이 실제로 보이고 동작하게 (체감 큰 첫걸음)
2. **P4b (A)** 레이아웃 클래스 매핑 — 화면이 "앱처럼" 보이게
3. P4 나머지 컴포넌트 순차 포팅
4. P5 라우팅/OAuth 어댑터
5. P6 dev build·EAS·스토어

> 원칙: 백엔드 `ui_metadata` 계약은 가급적 변경하지 않고, **모바일 어댑터(componentMap/primitives/navigation)** 쪽에서 흡수한다. 웹 동작 보존.
