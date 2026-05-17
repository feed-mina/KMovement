# K-Ride SDUI 화면 분석

> 분석일: 2026-05-16 | 최종 업데이트: 2026-05-17 (V48 통합 마이그레이션)
> 원본 참조: `.ai/kride_sdui_screen.md`, `.ai/kride2.md`, `subproject/SDUI/.ai/frontend_engineer/`

---

## 1. 전체 온보딩 화면 흐름

```
INTRO1 (여행 기간)  →  INTRO2 (아티스트)  →  INTRO3 (지역)
  ↓ SET_DURATION        ↓ TOGGLE_ARTIST       ↓ TOGGLE_REGION
                                                   ↓
                     MY_LIST (요약)  ←  INTRO5 (예산)  ←  INTRO4 (목적)
                          ↓              ↑ GOTO_MY_LIST     ↓ SET_PURPOSES
                     FOCUS (지도+일정)       ↑ GOTO_FOCUS
```

| 화면 | screenId | 액션 | 다음 화면 |
|------|----------|------|----------|
| INTRO1 | KRIDE_INTRO1 | SET_DURATION | INTRO2 |
| INTRO2 | KRIDE_INTRO2 | TOGGLE_ARTIST | INTRO3 |
| INTRO3 | KRIDE_INTRO3 | TOGGLE_REGION | INTRO4 |
| INTRO4 | KRIDE_INTRO4 | SET_PURPOSES → ROUTE | INTRO5 |
| INTRO5 | KRIDE_INTRO5 | GOTO_MY_LIST | MY_LIST |
| MY_LIST | KRIDE_MY_LIST | GOTO_FOCUS | FOCUS |
| FOCUS | KRIDE_FOCUS | — | — |

---

## 2. 화면별 구현 현황

### INTRO1 [완료]
- 검은 배경 + SVG 히어로 이미지 (`public/img/kride/intro1_hero.svg`)
- 큰 타이틀 + 하단 빨간 버튼 3개 (당일치기/1박2일/2박3일)
- V44 배포 필요: DB `label_text='kride/intro1_hero.png'` → `.svg` 변경

### INTRO2 [완료]
- 아티스트 3열 grid (`grid grid-cols-3 gap-6 pb-24 w-full`) — V46에서 `place-items-center` 제거
- 최대 5개 선택, 초과 시 경고 토스트
- 1개 이상 선택 시 KRIDE_NEXT_BTN 표시
- 이미지 없을 때 이름 이니셜 원형 폴백 — CardImage.tsx 수정 (2026-05-17)

### INTRO3 [완료]
- 지역 chip 4열 grid (`grid grid-cols-4 gap-3 pb-28`) — V46에서 `flex flex-wrap`에서 변경
- 최대 2개 선택, 초과 시 경고 토스트
- 1개 이상 선택 시 KRIDE_NEXT_BTN 표시

### INTRO4 [완료]
- 목적 카드 6개 (맛집탐방/K-컬처/자연힐링/역사문화/쇼핑/휴식)
- **단일 선택** (다른 것 클릭 시 이전 선택 해제)
- V45 배포: 서브타이틀 "1개만 선택할 수 있어요"
- V47 배포: `intro4_title` sticky + `intro4_next_wrap` z-50 ('여' 겹침 + 버튼 가려짐 해결)

### INTRO5 [구현됨, 검증 필요]
- 예산 DualRangeSlider
- "AI 여행 추천 받기" 버튼 (GOTO_MY_LIST)

### MY_LIST [구현됨, 검증 필요]
- 선택값 요약 표시
- "AI 추천 시작" 버튼 (GOTO_FOCUS)

### FOCUS [미연동]
- MAP_VIEW + ITINERARY_PANEL 컴포넌트 DB 정의됨
- FastAPI 응답 데이터가 pageData로 주입되지 않는 상태

---

## 3. 핵심 컴포넌트 분석

### DynamicEngine.tsx 주요 로직
- GROUP 노드: `css_class`에 `grid`/`flex` 키워드 있으면 direction 클래스(`flex-row-layout`/`flex-col-layout`) 추가하지 않음
- REPEATER(`ref_data_id` 있는 GROUP): `css_class`에 `grid` 키워드 있으면 wrapper div로 묶어 grid container로 동작, 아이템은 클래스 없이 내부에 배치 — 2026-05-17 수정
- `KRIDE_NEEDS_FORM` Set: `SELECTION_CARD, PURPOSE_CARD, DUAL_RANGE_SLIDER, KRIDE_NEXT_BTN`

### SelectionCard.tsx 동작
| mode | 렌더링 | 최대 선택 | 초과 시 |
|------|--------|----------|---------|
| `circle` | 원형 이미지 | 5개 (아티스트) | `kride-warning` 이벤트 |
| `chip` | 둥근 태그 | 2개 (지역) | `kride-warning` 이벤트 |
| `square` | 사각 이미지 | — | — |

### localStorage 구조 (`kride_form`)
```json
{
  "duration": "당일치기",
  "selectedArtists": ["BTS"],
  "selectedRegions": ["서울"],
  "purposes": ["kculture"],
  "budget": { "min": 500000, "max": 2000000 }
}
```

---

## 4. CSS Cascade 문제 (1차 해결됨) + REPEATER wrapper 누락 (2차 근본 원인, 해결됨)

### 1차 문제: CSS Cascade (V46 이전)
**원인:**
```
pages.css: .flex-row-layout { display: flex; } (0-1-0 specificity, 나중에 선언)
Tailwind: .grid { display: grid; } (0-1-0 specificity, 먼저 선언)
→ 동일 specificity에서 cascade 순서상 flex가 grid를 덮어씀
```
**해결:** DynamicEngine.tsx에서 `customClass`에 `grid`/`flex` 키워드 있으면 direction 클래스 추가 안 함

### 2차 문제: REPEATER wrapper 누락 (V46~V47 이후에도 grid 1열 지속된 진짜 원인)
**원인:** REPEATER(`ref_data_id` 있는 GROUP)는 `list.map()`으로 각 아이템 div를 생성하는데, 각 아이템 div에 `grid grid-cols-3` 클래스가 적용되어 각자 독립적인 grid container가 되어버림 → 부모 관계 없이 block 배치 → 세로 1열

**해결 (2026-05-17):** `css_class`에 `grid` 키워드 있는 REPEATER에 한해 외부 wrapper div 하나로 묶어 grid container로, 각 아이템은 클래스 없는 div로 배치

---

## 5. 화면 등록 현황

`components/constants/screenMap.ts`에 KRIDE 화면 등록됨:
- `/view/KRIDE_INTRO1` ~ `/view/KRIDE_INTRO5`
- `/view/KRIDE_MY_LIST`
- `/view/KRIDE_FOCUS`

---

## 6. PWA에서 localStorage / sessionStorage 사용 가능 여부

> plan.md [메모] 답변 — 2026-05-17

**결론: 사용 가능, 단 아래 주의사항 확인 필요**

| 스토리지 | PWA 지원 | 주의사항 |
|---------|---------|---------|
| `localStorage` | ✅ 모든 주요 브라우저 지원 | iOS Safari 개인정보 보호 모드에서 할당 실패 가능 |
| `sessionStorage` | ✅ 모든 주요 브라우저 지원 | 탭 종료 시 삭제, PWA 재진입 시 데이터 없음 |

**현재 사용 패턴:**
- `kride_form` → `localStorage`: 온보딩 완료 데이터 (여행 기간, 아티스트, 지역 등). 앱 재시작 후에도 유지되어야 하므로 localStorage 적합.
- `kride_focus_data` → `sessionStorage`: FastAPI 추천 결과 (일회성, 세션 중 유효). sessionStorage 적합.

**iOS Safari private 모드 대응 (선택):**
```typescript
function safeLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private 모드 fallback: 인메모리 캐시 또는 무시
    console.warn('[kride] localStorage 저장 실패 — private 모드 가능성');
  }
}
```

**PWA 설치 후 동작:** `next-pwa`로 생성된 Service Worker는 localStorage/sessionStorage를 간섭하지 않음. 캐시 전략은 `workbox-strategies` (네트워크 요청 수준)에서 작동하므로 충돌 없음.

---

## 7. DynamicEngine REPEATER wrapper 누락 문제 — 2026-05-17

> 아침2 캡처 분석으로 발견. INTRO2/INTRO3 grid 1열 나열의 진짜 원인.

### 문제 구조

`artist_grid`(INTRO2)와 `region_grid`(INTRO3)는 `ref_data_id`가 있으므로 REPEATER로 처리된다.

**DynamicEngine.tsx 87~101번 줄 현재 코드:**
```tsx
if (isRepeater) {
    return list.map((item, idx) => (
        <div key={`${uId}-${idx}`} className={combinedClassName} onClick={handleClick}>
            {renderNodes(node.children, item)}
        </div>
    ));
}
```

`combinedClassName`에는 `grid grid-cols-3 gap-6 w-full` 등 grid 클래스가 포함됨.
`list.map()`은 각 아이템 div를 부모 요소 바로 아래에 배치하므로:

```html
<!-- 실제 렌더링 (잘못됨) -->
<div class="group-artist_grid grid grid-cols-3 ...">  ← BTS 아이템 (각자 독립 grid)
  <CardImage /><CardLabel /><CheckIndicator />
</div>
<div class="group-artist_grid grid grid-cols-3 ...">  ← BLACKPINK 아이템
  ...
</div>
```

→ 각 카드가 독립적인 3열 grid가 되어버림. 카드 사이 배치 관계는 기본 block → 세로 1열.

### 올바른 구조 (수정 후)

```html
<!-- 올바른 렌더링 -->
<div class="group-artist_grid grid grid-cols-3 gap-6 w-full">  ← grid container (wrapper)
  <div>BTS 카드</div>       ← grid item
  <div>BLACKPINK 카드</div>
  <div>IVE 카드</div>
</div>
```

### 영향 범위

REPEATER(`ref_data_id` 있는 GROUP)를 사용하는 모든 화면에 영향:
- `artist_grid` (INTRO2) — 아티스트 3열 grid
- `region_grid` (INTRO3) — 지역 4열 grid
- `purpose_grid` (INTRO4) — 목적 카드 1열 (flex-col이라 기존에도 작동처럼 보였음)
- 그 외 기존 화면의 REPEATER 그룹

수정 후 기존 화면 회귀 테스트 필수 (MAIN_PAGE, LOGIN_PAGE, DIARY_LIST 등).

### 해결 방법 (실제 구현 — 2026-05-17)

`DynamicEngine.tsx` REPEATER 블록에 grid 키워드 조건부 wrapper 추가:
```tsx
if (isRepeater) {
    const isGridLayout = customClass && /\bgrid\b/.test(customClass);

    if (isGridLayout) {
        // grid REPEATER: 외부 wrapper가 grid container, 아이템은 클래스 없음
        return (
            <div key={uId} className={combinedClassName}>
                {list.map((item, idx) => {
                    const handleClick = hasAction ? () => onAction(node, item) : undefined;
                    return (
                        <div key={`${uId}-${idx}`} style={{ cursor: hasAction ? 'pointer' : 'default' }} onClick={handleClick}>
                            {renderNodes(node.children, item)}
                        </div>
                    );
                })}
            </div>
        );
    }

    // 기존 방식 유지 (flex/direction 기반 REPEATER — 기존 화면 회귀 방지)
    return list.map((item, idx) => {
        const handleClick = hasAction ? () => onAction(node, item) : undefined;
        return (
            <div key={`${uId}-${idx}`} className={combinedClassName} style={{ cursor: hasAction ? 'pointer' : 'default' }} onClick={handleClick}>
                {renderNodes(node.children, item)}
            </div>
        );
    });
}
```

**영향 범위:**
- `artist_grid` (grid-cols-3) → wrapper 방식 ✓
- `region_grid` (grid-cols-4) → wrapper 방식 ✓
- `purpose_grid` (w-full, grid 없음) → 기존 방식 ✓
- 기존 화면 REPEATER → 기존 방식 ✓

---

## 8. INTRO 화면 레이아웃 이슈 및 해결 이력 — 2026-05-17

> plan.md [메모] "grid 정렬이 안됨" 답변

| 화면 | 증상 | 원인 | 해결 (V46) |
|------|------|------|-----------|
| INTRO2 | 아티스트 3열 grid 정렬 불량, 헤더 스크롤 사라짐 | artist_grid `place-items-center` 충돌, 헤더 미고정 | `place-items-center` 제거, `sticky top-0` 추가 |
| INTRO3 | chip 태그 세로 1열로 보임 | `flex flex-wrap`에서 SelectionCard `w-full` 미설정 | `grid grid-cols-4` + SelectionCard chip 모드 `w-full` 추가 |
| INTRO1 | 제목 정적 텍스트, 버튼 하단 고정 | `mt-auto`, TEXT component_type | `TYPEWRITER_TEXT`로 변경, `mt-6`으로 버튼 중앙 배치 |

**신규 컴포넌트 — TypewriterText:**
```tsx
// components/fields/kride/TypewriterText.tsx
// TYPEWRITER_TEXT component_type에 매핑
// 80ms 간격으로 text를 한 글자씩 표시
```
componentMap.tsx에 `TYPEWRITER_TEXT` 등록 완료.

---

## 9. Tailwind CSS v4 동적 클래스 누락 문제 — 2026-05-17 [변경: V48 적용]

### 근본 원인

DynamicEngine 코드 ✅, DB 값 ✅, 서버 재시작 ✅ → 그래도 grid 안 됨.

**Tailwind CSS v4는 소스 파일을 정적 스캔해서 CSS를 생성.** DB에서 런타임으로 주입되는 클래스는 소스 파일에 없으면 CSS 규칙 자체가 생성되지 않음.

| 클래스 | V48 이전 | V48 이후 |
|--------|----------|----------|
| `grid-cols-3` | ❌ CSS 규칙 없음 (3열 불가) | ✅ safelist 포함 |
| `grid-cols-4` | ❌ CSS 규칙 없음 (4열 불가) | ✅ safelist 포함 |
| `gap-6`, `pb-24`, `pb-28` | ❌ 없음 | ✅ safelist 포함 |
| `z-10`, `z-50`, `sticky` | ❌ 없음 | ✅ safelist 포함 |
| `grid` | ✅ (기본 유틸리티) | ✅ 유지 |

→ DOM에 `class="grid grid-cols-3 ..."` 는 붙지만 `grid-cols-3` 에 해당하는 `grid-template-columns` CSS 규칙이 없어 1열로 보이던 현상.

### 해결 [변경: 2026-05-17]

**파일:** `subproject/SDUI/metadata-project/app/globals.css`

`@import "tailwindcss"` 바로 다음에 추가:

```css
/* SDUI 동적 클래스 safelist — DB에서 런타임으로 주입되는 클래스 */
@source inline("grid-cols-1 grid-cols-2 grid-cols-3 grid-cols-4 grid-cols-5 grid-cols-6 gap-1 gap-2 gap-3 gap-4 gap-5 gap-6 gap-8 pb-4 pb-6 pb-8 pb-10 pb-12 pb-24 pb-28 pt-4 pt-6 pt-8 pt-10 pt-12 place-items-center sticky top-0 z-10 z-50 aspect-square object-cover object-contain");
```

이 한 줄로 INTRO2 3열, INTRO3 4열 즉시 해결 예상. `npm run dev` 재시작 필요.

---

## 10. V48 통합 SQL 마이그레이션 — 2026-05-17 [신규]

### 목적

V40~V47 각 버전에 걸쳐 분산된 KRIDE 데이터를 단일 파일로 통합. 멱등 실행 (DELETE → INSERT).

**파일 위치:** `.ai/V48__kride_consolidated.sql`

### 수정 사항 요약

| 컴포넌트 | 변경 내용 | 적용 버전 |
|---------|----------|----------|
| `btn_2n3d` | component_id 마크다운 이미지 문법 오염 수정 (`![...]` → `btn_2n3d`) | V48 신규 수정 |
| `region_grid` | `flex flex-wrap` → `grid grid-cols-4 gap-3 pb-28` | V46 → V48 통합 |
| `region_card` | `square` → `chip` | V43 → V48 통합 |
| `intro4_next_wrap` | `z-50` 추가 (버튼 가려짐 해결) | V47 → V48 통합 |
| `purpose_grid` | `flex flex-col gap-3 pb-24` → `w-full` | V47 → V48 통합 |
| `intro4_root` | `pb-28 gap-3` 컴팩트화 | V47 → V48 통합 |
| `intro1_title` | `TEXT` → `TYPEWRITER_TEXT` | V46 → V48 통합 |
| `intro3_sub` | '최대 5곳' → '최대 2곳' | 정합성 수정 |

### 적용 절차

```
1. globals.css @source inline 추가 → npm run dev 재시작
2. /view/KRIDE_INTRO2 확인 (3열 grid)
3. INTRO3 여전히 깨지면: pgAdmin에서 V48 SQL 실행 → Spring Boot 재시작
4. /view/KRIDE_INTRO3 확인 (4열 grid)
```

### 검증 체크리스트

| 항목 | 기대 결과 | 상태 |
|------|----------|------|
| `/view/KRIDE_INTRO2` | 아티스트 3열 grid, 이니셜 원형 아이콘 | 확인 필요 |
| `/view/KRIDE_INTRO3` | 지역 chip 4열 grid | 확인 필요 |
| `/view/KRIDE_INTRO4` | 목적 카드 1열 + 하단 버튼 즉시 표시 | 확인 필요 |
| `/view/KRIDE_INTRO1` | 타이핑 효과 타이틀 | 확인 필요 |
| 기존 화면 | MAIN_PAGE, LOGIN_PAGE 회귀 없음 | 확인 필요 |
