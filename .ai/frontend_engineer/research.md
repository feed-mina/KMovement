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

## 9. Tailwind CSS v4 동적 클래스 누락 문제 — 2026-05-17 [최종 해결: 2026-05-17]

### 문제 발생 배경

DynamicEngine 코드 ✅, DB 값 ✅, 서버 재시작 ✅ → 그래도 grid 안 됨.

**Tailwind CSS v4는 소스 파일을 정적 스캔해서 CSS를 생성.** DB에서 런타임으로 주입되는 클래스는 소스 파일에 없으면 CSS 규칙 자체가 생성되지 않음.

→ DOM에 `class="grid grid-cols-3 ..."` 는 붙지만 `grid-cols-3` CSS 규칙이 없어 1열로 보이던 현상.

### 시도 1: @source inline (실패)

`globals.css`에 `@source inline("... grid-cols-3 ...")` 추가 + `@import "./styles/KRIDE.css"`.

→ **실패 원인:** CSS 스펙상 `@import`는 다른 규칙보다 반드시 먼저 와야 함.
`@source inline(...)` (비표준 Tailwind 지시어)이 실행된 이후에 위치한 `@import` 구문은 CSS 파서가 무시.
KRIDE.css가 브라우저에 로드되지 않음 (DevTools Sources에서 파일 자체가 안 보임).

### 시도 2: V49 SQL + flex-wrap 전략 (성공 조건 확인)

DB `css_class`를 `grid grid-cols-3` → `kride-artist-grid flex-wrap`으로 변경.
DynamicEngine이 `flex-wrap` 키워드 감지 → wrapper 모드 → KRIDE.css 정적 CSS 적용.

→ **DB 변경 자체는 성공** (pgAdmin SELECT로 확인), 그러나 화면 미반영.
→ **추가 원인:** pgAdmin DML 후 Spring Boot Redis 캐시(1시간 TTL)가 구버전 데이터를 계속 서빙.
→ Redis FLUSHALL 또는 Spring Boot 재시작 필수.

### 최종 해결 (2026-05-17)

**KRIDE CSS를 `globals.css`에 직접 인라인으로 작성.**

`@import` 의존을 완전히 제거 → CSS 파서 순서 문제 회피 → 항상 번들에 포함.

```css
/* globals.css 맨 아래에 직접 작성 */
.kride-artist-grid {
    display: flex; flex-wrap: wrap; gap: 1.5rem; width: 100%; padding-bottom: 6rem;
}
.kride-artist-grid > div {
    width: calc((100% - 3rem) / 3); display: flex; justify-content: center;
}
.kride-region-grid {
    display: flex; flex-wrap: wrap; gap: 0.75rem; width: 100%; padding-bottom: 7rem;
}
.kride-region-grid > div {
    width: calc((100% - 2.25rem) / 4); display: flex; justify-content: center;
}
```

### pgAdmin DML 후 반드시 해야 할 것

```
pgAdmin DML 실행
  → Spring Boot 재시작 (Redis 캐시 초기화)
  → npm run dev 재시작
  → 브라우저 새로고침
```

Redis 강제 플러시:
```bash
docker-compose exec redis redis-cli FLUSHALL
```

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

### 최종 적용 절차 (2026-05-17 확정)

```
1. pgAdmin에서 V49 SQL 실행 (artist_grid, region_grid css_class 변경)
2. globals.css에 KRIDE CSS 인라인 작성 (@import 제거) → npm run dev 재시작
3. Spring Boot 재시작 (Redis 캐시 플러시)
4. /view/INTRO2 확인 (3열), /view/INTRO3 확인 (4열)
```

### 검증 체크리스트

| 항목 | 기대 결과 | 상태 |
|------|----------|------|
| `/view/KRIDE_INTRO2` | 아티스트 3열 grid, 이니셜 원형 아이콘 | 확인 필요 |
| `/view/KRIDE_INTRO3` | 지역 chip 4열 grid | 확인 필요 |
| `/view/KRIDE_INTRO4` | 목적 카드 1열 + 하단 버튼 즉시 표시 | 확인 필요 |
| `/view/KRIDE_INTRO1` | 타이핑 효과 타이틀 | 확인 필요 |
| 기존 화면 | MAIN_PAGE, LOGIN_PAGE 회귀 없음 | 확인 필요 |

---

## 11. SDUI 핵심 구조 분석 — group_direction + REPEATER 패턴 (2026-05-17)

> 샘플: `CONTENT_MODIFY`, `MAIN_PAGE` DB 전체 분석

### 11-1. group_direction 작동 원리

`group_direction`은 DynamicEngine이 GROUP 노드에 붙이는 CSS 클래스를 결정한다.

| group_direction | DynamicEngine 클래스 | 실제 CSS 효과 |
|----------------|---------------------|-------------|
| `COLUMN` | `flex-col-layout` | `display:flex; flex-direction:column` |
| `ROW` | `flex-row-layout` | `display:flex; flex-direction:row` |
| null | (없음) | 기본 block |

**핵심:** `css_class`에 `grid` 또는 `flex` 키워드가 있으면 direction 클래스를 추가하지 않음 (DynamicEngine 기존 로직).

---

### 11-2. CONTENT_MODIFY 트리 구조

`DAYTAG_SUB_GROUP` — **ROW 실사용 예시**

```
DETAIL_SECTION (GROUP, COLUMN, parent=null)   ← 루트, css: write_section1
├── content_detail_source (DATA_SOURCE, sort=0, is_visible=false, AUTO_FETCH, sql_key=GET_CONTENT_DETAIL)
├── selected_times     (TIME_SELECT,      sort=10, ref_data_id=selected_times)
├── label_contentTitle (TEXT,             sort=20)
├── contentTitle       (INPUT,            sort=21, ref_data_id=title)
├── content            (TEXTAREA,         sort=30, ref_data_id=content)
├── DAYTAG_SUB_GROUP   (GROUP, **ROW**,   sort=40, css: write_sub_group)  ← 가로 배치
│   ├── GROUP_TAG_ROW1 (GROUP, COLUMN, sort=70)
│   │   ├── title_dayTag1 (TEXT,  sort=71, label: 하루태그1)
│   │   └── day_tag1      (INPUT, sort=72, ref_data_id=day_tag1)
│   ├── GROUP_TAG_ROW2 (GROUP, COLUMN, sort=80)
│   │   ├── title_dayTag2 (TEXT,  sort=81)
│   │   └── day_tag2      (INPUT, sort=82, ref_data_id=day_tag2)
│   └── GROUP_TAG_ROW3 (GROUP, COLUMN, sort=90)
│       ├── title_dayTag3 (TEXT,  sort=91)
│       └── day_tag3      (INPUT, sort=92, ref_data_id=day_tag3)
├── daily_slots    (TIME_SLOT_RECORD, sort=50, ref_data_id=daily_slots)
├── EMOTION_SUB_GROUP  (GROUP, COLUMN, sort=60, css: write_sub_group)
│   └── emotion    (EMOTION_SELECT, sort=52, ref_data_id=emotion)
├── is_private     (CHECKBOX, sort=65, ref_data_id=is_private)
└── go_list_btn    (BUTTON,   sort=71, SUBMIT → /api/execute/UPDATE_CONTENT_DETAIL)
```

**ROW 패턴 해석:**
- `DAYTAG_SUB_GROUP` (ROW) → 자식 GROUP 3개가 가로로 나란히 배치
- 각 자식 GROUP은 COLUMN → label + input이 세로로 적층
- 결과: 3열 레이블+입력 폼을 **CSS grid 없이 순수 flex 중첩으로 구현**

---

### 11-3. MAIN_PAGE 트리 구조

```
MAIN_SECTION (GROUP, COLUMN, group_id=MAIN_SECTION, parent=null, css: main-bento)  ← group_id가 자신 = 루트 표시
│
├── [ROLE_USER]
│   ├── main_bento_appointment   (TIME_RECORD_WIDGET, sort=10, css: bento-card col-span-2)
│   ├── main_bento_content_grp   (GROUP, COLUMN, sort=20, css: bento-card, LINK→CONTENT_WRITE)
│   │   └── main_bento_content_body (GROUP, COLUMN)
│   │       ├── main_bento_content_icon  (TEXT: 📔)
│   │       ├── main_bento_content_title (TEXT: 콘텐츠 작성하기)
│   │       └── main_bento_content_desc  (TEXT)
│   ├── main_bento_view_grp  (GROUP, COLUMN, sort=30, css: bento-card col-span-3, LINK→CONTENT_LIST)
│   │   ├── main_bento_view_body (GROUP, COLUMN)
│   │   │   ├── main_bento_view_title (TEXT)
│   │   │   └── main_bento_view_desc  (TEXT)
│   │   └── main_bento_view_btn  (TEXT: 📖 콘텐츠 목록)
│   └── main_bento_tutorial_grp (GROUP, COLUMN, sort=30, css: bento-card col-span-3, LINK→AI_ENGLISH_CHAT_PAGE)
│       └── main_bento_tutorial_body (GROUP, COLUMN)
│           ├── main_bento_tutorial_title (TEXT: AI 영어 채팅)
│           ├── main_bento_tutorial_desc  (TEXT)
│           └── main_bento_tutorial_btn   (TEXT: 📖 튜토리얼, LINK)
│
├── [ROLE_ADMIN]
│   ├── admin_stats_card (GROUP, COLUMN, sort=10, css: bento-card col-span-2)
│   │   ├── admin_stats_title (TEXT: 📊 시스템 현황)
│   │   └── admin_stats_row  (GROUP, **ROW**, sort=2, ref_data_id=admin_stats_source)  ← REPEATER+ROW
│   │       ├── admin_stat_users    (TEXT: {total_users}\n총 사용자)
│   │       ├── admin_stat_diaries  (TEXT: {today_contents}\n오늘의 콘텐츠)
│   │       └── admin_stat_new_users (TEXT: {new_users}\n신규 가입)
│   ├── admin_users_card (GROUP, COLUMN, sort=20, LINK→USER_LIST)
│   │   ├── admin_users_header (GROUP, **ROW**, sort=1)  ← ROW: 제목+버튼 가로 배치
│   │   │   ├── admin_users_title (TEXT: 👥 회원 관리)
│   │   │   └── admin_users_btn   (BUTTON: →)
│   │   └── admin_users_desc (TEXT)
│   └── admin_logs_card  (GROUP, COLUMN, sort=30, css: col-span-3)
│       ├── admin_logs_title (TEXT: 🚨 최근 시스템 로그)
│       └── admin_logs_list  (GROUP, COLUMN, ref_data_id=admin_logs_source)  ← REPEATER+COLUMN
│           └── admin_log_item_template (GROUP, **ROW**, sort=1)  ← 아이템 내부 ROW
│               ├── admin_log_msg  (TEXT: [{log_level}] {message})
│               └── admin_log_time (TEXT: {log_time})
│
└── [ROLE_GUEST]
    ├── main_bento_nogoal    (TIME_RECORD_WIDGET, sort=10, css: bento-card col-span-2)
    ├── main_bento_login_grp (GROUP, COLUMN, sort=20, LINK→LOGIN_PAGE)
    │   ├── main_bento_login_body (GROUP, COLUMN)
    │   │   ├── main_bento_login_title (TEXT)
    │   │   └── main_bento_login_desc  (TEXT)
    │   └── main_bento_login_btn (TEXT: →)
    └── main_bento_tutorial_grp (...)
```

**DATA_SOURCE 노드:**
- `admin_stats_source` (DATA_SOURCE, sort=5, parent=null, AUTO_FETCH, sql_key=GET_ADMIN_STATS)
- `admin_logs_source`  (DATA_SOURCE, sort=6, parent=null, AUTO_FETCH, sql_key=GET_SYSTEM_LOGS)

---

### 11-4. 핵심 패턴 정리

#### 패턴 A — ROW 안에 COLUMN 중첩 (정적 다열)
```
GROUP (ROW)          → flex-row-layout (가로)
├── GROUP (COLUMN)   → flex-col-layout (세로)
│   ├── TEXT
│   └── INPUT
├── GROUP (COLUMN)
│   ├── TEXT
│   └── INPUT
└── GROUP (COLUMN)
    ├── TEXT
    └── INPUT
```
→ **CONTENT_MODIFY 태그 3열** 이 방식으로 구현됨. CSS grid 불필요.

#### 패턴 B — REPEATER + ROW (동적 가로 목록)
```
GROUP (ROW, ref_data_id=source)   ← REPEATER: 데이터 수만큼 반복
└── TEXT ({field})                 ← 각 아이템 → 가로로 나열
```
→ **MAIN_PAGE admin_stats_row**: 통계 수치 3개 가로 배열

#### 패턴 C — REPEATER + COLUMN + 내부 ROW (동적 세로 목록, 각 행은 가로)
```
GROUP (COLUMN, ref_data_id=source)   ← REPEATER: 아이템마다 한 행
└── GROUP (ROW)                       ← 아이템 내부 가로 배치
    ├── TEXT ({message})
    └── TEXT ({time})
```
→ **MAIN_PAGE admin_logs_list**: 로그 목록, 각 줄은 메시지+시간 가로

#### 패턴 D — col-span CSS (정적 CSS 기반 grid)
`MAIN_SECTION`의 `main-bento` CSS class가 CSS 파일에서 grid로 정의되어 있고, 자식들의 `col-span-2`, `col-span-3`가 정적 CSS에서 정의된 클래스. **Tailwind 동적 클래스 아님 → 빌드 문제 없음.**

---

### 11-5. KRIDE 다열 레이아웃 재설계 방향 [변경: V49 적용]

**결론: SDUI 순수 패턴 — 정적 CSS(`KRIDE.css`) + DynamicEngine wrapper 신호 조합**

| 기존 (grid 시도) | 새 방향 (V49) |
|----------------|--------------|
| `grid grid-cols-3` (Tailwind 동적) | `grid kride-artist-grid` (정적 CSS에서 flex-wrap 정의) |
| `grid grid-cols-4` (Tailwind 동적) | `grid kride-region-grid` (정적 CSS에서 flex-wrap 정의) |
| Tailwind safelist 의존 | `app/styles/KRIDE.css` 정적 정의 → 빌드 문제 없음 |

---

### 11-6. `grid kride-artist-grid` 이중 클래스 설계 이유 [2026-05-17]

#### `grid` 키워드를 유지하는 이유 — DynamicEngine 신호

`grid` 는 CSS 용도가 아니라 **DynamicEngine REPEATER 분기 신호**다.

```tsx
// DynamicEngine.tsx line 88
const isGridLayout = customClass && /\bgrid\b/.test(customClass);

if (isGridLayout) {
    // wrapper 방식: 외부 div 하나 + 아이템 N개 내부 배치
    return (
        <div className={combinedClassName}>   ← grid container 역할
            {list.map(item => <div>{renderNodes(...)}</div>)}
        </div>
    );
}
// 기존 방식: 아이템마다 combinedClassName 개별 적용 → 각자 독립 flex → 1열 고착
return list.map(item => <div className={combinedClassName}>...</div>);
```

| css_class | `grid` 감지 | DynamicEngine 동작 | 결과 |
|---|---|---|---|
| `grid kride-artist-grid` | ✅ | wrapper 방식 | 다열 가능 ✅ |
| `kride-artist-grid` (grid 없음) | ❌ | 기존 방식 (각 아이템 독립) | 1열 고착 ❌ |

#### CSS cascade 로 display 충돌 해결

```
globals.css 로드 순서:
  @import "tailwindcss";          → .grid { display: grid }   (먼저 로드)
  @import "./styles/KRIDE.css";   → .kride-artist-grid { display: flex }  (나중 로드)

동일 specificity (0-1-0), cascade 순서 우선 → .kride-artist-grid 승 → display: flex ✓
```

#### item wrapper div 폭 제어 — CSS 자식 선택자

wrapper 방식에서 item div는 DynamicEngine이 생성하며 **클래스 없음**:
```html
<div class="group-artist_grid grid kride-artist-grid">  ← wrapper
  <div onclick="...">  ← item wrapper (클래스 없음)
    <SelectionCard class="circle" />
  </div>
</div>
```

item wrapper에 클래스를 붙이려면 DynamicEngine 수정 필요. 대신 CSS 자식 선택자로 직접 제어:
```css
.kride-artist-grid > div {
    width: calc((100% - 3rem) / 3);  /* 3열: (100% - gap×2) / 3 */
    display: flex;
    justify-content: center;
}
```
→ **DynamicEngine 코드 수정 없이** item 폭 제어 가능.

---

### 11-7. 기존 grid 화면이 지금도 작동하는 이유 [2026-05-17]

기존 화면(MAIN_PAGE 등)의 grid는 **정적 CSS 파일에 정의**되어 있어 Tailwind v4 스캔 문제와 무관.

```
MAIN_PAGE.css (정적 파일):
  .main-bento  { display: grid; grid-template-columns: ... }
  .col-span-2  { grid-column: span 2 }
  .col-span-3  { grid-column: span 3 }
```

DB의 `css_class`에 `bento-card col-span-2`가 있어도, 이 클래스들은 소스 파일에 하드코딩된 정적 CSS → 항상 CSS 번들에 포함.

| 화면 | grid 정의 위치 | Tailwind 동적 클래스 의존 | V49 영향 |
|------|-------------|----------------------|---------|
| MAIN_PAGE | `MAIN_PAGE.css` (정적) | ❌ | 없음 ✅ |
| LOGIN_PAGE | `LOGIN_PAGE.css` (정적) | ❌ | 없음 ✅ |
| KRIDE_INTRO2/3 | Tailwind `grid-cols-*` (동적) | ✅ | V49로 해결 |

**결론:** KRIDE만 Tailwind 동적 클래스에 의존해서 문제가 발생했으며, 기존 화면은 처음부터 정적 CSS 방식이라 영향 없음.

---

### 11-8. V49 최종 적용 내용 [2026-05-17 확정]

**DB 변경 (pgAdmin 직접 실행):**
```sql
UPDATE ui_metadata SET css_class = 'kride-artist-grid flex-wrap'
WHERE screen_id = 'KRIDE_INTRO2' AND component_id = 'artist_grid';

UPDATE ui_metadata SET css_class = 'kride-region-grid flex-wrap'
WHERE screen_id = 'KRIDE_INTRO3' AND component_id = 'region_grid';
```
→ pgAdmin SELECT로 적용 확인 완료 ✅

**CSS 적용 방식 변경:**
- ~~`@import "./styles/KRIDE.css"`~~ → `@import` 무시되는 문제로 폐기
- **`globals.css` 맨 아래에 직접 인라인 작성** → 항상 번들 포함 ✅
- `app/styles/KRIDE.css` 파일은 참조용으로 유지, import는 제거됨

**최종 적용 절차:**
```
1. pgAdmin에서 V49 UPDATE 2건 실행 ✅
2. Spring Boot 재시작 (Redis 캐시 초기화) ← DML 후 필수
3. npm run dev 재시작 (globals.css 인라인 CSS 반영)
4. /view/INTRO2 → 아티스트 3열 확인
5. /view/INTRO3 → 지역 4열 확인
```

---

## 12. globals.css @import 순서 문제 — 2026-05-17 [핵심 발견]

### 규칙

CSS 스펙: `@import` 규칙은 반드시 `@charset`을 제외한 **모든 다른 규칙보다 앞에** 위치해야 함.

```css
/* 잘못된 순서 */
@import "tailwindcss";
@source inline("...");   ← 비표준 규칙 (Tailwind 지시어)
@import "./styles/KRIDE.css";  ← ⚠️ CSS 파서가 무시! 브라우저에 로드 안 됨
```

```css
/* 올바른 방법 — @import 대신 직접 인라인 */
@import "tailwindcss";
@source inline("...");
/* 아래에 CSS 규칙 직접 작성 */
.kride-artist-grid { ... }
```

### 영향 범위

`@source inline` 이후에 있던 `@import` 전부 영향:
- `./styles/KRIDE.css` ← 실제로 로드 안 됐음 (이번에 발견)
- `./styles/AI_CHAT.css`, `AI_CHAT_V2.css`, `AI_INTERVIEW.css`, `AI_JAPANESE.css` ← 동일 문제 가능성 있음, 해당 화면 정상 동작 여부 별도 확인 필요

### 해결 원칙

> SDUI에서 DB 동적 클래스에 대응하는 CSS는 **`globals.css`에 직접 인라인으로 작성**한다.
> 별도 CSS 파일 분리가 필요하면 `@import`를 `@source inline` **이전**에 배치해야 한다.

---

## 13. KRIDE 내비게이션 체인 확인 — 2026-05-17 [완료]

pgAdmin SELECT로 실제 DB 확인 결과:

| 화면 | 버튼 | action_type | action_url | 코드 처리 |
|------|------|-------------|------------|---------|
| INTRO4 | `intro4_next_btn` (BUTTON) | `ROUTE` | `/view/INTRO5` | `router.push(actionUrl)` ✅ |
| INTRO5 | `intro5_next_btn` (BUTTON) | `GOTO_MY_LIST` | `/view/MY_LIST` | `router.push("/view/MY_LIST")` ✅ |
| MY_LIST | `ai_banner_btn` (BUTTON) | `GOTO_FOCUS` | `/focus` | `router.push("/view/FOCUS")` ✅ |

→ DB와 코드 모두 정상. FOCUS 화면은 현재 빈 화면 (FastAPI 미연동 상태로 내비게이션만 동작).

---

## 14. INTRO3/INTRO4 다음 버튼 3가지 버그 분석 — 2026-05-18

### 증상
1. intro3_next_btn, intro4_next_btn 버튼이 화면에 보이지 않음
2. intro4_title 삭제 시에만 버튼 발견 가능
3. INTRO4 버튼 클릭해도 INTRO5로 이동 안 됨
4. INTRO4 버튼 색상 빨간색 아님 (베이지/흰색)

### 근본 원인: Tailwind safelist 누락 (Bug 1)

DB `css_class`에 있는 아래 클래스들이 **소스 파일에도 없고 safelist에도 없음** → Tailwind CSS 미생성:

| 누락 클래스 | 영향 대상 |
|---|---|
| `fixed` | intro3 wrapper, intro4_next_wrap |
| `bottom-0` `left-0` `right-0` | 동일 |
| `bg-gradient-to-t` `from-black` `to-transparent` | 그라디언트 배경 없음 |

결과: 버튼 wrapper가 `fixed bottom-0` 대신 **normal flow**로 처리됨 → purpose 카드/region 카드 아래로 밀림.

### 왜 title 삭제 시에만 버튼이 보이는가

`intro4_root` (`min-h-screen flex-col pb-28 gap-3`)에 fixed가 없는 버튼 wrapper가 포함되면:

| 요소 | 높이 (추정) |
|------|-----------|
| intro4_title (sticky) | ~56px |
| intro4_sub | ~24px |
| 6 purpose cards × ~68px | ~408px |
| next_wrap (in flow) | ~88px |
| pb-28 (padding) | 112px |
| **합계** | **~688px** |

title 삭제 시: ~688 - 68 = **~620px** → 모바일 viewport(~812px) 내에 들어옴.
title 있을 때: 총 높이 > viewport → 스크롤 필요 → `pb-28`이 버튼 아래 추가 공간을 만들어 실질적으로 버튼이 viewport 밖으로 나감.

### Bug 2: 버튼 색상 (bg-red-600)

`KrideNextButton.tsx`에 `bg-red-600` 하드코딩 → Tailwind가 생성함.
단, `intro4_next_btn`은 `BUTTON` 타입(ButtonField) → DB css_class 기반 → safelist에 명시 없으면 빌드 캐시 이슈 가능.

→ **safelist에 `bg-red-600` 명시 추가로 보장** 필요.

### Bug 3: INTRO4 → INTRO5 이동 안 됨

섹션 13에서 확인: DB `action_type='ROUTE'`, `action_url='/view/INTRO5'` ✅, 코드 로직 ✅.
**실제 원인: 버튼이 viewport 밖에 있거나 클릭이 제대로 안 됨 (Bug 1 결과).**
Bug 1 수정 후 재확인 필요.

### 수정 방법 → 섹션 15 참조 (globals.css가 아닌 index.css + common.css에서 수정)

---

## 15. globals.css는 로드되지 않는다 — CSS 수정 가이드 [2026-05-18 최종 확정]

### 핵심 발견

`layout.tsx`는 `./styles/index.css`를 import한다. **`globals.css`는 어디에서도 import 되지 않는다.**

```
layout.tsx
  └── import "./styles/index.css"     ← 실제 CSS 진입점
        ├── @import "tailwindcss"
        ├── @source "../../SDUI-server/.../migration/*.sql"  ← SQL 파일에서 클래스 스캔
        ├── @source inline("...")       ← 수동 safelist (여기에 추가해야 함!)
        ├── @import "./common.css"      ← KRIDE 커스텀 CSS 여기에 작성
        ├── @import "./layout.css"
        ├── @import "./components.css"
        ├── @import "./pages.css"
        └── @import "./AI_*.css"
```

```
globals.css  ← ❌ 어디에서도 import 안 됨. 여기에 뭘 추가해도 무효!
```

### 이전 작업이 왜 안 됐는가

섹션 9~12에서 `globals.css`에 safelist와 KRIDE CSS를 추가했지만, 이 파일이 로드되지 않아 전부 무효였음.

| 시도 | 대상 파일 | 결과 |
|------|----------|------|
| @source inline safelist 추가 | globals.css | ❌ 로드 안 됨 |
| .kride-artist-grid 인라인 작성 | globals.css | ❌ 로드 안 됨 |
| @source inline + common.css 이동 | **index.css + common.css** | ✅ 성공 |

### SDUI 동적 클래스 CSS 수정 규칙 (확정)

#### 1. Tailwind safelist 추가 시
**파일: `app/styles/index.css`** 의 `@source inline("...")` 에 클래스 추가

```css
/* index.css */
@import "tailwindcss";
@source "../../SDUI-server/src/main/resources/db/migration/*.sql";
@source inline("grid grid-cols-1 ... fixed bottom-0 left-0 right-0 ...");
```

> ⚠️ SQL 마이그레이션 파일 스캔(`@source ".../*.sql"`)도 있지만, DB DML로 직접 추가한 클래스는 SQL 파일에 없을 수 있으므로 `@source inline`에 명시적으로 추가해야 확실.

#### 2. KRIDE 커스텀 CSS 추가/수정 시
**파일: `app/styles/common.css`** 에 작성

```css
/* common.css 하단 */
.kride-artist-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; width: 100%; }
.kride-artist-grid > div { width: calc((100% - 3rem) / 3); }
.kride-region-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; width: 100%; }
.kride-region-grid > div { width: calc((100% - 2.25rem) / 4); }
```

#### 3. 수정 후 반영 절차

```
1. index.css 또는 common.css 수정
2. npm run dev 재시작 (Tailwind CSS 재빌드)
3. 브라우저 새로고침 (캐시 주의)
4. DB DML 실행한 경우 → Spring Boot 재시작 (Redis 캐시 초기화)
```

### 현재 safelist 전체 목록 (2026-05-18 기준)

```
grid grid-cols-1~6 gap-1~8
pb-4~28 pt-4~12 px-6 py-3 py-4
place-items-center sticky top-0 z-10 z-50
aspect-square object-cover object-contain
fixed bottom-0 left-0 right-0 bottom-6 right-6
bg-gradient-to-t from-black to-transparent
bg-red-600 rounded-full
min-h-screen bg-black flex flex-col flex-wrap
text-xl text-lg text-sm font-bold
text-white text-gray-400 w-full
```

### 섹션 9~12 정정

섹션 9(시도1 실패 원인): ~~`@import` 순서 문제~~ → 실제로는 **globals.css 자체가 로드 안 됨**이 진짜 원인. `@import` 순서도 문제지만, 그 이전에 파일 자체가 사용되지 않았음.

섹션 12(@import 순서 문제): 여전히 유효한 규칙이지만, KRIDE 프로젝트에서는 **index.css가 진입점**이므로 index.css 내부의 `@import` 순서만 신경 쓰면 됨.

---

## 16. INTRO4/INTRO5/MY_LIST 버튼 `is_readonly` 버그 — 2026-05-18 [해결]

### 증상

INTRO4, INTRO5, MY_LIST 버튼이 흰색/비활성화 상태로 렌더링. 클릭해도 반응 없음.

### 원인

DB `is_readonly = true` → ButtonField가 `disabled` 속성 + `is-readonly` 클래스 적용.

```html
<!-- DevTools에서 확인된 실제 DOM -->
<button class="content-btn ... is-readonly" disabled="">다음</button>
```

ButtonField 코드:
```tsx
const isReadOnly = meta?.isReadonly === true || meta?.is_readonly === true;
// ...
<button disabled={isReadOnly}>
```

### 해결 SQL

```sql
-- INTRO4: KRIDE_NEXT_BTN으로 변경 + readonly 해제
UPDATE ui_metadata
SET component_type = 'KRIDE_NEXT_BTN', is_readonly = false,
    component_props = '{"checkKey": "purposes", "minCount": 1}'
WHERE screen_id = 'KRIDE_INTRO4' AND component_id = 'intro4_next_btn';

-- INTRO5: readonly 해제
UPDATE ui_metadata SET is_readonly = false
WHERE screen_id = 'KRIDE_INTRO5' AND component_id LIKE 'intro5%btn%';

-- MY_LIST: readonly 해제
UPDATE ui_metadata SET is_readonly = false
WHERE screen_id = 'KRIDE_MY_LIST' AND component_id = 'ai_banner_btn';
```

### 교훈

DB에 컴포넌트 추가 시 `is_readonly` 기본값 확인 필수. ButtonField는 `is_readonly = true`이면 `disabled` + 클릭 무시.

---

## 17. FOCUS 페이지 FastAPI 미연동 현황 — 2026-05-18 [미해결]

### 현재 상태

FOCUS 페이지 접속 시: "일정이 없습니다 | 중심: 37.5665, 126.9780 | 마커 0개"

### 원인: CommonPage에 FastAPI 호출 코드 없음

```
현재 데이터 흐름 (문제):
CommonPage
  → usePageMetadata(KRIDE_FOCUS) → Spring Boot에서 UI 메타데이터만 받음
  → pageData = {} (빈 데이터)
  → ItineraryPanel.data.itinerary = [] → "일정이 없습니다"
  → MapView.data.markers = [] → "마커 0개"

필요한 데이터 흐름:
CommonPage
  → usePageMetadata → UI 메타데이터
  → FastAPI POST /api/recommend/itinerary → itinerary + markers
  → pageData에 합쳐서 DynamicEngine에 전달
```

### 필요한 FastAPI 연동

**엔드포인트:** `POST http://localhost:8000/api/recommend/itinerary`

**요청 (localStorage `kride_form`에서 읽기):**
```json
{
  "duration": "당일치기",
  "artists": ["BTS"],
  "regions": ["서울"],
  "purposes": ["kculture"],
  "budget": { "min": 30000, "max": 2000000 }
}
```

**응답:**
```json
{
  "itinerary": [
    {
      "day": 1,
      "morning": { "places": [{"name": "장소명", "address": "주소", "tip": "팁"}] },
      "afternoon": { "places": [...] }
    }
  ],
  "mapData": { "markers": [{"name": "...", "lat": 37.57, "lon": 126.97}] },
  "source_pois": [...]
}
```

### FastAPI 서버 내부 파이프라인

```
POST /api/recommend/itinerary
  ├─ Neo4j: get_artist_pois(artists) → 아티스트 촬영지
  ├─ Neo4j: get_region_pois(regions) → 지역 POI
  ├─ ChromaDB: search_pois_by_purpose(purposes) → 목적별 RAG 검색
  ├─ 중복 제거 (poi_id 기준)
  └─ Groq LLM: generate_itinerary() → 일정 JSON 생성
```

**환경:**
- FastAPI: `http://localhost:8000` (`NEXT_PUBLIC_KRIDE_API_BASE`)
- 임베딩: `intfloat/multilingual-e5-small`
- LLM: Groq `openai/gpt-oss-120b`
- 벡터DB: ChromaDB (`./chroma_db`)
- 그래프DB: Neo4j

### FastAPI 서버 로그 상태 (2026-05-18)

```
[K-Ride] 그래프 로드: {}
[K-Ride] road_scored: None
[K-Ride] facility:    None
[K-Ride] poi:         None
```

→ **Neo4j 그래프 데이터가 비어있음.** POI/도로/시설 데이터 로드 필요.

### 구현 계획 (미착수)

1. **FastAPI 연결 테스트** — curl로 엔드포인트 직접 호출하여 응답 확인
2. **Neo4j 데이터 확인** — POI 데이터 존재 여부, 연결 상태
3. **CommonPage 또는 전용 훅에 FastAPI 호출 추가** — KRIDE_FOCUS 화면일 때 localStorage에서 onboarding 데이터 읽어 FastAPI 호출
4. **응답 데이터를 pageData에 합치기** — `itinerary`, `mapData` 키로 DynamicEngine에 전달

### 관련 파일

| 파일 | 역할 |
|------|------|
| `metadata-project/app/view/[...slug]/page.tsx` | CommonPage — FastAPI 호출 추가 필요 |
| `metadata-project/components/fields/kride/MapView.tsx` | 지도 컴포넌트 (data.center, data.markers, data.zoom) |
| `metadata-project/components/fields/kride/ItineraryPanel.tsx` | 일정 패널 (data.duration, data.itinerary) |
| `metadata-project/components/fields/kride/MapViewInner.tsx` | Leaflet 지도 렌더링 (dynamic import, SSR 비활성) |
| `metadata-project/components/DynamicEngine/hook/useKrideItinerary.ts` | KRIDE_FOCUS 전용 훅 — FastAPI 호출 + 응답 관리 |
| `src/api/fastapi_server.py` | FastAPI 서버 (`/api/recommend/itinerary`) |
| `src/api/rag_client.py` | RAG 파이프라인 (ChromaDB + Groq LLM) |

---

## 18. FOCUS 페이지 FastAPI 연동 — 2026-05-19

### 연동 구조 (확정)

```
CommonPage (KRIDE_FOCUS)
  → useKrideItinerary(screenId, formData)
    → localStorage('kride_form')에서 온보딩 데이터 읽기
    → POST /kride-api/recommend/itinerary (Next.js 프록시 → localhost:8000)
    → 응답: { itinerary, mapData, source_pois }
  → combineData = { ...pageData, ...krideItinerary.data, ...formData }
  → DynamicEngine → ItineraryPanel(data.itinerary) + MapView(data.markers)
```

### 프록시 설정 (`next.config.ts`)
```
/kride-api/:path* → http://localhost:8000/api/:path*
```

### 수정 내역

| 파일 | 변경 | 이유 |
|------|------|------|
| `useKrideItinerary.ts` | duration 포맷 매핑 추가 (`day`→`당일치기`) | DurationButton이 영문 키 저장, FastAPI는 한글 기대 |
| `page.tsx` | KRIDE_FOCUS 로딩/에러 UI 추가 | FastAPI 호출 중 스피너, 실패 시 에러+재시도 버튼 |
| `fastapi_server.py` | `async def recommend_itinerary` + 지오코딩 fallback | Neo4j 빈 데이터일 때 LLM 일정 주소로 마커 좌표 생성 |

### Duration 포맷 매핑

| DurationButton 저장값 | FastAPI 기대값 |
|---|---|
| `day` | `당일치기` |
| `onenight` | `1박2일` |
| `twonight` | `2박3일` |

### FastAPI 응답 (테스트 결과 2026-05-19)

```json
{
  "itinerary": [
    {
      "day": 1,
      "morning": {
        "places": [
          { "name": "HYBE Insight", "address": "서울특별시 용산구 이태원로 14길 30", "tip": "..." },
          { "name": "BTS 사운드홀", "address": "서울특별시 용산구 한강대로 100", "tip": "..." }
        ]
      },
      "afternoon": {
        "places": [
          { "name": "BT21 Café", "address": "서울특별시 강남구 논현로 508", "tip": "..." },
          { "name": "K-Star Road", "address": "서울특별시 강남구 도산대로 8길 30", "tip": "..." }
        ]
      }
    }
  ],
  "mapData": { "markers": [] },
  "source_pois": []
}
```

- **itinerary**: Groq LLM이 자체 지식으로 생성 ✅
- **markers**: 빈 배열 (Neo4j/ChromaDB 데이터 없음) → 지오코딩 fallback 추가
- **source_pois**: 빈 배열 (DB 데이터 없음)

### 지오코딩 Fallback (`fastapi_server.py`)

POI 마커가 비어있을 때 LLM 일정의 `address` 필드를 Nominatim(무료)으로 좌표 변환:
- `geocode_address(address)` → Nominatim API 호출 (rate limit 1req/s)
- `geocode_itinerary_places(itinerary)` → 전체 장소 순회 → 마커 리스트 반환
- 장소 4개 기준 약 5초 소요

### GOTO_MY_LIST 동선 확인

`useBusinessActions.tsx:121` — `GOTO_MY_LIST` → `/view/FOCUS` 직행은 **의도된 동작**.
MY_LIST는 회원가입/마이페이지와 통합될 예정이므로 현재는 FOCUS로 직행.

### 남은 작업

| 항목 | 상태 |
|------|------|
| `httpx` 패키지 설치 확인 | `pip install httpx` 필요 |
| 서버 재시작 후 지오코딩 마커 테스트 | 미확인 |
| Neo4j/ChromaDB 실제 데이터 적재 | ⏳ 진행 중 (K-pop 20명 PostgreSQL 완료, Colab 마이그레이션 대기) |
| MapView 마커 auto-center | 미구현 (마커 centroid로 center 계산) |

---

## 19. 모바일 반응형 / PWA 점검 — 2026-05-19

> INTRO1~5, MY_LIST, FOCUS 전 화면 대상 분석

### 19-1. PWA 설정 ✅ 양호

| 항목 | 파일 | 상태 |
|------|------|------|
| viewport meta | `app/layout.tsx` | `width=device-width, initialScale=1, userScalable=false` ✅ |
| manifest.json | `public/manifest.json` | `display:standalone, orientation:portrait, icons 192/512px` ✅ |
| next-pwa | `next.config.ts` | Service Worker 생성 활성화 ✅ |
| mobile-web-app-capable | layout.tsx metadata | ✅ |
| screenshots | manifest.json | mobile(390×844) + desktop(1280×800) ✅ |

### 19-2. 브레이크포인트 현황

| 브레이크포인트 | 파일 | 용도 |
|--------------|------|------|
| `1024px` | layout.css, LOGIN_PAGE.css | PC 사이드바 표시 |
| `1000px` | `useDeviceType.tsx`, pages.css | isMobile 판별 (단일 분기점) |
| `999px` | pages.css | 모바일 레이아웃 |
| `768px` | DIARY_LIST.css, LOGIN_PAGE.css | 태블릿 |

**문제:**
- ❌ **375px 이하 미디어쿼리 없음** — 소형 모바일(iPhone SE, 320px) 미대응
- ❌ **가로 모드(landscape) 미디어쿼리 없음** — `max-height` 브레이크포인트 부재

### 19-3. 심각한 문제 (375px 이하 기기에서 깨짐)

#### 🔴 문제 1: MapViewInner.tsx — minHeight: 400px

```tsx
<MapContainer style={{ width: '100%', height: '100%', minHeight: '400px' }}>
```

375px 기기에서 뷰포트 높이 ~667px 중 400px을 지도가 차지 → 일정 패널 공간 부족.

**수정 방향:** 모바일에서 `minHeight: 300px` 또는 `50vh` 사용

#### 🔴 문제 2: INTRO3 region 4열 그리드

```css
.kride-region-grid > div {
    width: calc((100% - 2.25rem) / 4);
}
```

- 375px: `(375 - 18) / 4 = 89px` ⚠️ 경계
- 320px: `(320 - 18) / 4 = 75px` ❌ 터치 불가

**수정 방향:** 320px 이하에서 3열로 전환

#### 🔴 문제 3: 브레이크포인트 부재

`useDeviceType.tsx`에서 `window.innerWidth < 1000`으로만 분기.
320~375px 소형 기기용 추가 분기 없음.

#### 🔴 문제 4: time-card 버튼 높이 40px

```css
.time-card button { height: 40px; }
```

WCAG 2.5.5 최소 터치 타겟 48px 미만.

### 19-4. 중간 문제

| 문제 | 위치 | 설명 |
|------|------|------|
| SelectionCard 고정 크기 | INTRO2 `w-24 h-24` (96px) | 320px에서 3열 × 96px = 288px + gap → 오버플로 가능 |
| FAB 버튼 마진 | `.kride-next-btn-br` margin 24px | 375px에서 빡빡 (좌우 48px 소모) |
| 브레이크포인트 불일치 | CSS 전체 | 768/999/1000/1024px 4개 혼용 |
| Itinerary h-full | `ItineraryPanel.tsx` | 부모 높이 미보장 시 overflow 문제 |

### 19-5. 양호한 부분

| 항목 | 위치 | 상태 |
|------|------|------|
| KRIDE fullscreen 모드 | `layout.css` `.kride-fullscreen` | max-width:100%, padding:0 ✅ |
| 아티스트 3열 grid (375px) | `common.css` `.kride-artist-grid` | 카드 117px ✅ |
| DurationButton | `DurationButton.tsx` | w-full, py-4 ✅ |
| KrideNextButton | `KrideNextButton.tsx` | w-full, py-4, rounded-full ✅ |
| 모바일 우선 기본값 | `useDeviceType.tsx` | `isMobile = true` 초기값 ✅ |
| 100dvh 사용 | index.css | 모바일 주소창 대응 ✅ |

### 19-6. 수정 권장사항

**즉시 수정 (레이아웃 깨짐 방지):**

```css
/* common.css에 추가 */
@media (max-width: 375px) {
    .kride-region-grid > div {
        width: calc((100% - 1.5rem) / 3);  /* 4열 → 3열 */
    }
}
```

```tsx
// MapViewInner.tsx — 모바일 높이 축소
const isMobile = typeof window !== 'undefined' && window.innerWidth < 500;
<MapContainer style={{ width: '100%', height: '100%', minHeight: isMobile ? '300px' : '400px' }}>
```

**단기 수정:**
- SelectionCard: `w-20 h-20 sm:w-24 sm:h-24` (Tailwind responsive)
- time-card button: `height: 48px` (WCAG 준수)
- 브레이크포인트 통일: 320px / 375px / 768px / 1024px

### 19-7. 수정 완료 내역 — 2026-05-19

#### MapViewInner.tsx [편집]
```tsx
// Before
style={{ width: '100%', height: '100%', minHeight: '400px' }}

// After
style={{ width: '100%', height: '100%', minHeight: '50vh', maxHeight: '60vh' }}
```
→ 뷰포트 비례 높이로 변경, 소형 기기에서 지도가 화면 80%를 차지하는 문제 해결.

#### common.css [편집] — 375px 브레이크포인트 추가
```css
@media (max-width: 375px) {
    .kride-region-grid > div {
        width: calc((100% - 1.5rem) / 3);  /* 4열 → 3열 */
    }
    .kride-artist-grid > div {
        width: calc((100% - 2rem) / 3);
    }
    .kride-next-btn-br {
        right: 1rem;
        bottom: 1rem;
    }
}
```
→ 소형 모바일(iPhone SE, 320px)에서 region 그리드 3열 전환 + FAB 마진 축소.

#### pages.css [편집] — time-card 버튼 WCAG 준수
```css
/* Before */
.time-card button { height: 40px; }

/* After */
.time-card button { height: 48px; }
```
→ WCAG 2.5.5 최소 터치 타겟 48px 준수.

---

## 20. 아티스트 썸네일 크롤링 — 2026-05-19

> INTRO2 화면에 표시할 아티스트 프로필 사진 수집

### 크롤링 소스

6개 dearu/lysn 스토어 페이지에서 `div.thumbnail > img` 썸네일 추출.

| 스토어 | URL | 결과 |
|--------|-----|------|
| STARS | store.dearu.com/STARS/home | 150+명 (Apink, MAMAMOO 확인 필요) |
| LYSN | webstore.lysn.com/LYSN/home | 13명 (SM 소속) |
| JYP | store.dearu.com/JYP/home | 12명 (JYP 소속) |
| STARSHIP | store.dearu.com/STARSHIP/home | 9명 |
| CUBE | store.dearu.com/CUBE/home | 4명 (BTOB 미등록) |
| ACTORS | store.dearu.com/ACTORS/home | 배우 전용 |

### 매칭 결과 (11/20)

매칭된 아티스트와 이미지 URL: `.ai/memo/artist_thumbnails.json`

| Artist | Store | CDN |
|--------|-------|-----|
| SUPER JUNIOR | LYSN | store-cn.lysn.com |
| EXO | LYSN | store-cn.lysn.com |
| TVXQ | LYSN | store-cn.lysn.com |
| SHINee | LYSN | store-cn.lysn.com |
| Girls' Generation | LYSN | store-cn.lysn.com |
| Red Velvet | LYSN | store-cn.lysn.com |
| NCT | LYSN | store-cn.lysn.com |
| TWICE | JYP | ba-store-cn.dear-u.co |
| ITZY | JYP | ba-store-cn.dear-u.co |
| Stray Kids | JYP | ba-store-cn.dear-u.co |
| IVE | STARSHIP | ba-store-cn.dear-u.co |

### 미매칭 (9/20)

| Artist | 이유 |
|--------|------|
| BTS, SEVENTEEN, TXT | HYBE Weverse 전용 |
| BLACKPINK | YG 전용 |
| IU | EDAM, 스토어 없음 |
| OH MY GIRL | WM, 스토어 없음 |
| BTOB | CUBE에 미등록 |
| Apink, MAMAMOO | STARS 150+목록 내 확인 필요 |

### 생성 파일

| 파일 | 역할 |
|------|------|
| `.ai/memo/artist_thumbnails.json` | 매칭 결과 JSON |
| `src/db/download_artist_thumbnails.py` | 이미지 다운로드 → `public/artists/` |
