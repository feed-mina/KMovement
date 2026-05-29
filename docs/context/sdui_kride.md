# K-Ride PWA 프론트엔드 구현 계획 (SDUI MSA 통합)

## Context
기존 SDUI 프로젝트(Spring Boot EC2 + Vercel + Redis + PostgreSQL)에 K-Ride를 **MSA 신규 서비스**로 연결한다.
SDUI의 핵심 원칙 — "가장 작은 단위 요소(select, input, text 등)를 블록처럼 쌓아 DOM 트리로 페이지를 구성하고,
`ui_metadata` DB값만 바꾸면 즉시 화면이 바뀐다" — 를 K-Ride의 모든 인트로 화면에 완전히 적용한다.

---

## MSA 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    K-Ride Frontend                       │
│         (Next.js 14, SDUI/kride/)                        │
│                                                          │
│  DynamicEngine (src/engine/)                             │
│  componentMap (SDUI 기본 + K-Ride 전용 추가)              │
│                                                          │
│  React Query ─────────────────┐                         │
│      │                        │                         │
└──────┼────────────────────────┼─────────────────────────┘
       │                        │
       ▼                        ▼
┌─────────────┐      ┌──────────────────────┐
│  SDUI Server│      │  K-Ride FastAPI Server│
│ (Spring Boot│      │  (Python, 기존 프로젝트)│
│  EC2 기존)  │      │                      │
│             │      │ - 아티스트/지역 데이터  │
│ ui_metadata │      │ - AI 추천 (GraphRAG)  │
│ ui API      │      │ - 일정 생성           │
│ Redis cache │      │                      │
└─────────────┘      └──────────────────────┘
       │                        │
       ▼                        ▼
┌─────────────┐      ┌──────────────────────┐
│ PostgreSQL  │      │  Neo4j AuraDB        │
│ (SDUI DB)   │      │  Supabase            │
│ ui_metadata │      │                      │
│ + K-Ride    │      │ 아티스트, 촬영지       │
│   screen 추가│      │ POI 81만건            │
└─────────────┘      └──────────────────────┘
```

---

## SDUI 원칙 적용 방식

### [메모 반영] 원칙: Atom을 더 작게 쪼개고, 작은 단위를 블록처럼 조합해 복합 컴포넌트를 만든다

### Atom 계층 구조 (3단계)

**Level 1 — 기존 SDUI Atom (재사용)**
`GROUP` · `TEXT` · `BUTTON` · `IMAGE` · `CHECKBOX`

**Level 2 — K-Ride 신규 Atom (가장 작은 단위)**
| component_type | 역할 | 조합 기반 |
|---------------|------|----------|
| `CARD_IMAGE` | 원형/사각 이미지 | IMAGE + css_class(circle/square) |
| `CARD_LABEL` | 카드 하단 이름 텍스트 | TEXT + css_class |
| `CHECK_INDICATOR` | 선택 시 빨간 체크/ring 오버레이 | 독립 Atom |
| `RANGE_INPUT` | 단일 range input | 독립 Atom |
| `RANGE_TRACK` | 슬라이더 트랙 (빨간 구간) | 독립 Atom |
| `RANGE_LABEL` | ₩ 금액 텍스트 | TEXT + 포맷터 |
| `MAP_CONTAINER` | Leaflet 지도 (SSR 비활성) | 독립 Atom |
| `MAP_MARKER` | 경로 마커 + Popup | 독립 Atom |
| `COLLAPSE_HEADER` | 아코디언 헤더 (오전/오후) | 독립 Atom |
| `COLLAPSE_BODY` | 아코디언 본문 | GROUP 확장 |
| `ROUTE_NODE` | 경로 노드 (번호 + 장소명) | 독립 Atom |
| `PURPOSE_ICON` | 여행목적 아이콘 | IMAGE |
| `DURATION_LABEL` | 버튼 텍스트 | TEXT |

**Level 3 — K-Ride 복합 컴포넌트 (Atom 조합)**
| component_type | 구성 Atom |
|---------------|-----------|
| `SELECTION_CARD` | GROUP(column) + CARD_IMAGE + CARD_LABEL + CHECK_INDICATOR |
| `PURPOSE_CARD` | GROUP(row) + PURPOSE_ICON + TEXT + CHECK_INDICATOR |
| `DUAL_RANGE_SLIDER` | GROUP(column) + RANGE_LABEL + GROUP(row)[RANGE_INPUT × 2] + RANGE_TRACK |
| `DURATION_BUTTON` | BUTTON + DURATION_LABEL |
| `MAP_VIEW` | GROUP + MAP_CONTAINER + MAP_MARKER[] |
| `ITINERARY_PANEL` | GROUP(column) + [COLLAPSE_HEADER + COLLAPSE_BODY + ROUTE_NODE[]]× N |

### `ui_metadata` 신규 행 (K-Ride 화면 정의)
SDUI PostgreSQL DB에 INSERT로 K-Ride 화면을 추가한다. 코드 배포 없이 DB만 수정하면 화면이 바뀐다.

```sql
-- screen_id 네이밍: KRIDE_INTRO1 ~ KRIDE_FOCUS
-- 예시: Intro1 화면 구조
INSERT INTO ui_metadata (screen_id, component_id, component_type, label_text, sort_order, group_id, parent_group_id, group_direction) VALUES
('KRIDE_INTRO1', 'intro1_root',    'GROUP',           NULL,        1, 'intro1_root', NULL,          'COLUMN'),
('KRIDE_INTRO1', 'intro1_title',   'TEXT',            '어떤 여행을 떠나실 건가요?', 2, 'intro1_title',  'intro1_root', NULL),
('KRIDE_INTRO1', 'intro1_buttons', 'GROUP',           NULL,        3, 'intro1_buttons', 'intro1_root', 'ROW'),
('KRIDE_INTRO1', 'btn_day',        'DURATION_BUTTON', '당일치기',   4, 'btn_day',    'intro1_buttons', NULL),
('KRIDE_INTRO1', 'btn_1n2d',       'DURATION_BUTTON', '1박 2일',   5, 'btn_1n2d',   'intro1_buttons', NULL),
('KRIDE_INTRO1', 'btn_2n3d',       'DURATION_BUTTON', '2박 3일',   6, 'btn_2n3d',   'intro1_buttons', NULL);
-- 나머지 screen_id: KRIDE_INTRO2, KRIDE_INTRO3, KRIDE_INTRO4, KRIDE_INTRO5, KRIDE_MY_LIST, KRIDE_FOCUS
```

---

## 화면 흐름

```
/ (랜딩) → /login → /signup
                       ↓ 로그인 완료
/browse (KRIDE_INTRO1) → /movies (KRIDE_INTRO2) → /latest (KRIDE_INTRO3)
→ /intro4 (KRIDE_INTRO4) → /intro5 (KRIDE_INTRO5)
→ /my-list (KRIDE_MY_LIST) → /focus (KRIDE_FOCUS)
```

각 페이지는 React Query로 `GET /api/ui/KRIDE_INTRO1` 등을 fetch → DynamicEngine이 렌더링

---

## 메모 답변

### Zustand persist 미들웨어
```typescript
import { persist } from 'zustand/middleware'
const useStore = create(persist(
  (set) => ({ duration: null, setDuration: (d) => set({ duration: d }) }),
  { name: 'kride-onboarding' }  // localStorage key 이름
))
// 페이지 새로고침해도 선택값 유지됨
```

### React Query + Redis 역할 분리
```
Zustand persist  → 온보딩 선택값 (클라이언트, localStorage)
React Query      → UI 메타데이터 + 아티스트/지역 데이터 (서버 캐시)
Redis (SDUI 서버) → ui_metadata 캐시 (TTL 1시간, 기존 SDUI와 동일)
```

### Focus 사이드패널 — duration별 아코디언
```
당일치기 → 하루: [오전▼] [오후▼]
1박2일   → 첫째날: [오전▼][오후▼] / 둘째날: [오전▼][오후▼]
2박3일   → 위 + 셋째날: [오전▼][오후▼]
```
DaisyUI `collapse collapse-arrow` 컴포넌트로 구현.

### Jest 테스트: 각 화면 구현 직후 작성

---

## Phase 0: ✅ 완료
- SDUI 클론: `d:/kride-project/SDUI/`
- npm 패키지 설치 완료

**SDUI 코드 분석 결과 — 핵심 발견:**
- `DynamicEngine/DynamicEngine.tsx` — 재귀 `renderNodes()`, Repeater 패턴, isVisible 처리
- `DynamicEngine/useDynamicEngine.tsx` — 데이터 바인딩 우선순위: formData > rowData > pageData
- `DynamicEngine/usePageHook.tsx` — 액션 라우터 (userActions / businessActions 분리)
- `DynamicEngine/hook/useBusinessActions.tsx` — K-Ride 액션 추가할 파일
- `components/constants/componentMap.tsx` — `withRenderTrack` HOC로 모든 컴포넌트 래핑
- `components/fields/MapView.tsx` — **이미 존재함!** 재사용/확장 가능
- 공통 Props: `{ id, meta, data, onChange, onAction }` — K-Ride Atom도 동일 인터페이스 사용

**SDUI 서버 API 엔드포인트 (K-Ride가 호출할 것):**
- `GET /api/ui/{screenId}` — UI 메타데이터 트리 반환 (Redis 캐시 1시간)

SDUI PostgreSQL DB에 K-Ride 화면 데이터 INSERT (Phase 1에서 SQL 제공)

---

## Phase 1: ✅ 완료

> **실제 구현 위치:** `SDUI/kride/` (계획의 `netflix-clone-main` 대신 별도 Next.js 14 앱으로 분리)

### 1-1. DynamicEngine 복사 및 적용 (완료)
**실제 위치:** `SDUI/kride/src/engine/`

구현된 파일:
- `DynamicEngine.tsx`, `useDynamicEngine.ts`, `type.ts`, `index.ts`
- `hooks/useBaseActions.ts`, `hooks/useBusinessActions.ts`, `hooks/usePageHook.ts`
- `hooks/useUiScreen.ts` — React Query로 SDUI 서버 `/api/ui/{screenId}` 호출 (신규 추가)

K-Ride 전용 액션 (실제 구현):
```typescript
case 'SET_DURATION': store.setDuration(data?.value ?? data); router.push('/movies'); break;
case 'TOGGLE_ARTIST': store.toggleArtist(data); break;
case 'TOGGLE_REGION': store.toggleRegion(data); break;
case 'SET_PURPOSES': store.togglePurpose(data?.value ?? data); break;
case 'SET_BUDGET': store.setBudget(data); break;
case 'GOTO_FOCUS': router.push('/focus'); break;
case 'GOTO_MY_LIST': router.push('/my-list'); break;  // 계획 외 추가
```

### 1-2. K-Ride componentMap (완료)
**실제 위치:** `SDUI/kride/src/engine/componentMap.ts`

```typescript
export const componentMap = {
  GROUP: GroupComponent, TEXT: TextField, BUTTON: ButtonField, IMAGE: ImageField,
  CARD_IMAGE: CardImage, CARD_LABEL: CardLabel, CHECK_INDICATOR: CheckIndicator,
  RANGE_INPUT: RangeInput, RANGE_TRACK: RangeTrack, RANGE_LABEL: RangeLabel,
  MAP_CONTAINER: MapContainerAtom, MAP_MARKER: MapMarker,
  COLLAPSE_HEADER: CollapseHeader, COLLAPSE_BODY: CollapseBody,
  ROUTE_NODE: RouteNode, PURPOSE_ICON: PurposeIcon, DURATION_LABEL: DurationLabel,
  SELECTION_CARD: SelectionCard, PURPOSE_CARD: PurposeCard,
  DUAL_RANGE_SLIDER: DualRangeSlider, DURATION_BUTTON: DurationButton,
  MAP_VIEW: MapView, ITINERARY_PANEL: ItineraryPanel,
}
```

### 1-3. Zustand 온보딩 스토어 (완료)
**실제 위치:** `SDUI/kride/src/store/onboarding-store.ts`
- `persist` 미들웨어 적용, localStorage key: `'kride-onboarding'`
- 5개 초과 선택 방지 로직 내장 (toggleArtist / toggleRegion)
- 초기 예산: `{ min: 30000, max: 2000000 }`

### 1-4. screenMap 추가 (완료)
**실제 위치:** `SDUI/kride/src/engine/screenMap.ts`
- `SCREEN_IDS` + `PATH_TO_SCREEN` 맵 모두 구현

### 1-5. 헤더 조건부 숨김 (완료)
**실제 위치:** `SDUI/kride/src/app/(afterLogin)/_component/conditional-header.tsx`
- `layout.tsx` → `<ConditionalHeader />` 적용 완료

---

## Phase 2: ✅ 완료

**실제 위치:** `SDUI/kride/src/components/kride/`

### Level 2 Atoms (완료)
| 파일 | component_type |
|------|---------------|
| `atoms/CardImage.tsx` | `CARD_IMAGE` |
| `atoms/CardLabel.tsx` | `CARD_LABEL` |
| `atoms/CheckIndicator.tsx` | `CHECK_INDICATOR` |
| `atoms/RangeInput.tsx` | `RANGE_INPUT` |
| `atoms/RangeTrack.tsx` | `RANGE_TRACK` |
| `atoms/RangeLabel.tsx` | `RANGE_LABEL` |
| `atoms/CollapseHeader.tsx` | `COLLAPSE_HEADER` |
| `atoms/CollapseBody.tsx` | `COLLAPSE_BODY` |
| `atoms/RouteNode.tsx` | `ROUTE_NODE` |
| `atoms/PurposeIcon.tsx` | `PURPOSE_ICON` |
| `atoms/DurationLabel.tsx` | `DURATION_LABEL` |

### Level 3 복합 컴포넌트 (완료)
| 파일 | component_type | 비고 |
|------|---------------|------|
| `SelectionCard.tsx` | `SELECTION_CARD` | circle(아티스트)/square(지역) mode, 5개 초과 disabled |
| `DurationButton.tsx` | `DURATION_BUTTON` | SET_DURATION 액션 → /movies |
| `PurposeCard.tsx` | `PURPOSE_CARD` | 다중 선택, 토글 |
| `DualRangeSlider.tsx` | `DUAL_RANGE_SLIDER` | min/max 겹침 슬라이더, gap 10000 제한 |
| `MapView.tsx` | `MAP_VIEW` | dynamic import SSR 비활성 |
| `MapViewInner.tsx` | — | react-leaflet 실제 구현체 (계획 외 분리) |
| `ItineraryPanel.tsx` | `ITINERARY_PANEL` | duration별 1/2/3일 아코디언 |

---

## Phase 3: ✅ 완료

**실제 패턴 (useUiScreen 훅 사용):**
```typescript
const { data: metadata = [], isLoading } = useUiScreen(SCREEN_IDS.INTRO1);
const { formData, handleChange, handleAction } = usePageHook(SCREEN_IDS.INTRO1, metadata, pageData);
// SDUI 메타데이터 없을 때 fallback UI 내장
```

### Intro1 — `/browse/page.tsx` (완료)
- SDUI 메타데이터 없을 시 fallback: DURATION_BUTTON 3개 직접 렌더링
- 클릭 → `SET_DURATION` 액션 → `/movies`

### Intro2 — `/movies/page.tsx` (완료)
- pageData: `{ artistList: ARTIST_LIST }` (20개 하드코딩, FastAPI 연동 예정)
- 하단 고정 버튼: 선택 수 "N / 5" + `다음 →` (1개 미만 disabled)

### Intro3 — `/latest/page.tsx` (완료)
- pageData: `{ regionList: REGION_LIST }` (20개 하드코딩)
- Intro2와 동일 패턴, square 모드

### Intro4 — `/intro4/page.tsx` (완료)
- PURPOSE_CARD 6개 (food / kculture / nature / history / shopping / rest)

### Intro5 — `/intro5/page.tsx` (완료)
- DUAL_RANGE_SLIDER + 하단 "AI 여행 추천 받기 →" 버튼 → `/my-list`

---

## Phase 4: ✅ 완료

### My-list — `/my-list/page.tsx` (완료)
**실제 위치:** `SDUI/kride/src/app/(afterLogin)/my-list/page.tsx`

- `duration === null` → `router.replace('/browse')` (redirect 처리)
- fallback UI: 여행 기간 / 아티스트 / 지역 / 목적 / 예산 요약 섹션
- AI 배너 버튼: `data-testid="ai-banner-btn"` → `/focus` 이동
- SDUI 메타데이터 있을 시 DynamicEngine으로 렌더링

### Focus — `/focus/page.tsx` (완료)
**실제 위치:** `SDUI/kride/src/app/(afterLogin)/focus/page.tsx`

- `duration === null` → `router.replace('/browse')` (redirect 처리)
- fallback UI: `flex h-screen` 60/40 레이아웃 직접 구성
  - 좌측 60%: `<MapView>` (dynamic import SSR 비활성)
  - 우측 40%: `<ItineraryPanel>` (duration별 목 일정 내장)
- 목 일정 데이터: `MOCK_ITINERARY` (day/onenight/twonight 모두 정의)
- 목 지도 마커: 경복궁 / 창덕궁 / 인사동 / 남산서울타워 (서울 중심부)

---

## Phase 5: ✅ 완료

### 미들웨어 — `src/middleware.ts` (완료)
**실제 위치:** `SDUI/kride/src/middleware.ts`

```typescript
// accessToken 쿠키 부재 시 /login?from={pathname} 으로 redirect
// 보호 경로: /browse /movies /latest /intro4 /intro5 /my-list /focus
//            /profile/account /profile/manage
```

### next.config.ts PWA 설정 (완료)
**실제 파일:** `next.config.ts` (계획의 `.js` 대신 `.ts`)

- `next-pwa` try-catch 조건부 적용 (미설치 시 fallback → 기본 Next.js 동작)
- `npm install` 후 production 빌드에서 서비스 워커 자동 등록
- `images.domains`에 Supabase Storage 도메인 추가 완료

### `public/manifest.json` (완료)
```json
{
  "name": "K-Ride", "short_name": "K-Ride",
  "start_url": "/browse", "display": "standalone",
  "background_color": "#141414", "theme_color": "#e50914",
  "icons": [192x192, 512x512], "lang": "ko"
}
```
> 아이콘 파일(`public/icons/icon-192x192.png`, `icon-512x512.png`)은 별도 추가 필요

---

## SDUI DB 추가 작업 (SQL): ✅ 완료

**실제 파일:** `SDUI-server/src/main/resources/db/migration/V40__kride_screens.sql`
> 계획(V28)과 달리 V28~V39가 이미 사용 중이어서 **V40**으로 생성

포함 screen_id:
| screen_id | 화면 | 핵심 컴포넌트 |
|-----------|------|-------------|
| `KRIDE_INTRO1` | 여행 기간 선택 | DURATION_BUTTON × 3 |
| `KRIDE_INTRO2` | 아티스트 선택 | SELECTION_CARD (circle, Repeater) |
| `KRIDE_INTRO3` | 지역 선택 | SELECTION_CARD (square, Repeater) |
| `KRIDE_INTRO4` | 여행 목적 | PURPOSE_CARD × 6 (Repeater) |
| `KRIDE_INTRO5` | 예산 설정 | DUAL_RANGE_SLIDER |
| `KRIDE_MY_LIST` | 온보딩 요약 | TEXT 요약 + BUTTON(GOTO_FOCUS) |
| `KRIDE_FOCUS` | 지도 + 일정 | MAP_VIEW 60% + ITINERARY_PANEL 40% |

---

## Jest 테스트: ✅ 완료

**설정 파일:**
- `jest.config.ts` — ts-jest, jsdom, setupFilesAfterEnv
- `src/__tests__/jest.setup.ts` — @testing-library/jest-dom import
- `src/__tests__/__mocks__/styleMock.ts` — CSS 모킹

**테스트 파일:**

| 파일 | 커버 범위 |
|------|---------|
| `src/__tests__/store/onboarding-store.test.ts` | Intro1 duration 3종 / Intro2 아티스트 5개 제한 / Intro3 지역 5개 제한 / Intro4 다중 선택·토글 해제 / Intro5 경계값 / My-list null 체크 / reset |
| `src/__tests__/components/ItineraryPanel.test.tsx` | Focus day/onenight/twonight 날짜 구조 / 아코디언 펼침 / 빈 일정 메시지 |
| `src/__tests__/components/SelectionCard.test.tsx` | circle 선택·토글·5개 초과 방지 / square 선택·5개 초과 방지 |
| `src/__tests__/components/DualRangeSlider.test.tsx` | 초기 라벨 표시 / min·max 슬라이더 변경 / min>max 방지 / 경계값 30000·2000000 |

**실행:**
```bash
cd SDUI/kride
npm install   # jest, ts-jest, @testing-library/* 설치
npm test
```

---

## 핵심 파일 목록 (실제 구현 기준)

| 파일 | 상태 | 실제 위치 |
|------|------|---------|
| `V40__kride_screens.sql` | ✅ 완료 | SDUI-server/src/main/resources/db/migration/ |
| `src/engine/` (DynamicEngine 일체) | ✅ 완료 | SDUI/kride/ |
| `src/engine/componentMap.ts` | ✅ 완료 | SDUI/kride/ |
| `src/engine/screenMap.ts` | ✅ 완료 | SDUI/kride/ |
| `src/store/onboarding-store.ts` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/atoms/` (11개) | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/SelectionCard.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/DurationButton.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/PurposeCard.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/DualRangeSlider.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/MapView.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/MapViewInner.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/components/kride/ItineraryPanel.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/_component/conditional-header.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/layout.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/browse/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/movies/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/latest/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/intro4/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/intro5/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/my-list/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/app/(afterLogin)/focus/page.tsx` | ✅ 완료 | SDUI/kride/ |
| `src/middleware.ts` | ✅ 완료 | SDUI/kride/ |
| `next.config.ts` | ✅ 완료 (PWA 조건부) | SDUI/kride/ |
| `public/manifest.json` | ✅ 완료 | SDUI/kride/ |
| `jest.config.ts` | ✅ 완료 | SDUI/kride/ |
| `src/__tests__/` (테스트 4종) | ✅ 완료 | SDUI/kride/ |

---

## 잔여 작업 (미완료)

| 항목 | 내용 |
|------|------|
| PWA 아이콘 | `public/icons/icon-192x192.png`, `icon-512x512.png` 파일 추가 필요 |
| npm install | `next-pwa`, `jest`, `ts-jest`, `@testing-library/*` 설치 필요 |
| K-Ride FastAPI 연동 | `/movies`, `/latest` 페이지의 아티스트·지역 목록을 하드코딩에서 실제 API 호출로 전환 |
| `/focus` AI 일정 | `MOCK_ITINERARY` → K-Ride FastAPI `/recommend/itinerary` 실제 응답으로 교체 |
| 로그인 페이지 | `src/app/login/page.tsx` — middleware redirect 대상 |
| PWA 아이콘 생성 | Figma 또는 디자인 툴로 K-Ride 로고 기반 아이콘 생성 |

---

## 주의 사항

- SDUI 서버 API URL은 `.env.local`의 `NEXT_PUBLIC_SDUI_API_BASE`로 관리 (기본값 `http://localhost:8080`)
- MapView: Leaflet SSR 불가 → `dynamic(..., { ssr: false })` 필수 → `MapViewInner.tsx`로 분리
- Zustand persist hydration mismatch → `hasHydrated` 플래그 필요 시 추가
- SDUI 컴포넌트 타입명은 대문자 스네이크케이스 유지 (`DURATION_BUTTON` 등)
- `accessToken` 쿠키명은 SDUI Spring Boot 서버의 실제 JWT 쿠키명과 일치시킬 것

## 검증 방법

1. `npm install` → `npm test` → 테스트 전체 통과 확인
2. SDUI 서버에 `GET /api/ui/KRIDE_INTRO1` 호출 → JSON 트리 반환 확인
3. `npm run dev` → 로그인 → `/browse` DURATION_BUTTON 3개 렌더링 확인
4. 클릭 → `/movies` → 아티스트 목록 로드 (Network 탭)
5. 1~5개 선택 제한 → `/latest` → `/intro4` → `/intro5`
6. `/my-list` 요약 + AI 배너 → `/focus` 지도 + 아코디언 일정
7. Chrome DevTools → Application → Manifest PWA 등록 확인
