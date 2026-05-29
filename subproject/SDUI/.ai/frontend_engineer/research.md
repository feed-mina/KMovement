# Frontend Engineer — Research

> 이 파일은 프론트엔드 구현 분석 결과를 기록한다.

---

## 핵심 파일 지도 (2026-02-28 기준)

### DynamicEngine 코어

| 파일                                              | 역할                            | 변경 빈도               |
| ------------------------------------------------- | ------------------------------- | ----------------------- |
| `components/DynamicEngine/DynamicEngine.tsx`    | 트리 순회 + 컴포넌트 렌더링     | 낮음 (핵심 엔진)        |
| `components/DynamicEngine/useDynamicEngine.tsx` | 데이터 바인딩 로직              | 낮음                    |
| `components/DynamicEngine/type.ts`              | Metadata 타입 정의              | 중간                    |
| `components/constants/componentMap.tsx`         | component_type → 컴포넌트 매핑 | 중간 (신규 컴포넌트 시) |
| `components/constants/screenMap.ts`             | URL → screen_id 매핑           | 중간 (신규 화면 시)     |

### 액션 핸들러 계층

```
usePageHook (라우터)
  ├── useUserActions (인증 관련)
  │     액션: LOGIN_SUBMIT, LOGOUT, REGISTER_SUBMIT, VERIFY_CODE,
  │           SOS, TOGGLE_PW, KAKAO_LOGOUT, LINK, ROUTE
  └── useBusinessActions (데이터 관련)
        액션: SUBMIT, ROUTE_DETAIL, ROUTE_MODIFY, LINK, ROUTE

공통: useBaseActions
  - handleChange(id, value): formData 상태 업데이트
  - togglePassword(): 비밀번호 표시 토글
  - getMetaInfo(meta): 메타데이터 필드 정규화
  - flattenMetadata(): 트리 → 배열 변환
```

### 데이터 흐름 레이어

```
MetadataProvider
  → React Query: GET /api/ui/{screenId}
  → 캐시 키: {rolePrefix}_{screenId}
  → stale: 5분

usePageMetadata
  → 메타데이터 로드 (Provider 캐시 활용)
  → AUTO_FETCH 컴포넌트 탐지
  → POST /api/execute/{sqlKey} (pageData 획득)
  → JSONB 필드 파싱 (selected_times, daily_slots)
  → 날짜 정규화 (T 제거, 하이픈 → 점)
  → 페이지네이션 데이터 구성
  → returns: { metadata, pageData, loading, totalCount }

useDynamicEngine
  → treeData: 서버에서 이미 트리로 온 메타데이터
  → getComponentData(node, rowData):
      우선순위: formData[refId] > rowData > pageData[refId] > pageData
```

### 상태 관리

```
AuthContext (context/AuthContext.tsx)
  - user: { userId, userSqno, email, socialType, isLoggedIn, role }
  - login(userData): 로그인 상태 설정
  - logout(): 상태 초기화 + LOGIN_PAGE 이동
  - checkAccess(roles): RBAC 확인
  - 초기화: /api/auth/me 호출 (세션 복구)

formData (useBaseActions)
  - React useState로 관리
  - formDataRef: 즉각적 읽기용 (액션 핸들러에서 사용)
  - 메타데이터 변경 시 자동 초기화
  - 수정 화면: initialData로 자동 채움
```

### Axios 인터셉터 (`services/axios.tsx`)

```
Request:
  → Authorization: Bearer {token} (localStorage)
  → withCredentials: true

Response:
  → 401 수신 시:
      POST /api/auth/refresh
      → 성공: 새 토큰 저장 + 원래 요청 재시도
      → 실패: 로그아웃 + LOGIN_PAGE 이동
  → 에러 코드 처리: AUTH_001, AUTH_004 등
```

---

## 타입 시스템 분석

### Metadata 인터페이스 (type.ts) — 주의: 이중 필드 패턴

```typescript
// 서버 응답은 camelCase, DB 직접 응답은 snake_case일 수 있음
// 두 형태 모두 지원해야 하므로 타입에 양쪽 정의됨

interface Metadata {
  componentId: string;         // camelCase
  component_id: string;        // snake_case (둘 중 하나만 올 수 있음)
  componentType: string;
  component_type?: string;
  parentGroupId?: string | null;
  parent_group_id?: string | null;
  // ... 모든 필드가 이중으로 정의됨
  children?: Metadata[] | null;
}
```

---

## 현재 필드 컴포넌트 목록 (`components/fields/`)

| 파일                    | component_type         | 특이사항                                       |
| ----------------------- | ---------------------- | ---------------------------------------------- |
| InputField.tsx          | INPUT                  | Enter키 SUBMIT, 비밀번호 감지                  |
| TextField.tsx           | TEXT                   | 표시 전용                                      |
| PasswordField.tsx       | PASSWORD               | showPassword prop                              |
| ButtonField.tsx         | BUTTON, SNS_BUTTON     | onAction 콜백                                  |
| SelectField.tsx         | SELECT                 | 드롭다운                                       |
| TextAreaField.tsx       | TEXTAREA               | 여러 줄                                        |
| Modal.tsx               | MODAL                  | activeModal === componentId 조건부 표시        |
| ImageField.tsx          | IMAGE                  |                                                |
| DateTimePicker.tsx      | DATETIME_PICKER        |                                                |
| TimeSelect.tsx          | TIME_SELECT            |                                                |
| TimeSlotRecord.tsx      | TIME_SLOT_RECORD       |                                                |
| AddressSearchGroup.tsx  | ADDRESS_SEARCH_GROUP   | 다음 우편번호 API                              |
| EmotionSelectField.tsx  | EMOTION_SELECT         | 감정 인덱스(정수)                              |
| EmailSelectField.tsx    | EMAIL_SELECT           | 도메인 선택                                    |
| ArrivalButton.tsx       | ❌ componentMap 미등록 | 도착 버튼 (RecordTimeComponent 내부 직접 사용) |
| RecordTimeComponent.tsx | TIME_RECORD_WIDGET     |                                                |
| Pagination.tsx          | (DynamicEngine 외부)   | CONTENT_LIST에서 직접 사용                     |
|                         |                        |                                                |

---

## 테스트 환경

| 항목             | 기술                       | 설정 파일                           |
| ---------------- | -------------------------- | ----------------------------------- |
| 단위/통합 테스트 | Jest 29.7                  | `jest.config.js`                  |
| React 테스팅     | React Testing Library 16.3 | -                                   |
| API 모킹         | MSW 2.7                    | -                                   |
| E2E              | Playwright 1.50            | `playwright.config.ts`            |
| 리포트           | TestLogger.ts              | `tests/logs/frontend-report.html` |
| 변환기           | @swc/jest                  | jest.config.js                      |

---

## 성능 관련 확인 사항

| 패턴                  | 구현 위치                    | 목적                   |
| --------------------- | ---------------------------- | ---------------------- |
| withRenderTrack HOC   | componentMap의 모든 컴포넌트 | 렌더 횟수 추적         |
| React.memo / useMemo  | 개별 컴포넌트                | 불필요한 리렌더링 방지 |
| React Query stale 5분 | MetadataProvider             | API 중복 호출 방지     |
| formDataRef           | useBaseActions               | 클로저 문제 방지       |

---

## [P2] Security Audit — JWT & XSS 취약점 현황 분석 (코드 재검증)

**분석 일시:** 2026-02-28
**참고 커밋:** b2ec8d5 (fix: 민감정보 로깅 삭제 및 보안 로직 보강)

> **⚠️ 상태 업데이트:** 이전 분석은 commit b2ec8d5 이전 코드 기준.
> 재검증 결과: 프론트엔드 민감 로그 수정됨. 백엔드 HttpOnly 쿠키 지원 추가됨.
> 그러나 프론트엔드가 여전히 localStorage를 읽고 있어 XSS 취약점 유효.
> **백엔드 보안 설정 상세 (HttpOnly 쿠키 코드, System.out.println 이슈 등) → `backend_engineer/research.md` 참고**

---

### JWT 토큰 저장 방식 현황 (실제 코드 기준)

| 파일                | 위치       | 저장 방식                                               | 위험도                             |
| ------------------- | ---------- | ------------------------------------------------------- | ---------------------------------- |
| `axios.tsx`       | Line 19    | `localStorage.getItem('accessToken')`                 | ✅ **해결** — HttpOnly 쿠키 전환 (2026-03-01) |
| `axios.tsx`       | Line 49    | `localStorage.setItem('accessToken', newAccessToken)` | ✅ **해결**                  |
| `axios.tsx`       | Line 57    | `localStorage.removeItem('accessToken')`              | ✅ **해결**                        |
| `AuthContext.tsx` | Line 73-74 | `/api/auth/me` 호출 (HttpOnly 쿠키 자동 전송)         | **LOW** — 안전              |

**결론:** 백엔드는 HttpOnly 쿠키로 토큰을 전달하지만, 프론트엔드 `axios.tsx`가 여전히 localStorage를 읽어 아키텍처 불일치 + XSS 취약점 유효.

> ✅ **2026-03-01 수정:** axios.tsx에서 localStorage 제거, HttpOnly 쿠키 전환 완료.

---

### 민감 정보 로깅 현황 (commit b2ec8d5 이후 재스캔)

#### 프론트엔드 (수정 완료 ✅)

| 파일                   | 라인          | 내용                                          | 상태                    |
| ---------------------- | ------------- | --------------------------------------------- | ----------------------- |
| `useUserActions.tsx` | ~76 (구 위치) | `console.log('loginData', loginData)`       | ✅**삭제됨**      |
| `useUserActions.tsx` | ~70 (구 위치) | `console.log('뭐야 ')`                      | ✅**삭제됨**      |
| `AuthContext.tsx`    | 46            | `console.error("Logout API error:", err)`   | ✅ 안전 (에러 메시지만) |
| `useUserActions.tsx` | 146, 159      | `console.error(...)`, `console.warn(...)` | ✅ 안전 (디버그 메시지) |

**프론트엔드 민감 로그: 0개 (commit b2ec8d5로 해결)**
**백엔드 System.out.println (~35개) 미정리 → `backend_engineer/research.md` 참고 (P2)**

---

### CSP / 보안 헤더 현황 (next.config.ts)

**구성 현황 (Line 1-28):**

- rewrites: `/api/*` → `http://localhost:8080/api/*` (프록시)
- redirects: `/` → `/view/MAIN_PAGE`

**보안 헤더:**

| 헤더                      | 설정 여부                  |
| ------------------------- | -------------------------- |
| Content-Security-Policy   | ✅ 이미 구현됨             |
| X-Frame-Options           | ✅ 이미 구현됨             |
| X-Content-Type-Options    | ✅ 이미 구현됨             |
| Strict-Transport-Security | ✅ 이미 구현됨             |
| Content-Security-Policy   | ✅ 구현됨 (next.config.ts) |
| X-Frame-Options           | ✅ 구현됨 (next.config.ts) |
| X-Content-Type-Options    | ✅ 구현됨 (next.config.ts) |
| Strict-Transport-Security | ✅ 구현됨 (next.config.ts) |

---

### XSS 공격 시나리오 위험도

| 시나리오                      | 현재 위험도   | 이유                                                        |
| ----------------------------- | ------------- | ----------------------------------------------------------- |
| XSS로 Access Token 탈취       | **LOW** | localStorage 제거됨 — HttpOnly 쿠키 전환 완료 (2026-03-01) |
| XSS로 Refresh Token 탈취      | **LOW** | HttpOnly 쿠키 — JavaScript 접근 불가                       |
| 탈취 AccessToken으로 API 접근 | **LOW** | 쿠키 기반 전환으로 XSS 탈취 불가                            |
| CSP 없어 XSS 삽입 쉬움        | **LOW** | CSP 헤더 구현됨 (next.config.ts)                            |

---

### 권고 수정안 (현재 기준)

**단기 (즉시, 프론트엔드만 수정):**

1. `next.config.ts`에 보안 헤더 추가:

```typescript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Content-Security-Policy',
        value: "default-src 'self'; script-src 'self'; object-src 'none'" }
    ]
  }]
}
```

**중기 (아키텍처 변경, ✅ 완료):**

1. **✅ Access Token → HttpOnly 쿠키 전환** (`axios.tsx` localStorage 제거 완료, 2026-03-01):

   - 로그인 시 HttpOnly 쿠키만 사용 (백엔드 지원 + 프론트엔드 localStorage 제거 완료)
   - `axios.tsx:19,49` `localStorage.get/setItem` 제거됨

---

// [메모] Sidebar에서 약속관리 항목 로그인 할때만 보이도록 한다.  추가로 GLOBAL_HEAD는 allowd_role 과 관련이 있을까?

### 수정 우선순위

| 항목                                    | 우선순위     | 상태              |
| --------------------------------------- | ------------ | ----------------- |
| `useUserActions.tsx:76` 민감 로그     | 완료         | ✅ commit b2ec8d5 |
| `axios.tsx` localStorage → 쿠키 전환 | **P1** | ✅ 이미 구현됨    |
| CSP / 보안 헤더 추가                    | **P1** | ✅ 이미 구현됨    |

## 분석 (2026-03-05)

### 전체 흐름

```
URL /view/{screenId}
    ↓
[MetadataProvider] (components/providers/MetadataProvider.tsx)
    React Query: GET /api/ui/{screenId}
    캐시 키: {rolePrefix}_{screenId}  stale: 5분
    제공값: screenId, refId, menuTree
    ↓
[CommonPage] (app/view/[...slug]/page.tsx)
    usePageMetadata(screenId, currentPage, isOnlyMine, refId)
      → metadata, pageData, totalCount, loading
    usePageHook(screenId, metadata, pageData)
      → formData, handleChange, handleAction, activeModal, closeModal
    combineData = { ...pageData, ...formData }  ← formData가 pageData 덮어씀
    ↓
[DynamicEngine] (components/DynamicEngine/DynamicEngine.tsx)
    useDynamicEngine(metadata, pageData, formData) → treeData, getComponentData
    useDeviceType() → deviceClass ("is-pc" | "is-mobile")
    ↓
    renderNodes(treeData)   ← 재귀 순회
    renderModals(treeData)  ← MODAL 전용 별도 렌더링
```

---

### renderNodes 분기 로직 (DynamicEngine.tsx:26)

```
노드 하나 수신
  │
  ├── isVisible === false  →  null 반환 (렌더링 제외)
  │
  ├── children 있음 (Group 노드)
  │    │  className: "group-{componentId} {cssClass} flex-row/col-layout"
  │    │
  │    ├── refDataId 있음 → Repeater
  │    │    pageData[refId] 배열을 .map() 순회
  │    │    각 item을 rowData로 전달하며 renderNodes(children, item) 재귀
  │    │
  │    └── refDataId 없음 → 일반 Group
  │         <div className={combinedClassName}>
  │           renderNodes(children, rowData) 재귀
  │         </div>
  │
  └── children 없음 (Leaf 노드)
       typeKey = componentType.toUpperCase()
       Component = componentMap[typeKey]
       Component 없거나 typeKey === "DATA_SOURCE" → null
       finalData = getComponentData(node, rowData)
       <Component id meta data onChange onAction {...rest} />
```

---

### 데이터 바인딩 우선순위 (useDynamicEngine.tsx:11)

```typescript
getComponentData(node, rowData):

1순위  formData[refId]      // 사용자가 현재 입력 중인 값 (입력 즉시 반영)
2순위  rowData              // 리피터 안 개별 행 데이터 (목록 페이지)
3순위  pageData[refId]      // 서버에서 가져온 데이터 (상세/조회 페이지)
         └─ 단일 컴포넌트인데 배열로 왔을 때 → [0] 추출
4순위  pageData 전체        // fallback
```

---

### MODAL 렌더링 (DynamicEngine.tsx:143)

- `renderNodes`와 **완전히 분리**된 `renderModals()` 함수로 처리
- `activeModal === componentId` 조건 충족 시에만 렌더링
- 일반 DOM 트리 흐름 밖에 위치 (레이아웃 영향 없음)

```tsx
// 출력 구조
<div className="engine-container is-pc|is-mobile">
  <div className="content-area">
    {renderNodes(treeData)}    // 일반 컴포넌트
  </div>
  {renderModals(treeData)}     // MODAL (activeModal 조건부)
</div>
```

---

### 주의: CommonPage 레벨 screen_id 분기 (page.tsx:77, 95)

엔진 외부(CommonPage)에서 `CONTENT_LIST` 전용 분기가 존재함.
agent.md 규칙("DynamicEngine 내부에 screen_id 분기 금지")의 위반은 아니지만,
신규 화면 추가 시 이 패턴을 무분별하게 확장하지 않도록 주의.

```tsx
// CommonPage 레벨 분기 (엔진 외부이므로 허용)
{screenId === "CONTENT_LIST" && <FilterToggle ... />}
{screenId === "CONTENT_LIST" && <Pagination ... />}
```

## 전체 레이아웃 구조 분석 (2026-03-05)

> 분석 파일: `app/layout.tsx`, `components/layout/AppShell.tsx`,
> `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`,
> `components/fields/RecordTimeComponent.tsx`

### Provider 계층 (app/layout.tsx)

```
ReactQueryProvider
  └── AuthProvider
        └── MetadataProvider
              └── AppShell
                    └── {children}  ← CommonPage → DynamicEngine
```

---

### AppShell 렌더링 분기 (AppShell.tsx)

```
<div class="app-wrapper is-pc|is-mobile">

  [PC]     → <Sidebar />
  [Mobile] → <Header />

  <main class="main-contents-area">
    [PC only] <div class="pc-top-utility">
                <RecordTimeComponent />
              </div>

    <section class="page-view-container">
      {children}  ← SDUI DynamicEngine 렌더링 영역
    </section>
  </main>
</div>
```

---

### Header.tsx (모바일 전용, isMobile === false 시 null 반환)

```
<header class="mobile-header">
  <div class="header-top-row">
    로고 (ROUTE → /view/MAIN_PAGE)
    | 로그인 버튼 or 로그아웃 버튼 (GLOBAL_HEADER 메타데이터)
  </div>
  <div class="header-bottom-row">
    <div class="time-card">
      <RecordTimeComponent />   ← 모바일에도 이미 존재
    </div>
  </div>
</header>
```

- GLOBAL_HEADER 메타데이터를 `flattenMetadata()`로 평탄화 후 특정 componentId 직접 조회
- DynamicEngine을 통하지 않고 `handleAction`으로 수동 렌더링
- 로그인 여부: `AuthContext.isLoggedIn` 기준
- socialType === 'K' → kakao 로그아웃 / 그 외 → 일반 로그아웃

---

### Sidebar.tsx (PC 전용, isPc === false 시 null 반환)

```
<aside class="pc-sidebar">
  <div class="sidebar-top">
    로고 (ROUTE → /view/MAIN_PAGE)
    <nav>
      홈        → /view/MAIN_PAGE   (하드코딩)
      약속 관리  → /view/SET_TIME_PAGE (하드코딩)
    </nav>
  </div>
  <div class="sidebar-footer">
    로그인 or 로그아웃 버튼 (GLOBAL_HEADER 메타데이터)
  </div>
</aside>
```

- nav 항목은 SDUI 메타데이터가 아닌 하드코딩
- RecordTimeComponent 없음 (AppShell의 pc-top-utility에서 처리)

---

### RecordTimeComponent 위치 요약

| 플랫폼 | 파일         | 위치                                  |
| ------ | ------------ | ------------------------------------- |
| PC     | AppShell.tsx | `pc-top-utility` (메인 콘텐츠 상단) |
| Mobile | Header.tsx   | `header-bottom-row > time-card`     |

**RecordTimeComponent는 PC/모바일 모두 이미 존재함.**

#### RecordTimeComponent 렌더링 분기

```
goalTime 없음:
  <div class="no-goal-container" onClick={handleLinkToSetup}>
    <p>오늘의 약속 시간은 언제인가요?</p>
    <button class="setup-button">시간 설정하기</button>
  </div>

goalTime 있음:
  <div class="time-record-container">
    clock-display-box: 목표시간 / formatTimePretty / remainTimeText
    arrival-button-container: <ArrivalButton />
    more-list-section:
      + 시간 추가 버튼 (항상 표시)
      ••• 버튼 (goalList.length > 0 일 때)
        → goal-list-popup (isListOpen 시 표시)
  </div>
```

### MAIN_PAGE 벤토 그리드 전환 시 영향 범위

| 변경 항목                     | 대상                                            | 방식                                               | 상태               |
| ----------------------------- | ----------------------------------------------- | -------------------------------------------------- | ------------------ |
| 벤토 그리드 레이아웃          | `app/styles/pages.css` line 1715~             | 신규 CSS 추가                                      | ✅ 완료            |
| MAIN_PAGE root css_class      | DB `ui_metadata` MAIN_SECTION                 | UPDATE →`main-bento`                            | ✅ V8 SQL 포함     |
| 기존 카드 삭제                | DB `ui_metadata` (MAIN_TOP_CARD 등 + 자식)    | DELETE                                             | ✅ V8 SQL 포함     |
| USER 벤토 카드 3개            | DB `ui_metadata` 신규 INSERT                  | GROUP/TEXT/BUTTON/TIME_RECORD_WIDGET               | ✅ V8 SQL 포함     |
| GUEST 벤토 카드 3개           | DB `ui_metadata` 신규 INSERT (`ROLE_GUEST`) | GROUP/TEXT/BUTTON/TIME_RECORD_WIDGET               | ✅ V8 SQL 포함     |
| RecordTimeComponent 위치 변경 | 변경 없음                                       | 기존 AppShell/Header 유지, MAIN_PAGE에 DB로도 추가 | ✅ TSX 수정 불필요 |

---

## MAIN_PAGE 벤토 그리드 구현 결과 (2026-03-06)

### 생성된 파일

| 파일                                                                         | 내용                                                       |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `SDUI-server/src/main/resources/db/migration/V8__main_page_bento_grid.sql` | UPDATE+DELETE+INSERT (USER 11행, GUEST 11행)               |
| `metadata-project/app/styles/pages.css` (line 1715~)                       | `.main-bento`, `.bento-card*`, RecordTime override CSS |

### DB 구조 확인 결과 (실제 SELECT 기반)

| 항목              | 실제 값                                            | 비고                      |
| ----------------- | -------------------------------------------------- | ------------------------- |
| root component_id | `MAIN_SECTION`                                   | parent_group_id IS NULL   |
| 현재 css_class    | `main-responsive-grid`                           | →`main-bento`로 UPDATE |
| 기존 카드 3개     | MAIN_TOP_CARD, MAIN_LOGIN_CARD, MAIN_TUTORIAL_CARD | 전체 삭제                 |
| action_type       | `LINK`                                           | 초안의 `ROUTE` 수정됨   |
| group_direction   | `COLUMN` (기본값)                                | 모든 기존 행 동일         |

### RBAC 구현 확인 결과 (UiService.java + UiController.java)

| 항목                   | 내용                                                  |
| ---------------------- | ----------------------------------------------------- |
| 필터링 구현            | ✅`isAccessible()` 구현됨 (2026-03-01 추가)         |
| 미인증 role 값         | `"ROLE_GUEST"` — Controller에서 자동 적용          |
| `allowed_roles=NULL` | 모든 역할에게 표시 →**GUEST 카드에 사용 금지** |
| GUEST 카드 설정값      | `'ROLE_GUEST'` (NULL 아님)                          |
| USER 카드 설정값       | `'ROLE_USER'`                                       |

### componentMap 확인 결과 (componentMap.tsx)

`TIME_RECORD_WIDGET` ✅ 등록됨:

```typescript
TIME_RECORD_WIDGET: withRenderTrack(RecordTimeComponent, "RecordTimeComponent")
```

전체 등록 component_type: MODAL, INPUT, TEXT, PASSWORD, BUTTON, SNS_BUTTON, LINK_BUTTON, IMAGE, EMAIL_SELECT, EMOTION_SELECT, SELECT, TEXTAREA, TIME_RECORD_WIDGET, DATETIME_PICKER, TIME_SELECT, TIME_SLOT_RECORD, ADDRESS_SEARCH_GROUP, GROUP (18개)

### CSS 구조 핵심 사항

```
pages.css 추가 클래스:
  .main-bento             → grid 컨테이너 (3열, 모바일 1열)
  .bento-card             → 공통 카드 (overflow:visible — popup 클리핑 방지)
  .col-span-2 / .col-span-3 → 그리드 열 점유
  .bento-card-appointment/no-goal/diary/login/dark → 타입별 배경색
  .bento-card-body/icon/title/desc/arrow/tag → 카드 내부 레이아웃
  .bento-card .time-record-container → position:sticky override (relative로)
  .bento-card .no-goal-container    → flex:8 override (flex:1로)
```

---

## 이슈 및 해결 기록

### 2026-03-07: 레이아웃 CSS / SSR Hydration 불일치

- **현상:** 모바일 뷰에서 `pc-top-utility` 안의 `RecordTimeComponent`(⏰ 카드)가 벤토 그리드 위에 중복 표시되는 경우가 간헐적으로 발생. 또한 1000~1023px 구간에서 JS는 PC로 판단하는데 CSS가 모바일 레이아웃을 강제 적용하는 불일치 존재.
- **원인 1 — CSS 미디어 쿼리 불일치:**

  - `pages.css:229`: `@media (max-width: 1023px)`로 `.group-MAIN_TOP_CARD` 모바일 레이아웃 적용
  - JS `useDeviceType` 기준은 `< 1000px` (999px 이하가 모바일)
  - 1000~1023px 구간: JS는 `is-pc` 클래스 부여 → PC 레이아웃 의도, CSS는 여전히 모바일 강제
- **원인 2 — SSR Hydration 플래시:**

  - `useDeviceType.tsx`: 초기값 `useState(false)` → 서버/첫 렌더링 시 항상 `isMobile = false`
  - `AppShell`에서 `isPc = true`로 시작 → 모바일 기기에서도 첫 렌더에 `pc-top-utility` + `RecordTimeComponent` 렌더링
  - `useEffect`가 실행되며 `isMobile = true`로 전환되지만 그 전에 이미 화면에 그려짐
- **해결:**

  - `pages.css:229`: `@media (max-width: 1023px)` → `@media (max-width: 999px)` (JS 기준 통일)
  - `useDeviceType.tsx`: 초기값 `false` → `true` (모바일 우선 — SSR 렌더는 모바일 레이아웃으로 시작, 실제 PC라면 `useEffect` 후 전환)
- **관련 파일:**

  - `metadata-project/app/styles/pages.css` line 229
  - `metadata-project/hooks/useDeviceType.tsx` line 4

---

## 분석 히스토리

| 날짜                                    | 분석 내용                                         | 결론                                                                    |
| --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| 2026-02-28                              | 전체 프론트엔드 코드 초기 분석                    | 위 내용 도출                                                            |
| 2026-02-28                              | [P2] 민감정보 로그 노출 감사                      | 아래 섹션 참고                                                          |
| 2026-03-05                              | 렌더링 파이프라인 상세 분석                       | 위 섹션 참고                                                            |
| 2026-03-05                              | 전체 레이아웃 구조 분석 (AppShell/Header/Sidebar) | 위 섹션 참고                                                            |
| 2026-03-06                              | MAIN_PAGE 벤토 그리드 전환 — DB SELECT 확인      | SQL 버그 3개 발견 수정 (parent_group_id 누락, DELETE 누락, ROUTE→LINK) |
| 2026-03-06                              | UiService/UiController RBAC 코드 확인             | isAccessible() 구현됨, GUEST 카드 NULL→'ROLE_GUEST' 수정               |
| 2026-03-06                              | componentMap.tsx 확인                             | TIME_RECORD_WIDGET ✅ 등록됨                                            |
| 2026-03-06                              | V8 SQL + pages.css CSS 생성 완료                  | 구현 파일 2개 생성, QA 검증 대기                                        |
| 2026-03-06                              | 로컬 Docker DB + Flyway 마이그레이션 완전 수정 | `backend_engineer/research.md` 참고                                          |
| 2026-03-08                              | 어드민 URL 라우팅 패턴 도입 (`/view/admin/*`) | MetadataProvider.tsx — admin 세그먼트 감지, page.tsx PROTECTED_SCREENS에 USER_LIST 추가 |
| 2026-03-17                              | PWA 설정 추가 (next-pwa v5.6)                 | manifest.json 생성, layout.tsx head 추가, next.config.ts withPWA 래퍼, .gitignore sw.js 제외 |
| `axios.tsx` localStorage → 쿠키 전환 | **P1**                                      | ✅ 수정됨 (2026-03-01, localStorage 라인 주석 처리)                     |
| CSP / 보안 헤더 추가                    | **P1**                                      | ✅ 구현됨 (next.config.ts `async headers()`)                          |
| 백엔드 System.out.println 정리          | **P2**                                      | → `backend_engineer/research.md` 참고                                  |
| 프로덕션 `secure(true)` 설정          | **P2**                                      | → `backend_engineer/research.md` 참고                                  |

---

## 튜토리얼 페이지 (Playground) 구현 분석 (2026-03-07)

### 개요
SDUI의 작동 원리를 시각적으로 보여주기 위한 인터랙티브 튜토리얼 페이지입니다.
사용자가 UI를 조작하면 JSON 메타데이터가 실시간으로 변하는 것을 확인할 수 있습니다.

### 주요 기능
1. **Split View**: 좌측(Preview) ↔ 우측(Editor & JSON) 분할 레이아웃
2. **실시간 렌더링**: `DynamicEngine`을 재사용하여 메타데이터 변경 즉시 반영
3. **Drag & Drop**: 컴포넌트 리스트 순서 변경 (HTML5 Drag API 사용)
4. **Versioning**:
   - '적용' 시 DB에 `TUTORIAL_DEMO`로 저장
   - 기존 데이터는 `TUTORIAL_DEMO_v{timestamp}`로 자동 백업
   - '히스토리' 버튼으로 이전 버전 조회 및 롤백 가능

### 기술 스택 및 파일
| 구분 | 파일명 | 역할 |
|---|---|---|
| **DB** | `V9__tutorial_page.sql` | `TUTORIAL_PAGE` 화면 및 `TUTORIAL_PLAYGROUND` 컴포넌트 정의 |
| **FE** | `TutorialPlayground.tsx` | 메인 로직 (State 관리, D&D, API 호출) |
| **BE** | `TutorialController.java` | `/api/ui/tutorial/*` 엔드포인트 제공 |
| **BE** | `TutorialService.java` | 저장, 히스토리 관리, 버전 백업 로직 |

### API 명세
| Method | Endpoint | 설명 |
|---|---|---|
| `POST` | `/api/ui/tutorial/save` | 현재 메타데이터 저장 (기존 데이터 백업 수행) |
| `GET` | `/api/ui/tutorial/history` | 저장된 히스토리 버전 목록 조회 |
| `GET` | `/api/ui/tutorial/history/{id}` | 특정 버전의 메타데이터 상세 조회 |

---

## 어드민 URL 라우팅 패턴 (2026-03-08)

### 개요

관리자 전용 화면을 일반 화면과 URL 레벨에서 분리하기 위해 `/view/admin/{screenId}` 패턴 도입.

### URL 구조

| 경로 | screenId | refId | 용도 |
|---|---|---|---|
| `/view/MAIN_PAGE` | `MAIN_PAGE` | null | 일반 화면 |
| `/view/CONTENT_DETAIL/42` | `CONTENT_DETAIL` | `42` | 일반 화면 + refId |
| `/view/admin/USER_LIST` | `USER_LIST` | null | 관리자 화면 |
| `/view/admin/USER_DETAIL/5` | `USER_DETAIL` | `5` | 관리자 화면 + refId |

### 수정 파일

- **`MetadataProvider.tsx`**
  - `finalScreenId` useMemo: `pathSegments[viewIndex+1] === 'admin'`이면 `pathSegments[viewIndex+2]` 반환
  - `contextValue` useMemo: `isAdminPath = slug[0] === 'admin'` 플래그로 `slug[1]` → screenId, `slug[2]` → refId

- **`page.tsx`**: `PROTECTED_SCREENS`에 `"USER_LIST"` 추가 (로그인 필수)

### 주의사항

- `screenMap.ts` 수정 불필요 — admin 경로는 URL 파싱으로 처리, SCREEN_MAP 룩업을 타지 않음
- DB의 `screen_id`는 그대로 `USER_LIST` 사용 (백엔드 `/api/ui/{screenId}` 요청도 `USER_LIST`로 그대로 전달)
- 추후 admin 전용 레이아웃이 필요하면 `isAdminPath` 플래그를 Context에 추가해 활용 가능

---

## 관리자 회원 권한 관리 (2026-03-08, 순서 6)

### 신규 파일

| 파일 | 역할 |
|------|------|
| `components/DynamicEngine/hook/useAdminUsers.ts` | 관리자 회원 목록 조회·권한 변경 전용 훅 |
| `components/fields/AdminUserTable.tsx` | `ADMIN_USER_TABLE` 컴포넌트 |

### useAdminUsers.ts 설계 포인트

- **query 상태 분리**: `keyword`/`roleFilter`는 live 입력값, `query`(커밋된 파라미터)가 변경될 때만 API 재조회
  - `handleSearch()` → `setQuery({ keyword, roleFilter, page: 1 })` → `useEffect([query])` 실행
  - `handlePageChange(p)` → `setQuery(prev => ({ ...prev, page: p }))` → keyword/roleFilter 유지
- **체크박스 max-5**: `toggleSelect` 내 `next.size >= 5`에서 alert + 조기 return
- **권한 변경 플로우**: `window.confirm(userId 목록 포함 메시지)` → `PUT /api/admin/users/role` → 목록 새로고침
- axios 인스턴스(`@/services/axios`) 사용 → withCredentials + 401 인터셉터 자동 처리

### AdminUserTable.tsx 설계 포인트

- 기존 `Pagination` 컴포넌트 재사용 (`totalCount`, `pageSize`, `currentPage`, `onPageChange`)
- 기존 `inputfield-core`, `content-btn` CSS 클래스 재사용
- **행 클릭 = 체크박스 토글** (체크박스 td는 `stopPropagation`으로 이중 토글 방지)
- `SelectField`는 이메일 도메인 전용이라 미사용 → 네이티브 `<select>` 직접 사용

### componentMap.tsx 변경

```typescript
ADMIN_USER_TABLE: withRenderTrack(AdminUserTable, "AdminUserTable"),
```

### pages.css 추가 클래스 (line 2320~)

`.admin-page-container`, `.admin-page-header`, `.admin-page-title`, `.admin-back-btn`,
`.admin-user-table-wrapper`, `.admin-toolbar`, `.admin-search-group`, `.admin-search-input`,
`.admin-role-filter`, `.admin-role-select`, `.admin-search-btn`, `.admin-role-control`,
`.admin-change-btn`, `.admin-selection-info`, `.admin-user-table`, `.admin-row-selected`,
`.admin-table-empty`, `.admin-role-badge`, `.badge-admin`, `.badge-user`

---

## USER_LIST 헤더 UI 수정 (2026-03-09)

### 수정 배경
- PC에서 `flex-row-layout`의 `flex-wrap: wrap`으로 인해 "← 돌아가기" 버튼이 제목 아래로 밀려 가운데 배치됨
- `ui_metadata.is_readonly DEFAULT true`로 인해 버튼에 `.is-readonly` 클래스 자동 부여 → 회색 비활성화 스타일

### 수정 내용 (`pages.css:2334~`)

| 문제 | 원인 | 수정 방법 |
|------|------|----------|
| 버튼이 다음 줄로 래핑 | `flex-row-layout { flex-wrap: wrap }` | `.admin-page-header.flex-row-layout { flex-wrap: nowrap }` |
| 제목이 전체 너비 점유 | flex item 기본 크기 | `.admin-page-title { flex: 1 }` |
| 버튼 줄바꿈 | 텍스트 wrap | `.admin-back-btn { white-space: nowrap; flex-shrink: 0 }` |
| 버튼 회색 스타일 | `is-readonly` 기본값 true | `.admin-back-btn.is-readonly { background: none !important; cursor: pointer !important }` |

### 패턴 메모: `is_readonly DEFAULT true` 주의

DynamicEngine이 `is_readonly = true`인 컴포넌트에 `is-readonly` 클래스를 자동 부여.
BUTTON 타입에서 이 클래스가 시각적으로 비활성화처럼 보이는 경우:
1. **CSS 오버라이드 (권장)**: 해당 버튼 클래스에 `is-readonly` 스타일 재정의
2. **DB 수정**: Flyway 마이그레이션에서 `is_readonly = false` 명시

### 히스토리

| 날짜 | 항목 | 결과 |
|------|------|------|
| 2026-03-09 | USER_LIST 헤더 flex-wrap 수정 | PC에서 제목 좌측, 버튼 우측 배치 정상화 |
| 2026-03-09 | admin-back-btn is-readonly CSS 오버라이드 | 버튼 정상 스타일 (클릭 가능, 회색 없음) |
| 2026-03-10 | next.config.ts CSP 수정 — Kakao 우편번호 도메인 이전 대응 | ADDITIONAL_INFO_PAGE 주소 검색 iframe 정상 로드 |

---

## Kakao 우편번호 서비스 도메인 이전 (2026-03-10)

### 배경
- Kakao가 Daum 우편번호 서비스 도메인을 2026년 3월 10일부터 단계적으로 변경
- 기존 `postcode.map.daum.net` → 신규 `postcode.map.kakao.com` (2026-03-10 리다이렉트 시작)
- 기존 `t1.daumcdn.net` CDN → 신규 `t1.kakaocdn.net` (2026-02-12 완료)
- 구 도메인 완전 종료 예정: 2026년 4~5월

### 증상
- `yerin.duckdns.org/view/ADDITIONAL_INFO_PAGE`의 주소 검색 팝업에서 iframe 내부가 "이 콘텐츠는 차단되어 있습니다. 문제를 해결하려면 사이트 소유자에게 문의하세요." 표시
- 원인: `next.config.ts` CSP `frame-src`에 `postcode.map.daum.net`만 허용, `postcode.map.kakao.com` 미포함

### 수정 내용 (`metadata-project/next.config.ts`)

| CSP 디렉티브 | 변경 전 | 변경 후 |
|---|---|---|
| `script-src` | `https://t1.daumcdn.net` | `https://t1.daumcdn.net https://t1.kakaocdn.net` 추가 |
| `frame-src` | `http://postcode.map.daum.net https://postcode.map.daum.net` | `https://postcode.map.kakao.com` 추가 |

### 참고
- `react-daum-postcode@3.2.0` 라이브러리: 기본 `scriptUrl`은 여전히 `t1.daumcdn.net` 사용 (v3.x 기준)
- 2026년 4~5월 이전에 라이브러리를 `react-kakao-postcode`로 교체하거나 `scriptUrl` prop으로 새 URL 지정 필요
- 참조 이슈: https://github.com/daumPostcode/QnA/issues/1498

---

## PWA 설정 (2026-03-17)

### 구현 내용

| 파일 | 변경 내용 |
|------|---------|
| `metadata-project/package.json` | `next-pwa@^5.6.0` 의존성 추가 |
| `metadata-project/next.config.ts` | `withPWA` CommonJS 래퍼 적용, CSP `worker-src 'self'` 추가 |
| `metadata-project/app/layout.tsx` | `<head>` 태그에 manifest, theme-color, Apple 메타 태그 추가 |
| `metadata-project/public/manifest.json` | PWA 앱 매니페스트 생성 |
| `metadata-project/public/icons/` | icon-192x192.png, icon-512x512.png 배치 |
| `metadata-project/.gitignore` | `public/sw.js`, `public/workbox-*.js` 자동 생성 파일 제외 |

### next-pwa v5 주요 설정

```ts
// next.config.ts
const withPWA = require('next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',  // 개발 환경에서 비활성화
    register: true,
    skipWaiting: true,
});
export default withPWA(nextConfig);
```

### 동작 방식
- **개발 (`npm run dev`)**: 서비스 워커 비활성화 (sw.js 미생성)
- **프로덕션 (`npm run build`)**: `public/sw.js`, `public/workbox-*.js` 자동 생성
- **Vercel**: push 시 자동 빌드 → 서비스 워커 자동 생성 및 활성화

### manifest.json 설정
- `start_url`: `/view/MAIN_PAGE` (루트 리다이렉트 반영)
- `display`: `standalone` (앱 모드 — 브라우저 UI 숨김)
- `theme_color`: `#4F46E5` (layout.tsx와 동일)
- `orientation`: `portrait`

---

## PWA 배포 완료 및 후속 수정 (2026-03-17)

### Vercel 빌드 실패 — Turbopack vs webpack 충돌

**증상**: `Error: Call retries were exceeded` at `WorkerError`
**원인**: Next.js 16.1.3에서 Turbopack이 빌드 기본값으로 변경됨. `next-pwa@5.6.0`은 webpack 플러그인이므로 Turbopack과 충돌.
**수정**: `package.json` build 스크립트에 `--webpack` 플래그 추가
```json
"build": "next build --webpack"
```

### PWA 아이콘 404 오류

**증상**: `/icons/icon-192x192.png: 404`
**원인**: 루트 `.gitignore`의 `*.png` 규칙(Playwright 스크린샷 제외 목적)이 PWA 아이콘도 차단
**수정**:
1. `git add -f public/icons/` 로 강제 추가
2. 루트 `.gitignore`에 예외 추가:
```
*.png
!metadata-project/public/icons/*.png
!metadata-project/public/screenshots/*.png
```

### PWA 설치 UI 정상 동작 확인 (2026-03-17)

Chrome DevTools > Application > Manifest에서 **앱 설치 다이얼로그 정상 표시 확인**:
- 앱 아이콘, 이름("SDUI"), 설명("AI 영어 학습 & 목표 관리 앱") 표시
- 앱 화면 미리보기 자동 표시
- `yerin.duckdns.org/view/MAIN_PAGE` 에서 "설치" 버튼 정상 동작

### manifest.json 개선 (2026-03-17)

Chrome DevTools PWA 경고 해소:

| 경고 | 수정 내용 |
|------|---------|
| `id` 필드 없음 | `"id": "/view/MAIN_PAGE"` 추가 |
| `purpose: "any maskable"` 권장 안 됨 | `"any"` 로 변경 (별도 maskable 아이콘 없음) |
| 스크린샷 없음 (풍부한 설치 UI 불가) | `screenshots` 필드 추가 (mobile/desktop PNG 필요) |

```json
{
  "id": "/view/MAIN_PAGE",
  "screenshots": [
    { "src": "/screenshots/mobile.png", "sizes": "390x844", "form_factor": "narrow" },
    { "src": "/screenshots/desktop.png", "sizes": "1280x800", "form_factor": "wide" }
  ]
}
```

> **TODO**: `public/screenshots/mobile.png`, `public/screenshots/desktop.png` 실제 캡처 파일 추가 필요

### layout.tsx 메타 태그 수정 (2026-03-17)

`apple-mobile-web-app-capable` deprecated 경고 해소:
```html
<!-- 추가: 표준 태그 -->
<meta name="mobile-web-app-capable" content="yes" />
<!-- 유지: iOS Safari 전용 -->
<meta name="apple-mobile-web-app-capable" content="yes" />
```

---

## 모바일 RecordTimeComponent UI 수정 (2026-03-18)

### 문제 1: RecordTimeComponent 헤더 overlay (z-index 충돌)

**증상**: 모바일 MAIN_PAGE에서 헤더의 RecordTimeComponent가 벤토 카드 위에 overlay되어 날짜 텍스트 위에 "목표시간 월 일 요일 오전 시 분 분 남음" 겹쳐 표시

**원인 분석**:
- `pages.css`: `.time-record-container { position: sticky; top: 0; z-index: 100 }` (기본값)
- `Header.tsx`의 `header-bottom-row > time-card` 내부 RecordTimeComponent에 `.main-bento` override가 없어 sticky 유지

**수정**:
1. `Header.tsx` — MAIN_PAGE에서 `header-bottom-row` 렌더링 제외 (벤토에 이미 TIME_RECORD_WIDGET 존재)
   ```tsx
   {pathname !== '/view/MAIN_PAGE' && (
       <div className="header-bottom-row">
           <div className="time-card"><RecordTimeComponent /></div>
       </div>
   )}
   ```
2. `pages.css` — time-card 컨텍스트의 sticky/z-index 해제 + 줄바꿈 방지
   ```css
   .time-card .time-record-container { position: relative !important; z-index: auto !important; }
   .time-card .formatted-time, .time-card .remain-time { white-space: nowrap; }
   .time-card .arrival-button { width: auto; }
   ```

---

## AI 컴포넌트 프론트엔드 설계 (2026-03-11, .ai2 병합)

> 원본: `.ai2/frontend_engineer/research.md`

### 신규 컴포넌트

| 컴포넌트 | 경로 | 역할 |
|----------|------|------|
| `AIChatComponent.tsx` | `components/fields/` | AI 영어/한국어 대화 |
| `AIChatComponentV2.tsx` | `components/fields/` | V2 (글래스모피즘) |
| `AIInterviewComponent.tsx` | `components/fields/` | AI 면접관 |
| `ConversationPanelV2.tsx` | `components/fields/` | V2 말풍선 렌더링 |

### SSE 소비 패턴 (EventSource 대신 fetch)

```typescript
// EventSource는 GET 전용 + 커스텀 헤더 불가
// fetch + ReadableStream 사용 (POST body + JWT 지원)
const response = await fetch('/api/ai/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
  body: JSON.stringify({ messages, language: 'en' }),
});
const reader = response.body!.getReader();
// AbortController로 컴포넌트 언마운트 시 정리 필수
```

### AudioContext 단일 인스턴스 패턴

```typescript
const audioContextRef = useRef<AudioContext | null>(null);
// 브라우저 최대 6개 제한 → useRef로 단일 인스턴스 유지
// 컴포넌트 언마운트 시 audioContextRef.current?.close()
```

### componentMap 등록

```typescript
AI_CHAT: AIChatComponent,
AI_CHAT_V2: AIChatComponentV2,
AI_INTERVIEW: AIInterviewComponent,
```

### 분석 히스토리

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-11 | SSE 소비 방식 결정 | fetch + ReadableStream 채택 (POST + JWT 지원) |
| 2026-03-11 | AI 응답 방식 결정 | TTS 없음, 텍스트 채팅창만 표시 |

---

## CheckboxField 신규 컴포넌트 (2026-03-20)

### 개요

"나만 보기" 기능을 위해 SDUI 엔진에 CHECKBOX 컴포넌트 타입 추가.

### 파일

- `components/fields/CheckboxField.tsx` — 신규
- `components/constants/componentMap.tsx` — `CHECKBOX` 타입 등록

### 컴포넌트 패턴

`EmotionSelectField`와 동일한 패턴:
- `targetKey = meta?.ref_data_id || meta?.refDataId || id` — formData 키 결정
- `onChange?.(targetKey, e.target.checked)` — boolean 값 업데이트
- `data?.[targetKey] === true || data?.[targetKey] === 'true'` — checked 상태 (boolean/string 모두 처리)
- `accent-color: #FDBFBC` — 프로젝트 컬러 적용

### componentMap 등록

```typescript
CHECKBOX: withRenderTrack(CheckboxField, "CheckboxField"),
```

### ui_metadata 패턴

```sql
component_type = 'CHECKBOX'
component_id   = 'is_private'   -- formData key로 사용
parent_group_id = 'DIARYWRITE_SECTION'
sort_order = 65  -- save_btn(70) 직전
is_readonly = false  -- 인터랙티브 컴포넌트
```

### CSS

`DIARY_WRITE.css` 끝에 `.checkbox-field-container`, `.checkbox-label`, `.checkbox-input`, `.checkbox-text` 추가.
| 2026-03-11 | 언어 모드 결정 | 영어/한국어 별도 screenId로 분리 |
