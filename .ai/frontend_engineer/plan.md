# K-Ride SDUI 화면 구현 계획

> 작성일: 2026-05-16

---

## 즉시 필요한 작업

### [P1] V44/V45 배포 (사용자 직접 실행)

```bash
cp .ai/V44__fix_intro1_hero_svg.sql    subproject/SDUI/SDUI-server/src/main/resources/db/migration/
cp .ai/V45__intro4_single_select.sql   subproject/SDUI/SDUI-server/src/main/resources/db/migration/
# Spring Boot 재시작
# npm run dev
```
### [메모] 실행 -> 아직 화면에 grid 정렬이 안됨 → [완료] V46 마이그레이션으로 해결 (2026-05-17)

### [P2] 프론트엔드 재시작 (사용자 직접 실행)
DynamicEngine.tsx(grid/flex 충돌 수정) + PurposeCard.tsx(단일 선택) 코드 변경 반영:
```bash
cd subproject/SDUI/metadata-project
npm run dev
```

---

## 다음 작업

### [P3] FOCUS 화면 FastAPI 연동

FOCUS 화면에서 FastAPI 추천 결과가 표시되도록:
1. `useBusinessActions.tsx` GOTO_FOCUS 케이스에서 FastAPI 호출

### [메모] PWA 앱으로 모바일에서 사용할때 localStorage와 sessionStorage 사용 괜찮을지 → [답변] frontend_engineer/research.md 6번 항목 참조

2. 응답 (`itinerary`, `mapData`)을 `sessionStorage['kride_focus_data']`에 저장
3. FOCUS 화면 진입 시 sessionStorage 데이터를 읽어 `pageData`로 주입

4. `MAP_VIEW` 컴포넌트: `pageData.mapData.markers` 배열로 지도 마커 렌더링
5. `ITINERARY_PANEL` 컴포넌트: `pageData.itinerary` 배열로 일정 카드 렌더링

구현 위치:
- `components/DynamicEngine/hook/useBusinessActions.tsx` (GOTO_FOCUS 케이스)
- `next.config.ts` (FastAPI 프록시 규칙 추가)

---

## 나중 작업

### [P4] 재온보딩 다이얼로그
- 로그인 사용자가 INTRO1 재진입 시 기존 `kride_form` 감지
- "이전 설정을 교체할까요 / 추가할까요?" 다이얼로그 표시

---

---

## KRIDE 인트로 화면 레이아웃 수정 — 2026-05-17

> V46 마이그레이션 + 프론트엔드 컴포넌트 신규 생성

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `db/migration/V46__intro_layout_fixes.sql` | INTRO1/2/3 css_class·component_type UPDATE |
| `components/fields/kride/TypewriterText.tsx` | 신규 생성 — 80ms 타이핑 효과 컴포넌트 |
| `components/constants/componentMap.tsx` | `TYPEWRITER_TEXT` 타입 등록 |
| `components/fields/kride/SelectionCard.tsx` | chip 모드에 `w-full flex items-center justify-center` 추가 |

### 화면별 수정 내용

**INTRO1**
- `intro1_title`: component_type `TEXT` → `TYPEWRITER_TEXT`, css_class `leading-snug` 추가
- `intro1_sub`: css_class `mb-4` 추가
- `intro1_buttons`: `mt-auto` 제거 → `mt-6` (수직 중앙 배치)

**INTRO2**
- `intro2_root`: `pt-4` 추가
- `intro2_title`: `sticky top-0 bg-black z-10 py-3` — 스크롤 시 상단 고정 헤더
- `artist_grid`: `place-items-center` 제거

**INTRO3**
- `intro3_root`: `pt-4` 추가
- `intro3_title`: `sticky top-0 bg-black z-10 py-3` — 상단 고정 헤더
- `region_grid`: `flex flex-wrap` → `grid grid-cols-4 gap-3 pb-28` (4열 고정)

### 검증 체크리스트 (V46 배포 후)

- [ ] INTRO1: 제목이 한 글자씩 나타나는 타이핑 효과
- [ ] INTRO1: 버튼 그룹이 화면 중단에 배치 (하단 고정 아님)
- [ ] INTRO2: 상단 제목이 스크롤해도 고정
- [ ] INTRO2: 아티스트 3열 grid 정렬
- [ ] INTRO3: 상단 제목이 스크롤해도 고정
- [ ] INTRO3: 지역 4열 grid (12개 = 4×3), chip이 셀을 꽉 채움

---

## 검증 체크리스트

| 화면 | 확인 항목 |
|------|----------|
| `/view/KRIDE_INTRO1` | 검은 배경 + SVG 히어로 이미지 + 큰 제목 + 하단 빨간 버튼 3개 |
| `/view/KRIDE_INTRO2` | 3열 grid, 카드 중앙정렬, 1개 선택 시 "다음" 버튼 노출, 5개 초과 시 토스트 |
| `/view/KRIDE_INTRO3` | chip 태그 flex-wrap, 선택 시 흰색 반전, 1개 선택 시 "다음" 노출, 2개 초과 시 토스트 |
| `/view/KRIDE_INTRO4` | 1개만 선택 가능, 서브타이틀 "1개만 선택할 수 있어요" |
| `/view/KRIDE_INTRO5` | 예산 슬라이더 + "AI 여행 추천 받기" 버튼 |
| localStorage | DevTools → Application → Local Storage에서 `kride_form` 키 확인 |
| 기존 화면 | `/view/MAIN_PAGE`, `/view/LOGIN_PAGE` 회귀 없음 |

---

## INTRO2/INTRO3/INTRO4 레이아웃 3차 문제 — 2026-05-17 (아침2 캡처)

> 캡처: `.ai/memo/0517log/아침2_인트로화면_레이아웃문제_1~4.png`

### 발견된 문제 목록

| # | 화면 | 증상 | 원인 |
|---|------|------|------|
| 1 | INTRO2 | 아이돌 카드가 세로 1열로 나열 (3열 grid 아님) | **DynamicEngine REPEATER wrapper 누락** |
| 2 | INTRO2 | 아이돌 원형 이미지가 표시되지 않음 (체크 아이콘만 보임) | artistList 데이터의 `imageUrl` 없음 |
| 3 | INTRO2 | "5개 이상은 클릭이 어렵습니다"가 인라인 텍스트처럼 표시됨 | KrideWarningToast 렌더링 미확인 |
| 4 | INTRO3 | 지역 chip이 세로 1열로 나열 (4열 grid 아님) | **DynamicEngine REPEATER wrapper 누락** (문제 1과 동일) |
| 5 | INTRO3 | 지역 선택 후에도 다음 버튼이 보이지 않음 | V42 배포 미적용 or formData 연결 |
| 6 | INTRO4 | "여행 목적을 알려주세요" 제목에서 "여"가 잘림 | sticky top-0 없음 (→ V47에서 수정) |
| 7 | INTRO4 | 다음 버튼이 purpose card에 가려져 클릭 불가 | z-index 없음 (→ V47에서 수정) |

---

### 문제 1·4 근본 원인: DynamicEngine REPEATER wrapper 누락

**현재 동작 (잘못됨)**:
```
REPEATER (artist_grid, css_class="grid grid-cols-3 ...")
  → list.map()으로 각 아이템 div 생성
  → 각 아이템 div에 "grid grid-cols-3 ..." 클래스 적용
  → 아이템들이 부모 없이 나란히 배치 → 세로 1열
```

**올바른 동작**:
```
wrapper div (css_class="grid grid-cols-3 ...")  ← grid container
  → 각 아이템 div (클래스 없음)                ← grid item
    → SelectionCard / chip 렌더링
```

**수정 대상**: `components/DynamicEngine/DynamicEngine.tsx` — REPEATER 처리 블록

현재 코드 (87~101번 줄):
```tsx
// 현재: 각 아이템 div에 combinedClassName 적용 → wrapper 없음
return list.map((item, idx) => (
    <div key={`${uId}-${idx}`} className={combinedClassName} onClick={handleClick}>
        {renderNodes(node.children, item)}
    </div>
));
```

수정 방향:
```tsx
// 수정: 외부 wrapper div에 combinedClassName, 각 아이템은 클래스 없음
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
```

> ⚠️ 이 변경은 REPEATER를 사용하는 **모든 화면**에 영향. 기존 화면 회귀 테스트 필수.

---

### 문제 2: 아이돌 이미지 없음

`CardImage.tsx`는 `data?.imageUrl`을 이미지 src로 사용.
`artistList` 데이터가 `imageUrl` 필드를 포함하는지 확인 필요.

확인 방법:
```sql
SELECT * FROM query_master WHERE sql_key = 'artistList';
-- 또는
SELECT * FROM ui_metadata WHERE screen_id = 'KRIDE_INTRO2' AND ref_data_id = 'artistList' LIMIT 5;
```

해결책 (우선순위 순):
1. artistList 쿼리가 `image_url` AS `imageUrl` alias를 포함하도록 수정
2. 이미지 파일을 `public/img/kride/artists/` 에 배치
3. `CardImage.tsx`에서 placeholder가 없으면 이니셜/아이콘으로 폴백

---

### 문제 3: 경고 토스트 미표시

`KrideWarningToast`는 `window.addEventListener('kride-warning', ...)` 기반.
V43에서 `KRIDE_WARNING` 타입을 `intro2_root`, `intro3_root`에 등록함.

확인 방법:
```sql
SELECT component_id, component_type FROM ui_metadata
WHERE screen_id IN ('KRIDE_INTRO2','KRIDE_INTRO3') AND component_type = 'KRIDE_WARNING';
```
→ 0건이면 V43이 미배포. Spring Boot 재시작으로 Flyway 실행 필요.

---

### 문제 5: INTRO3 다음 버튼 미표시

V42에서 `intro3_next_btn` (KRIDE_NEXT_BTN, checkKey=selectedRegions)을 등록.
지역 선택 후에도 버튼이 없으면 두 가지 원인 중 하나:

**원인 A**: V42 미배포
```sql
SELECT component_id FROM ui_metadata
WHERE screen_id = 'KRIDE_INTRO3' AND component_type = 'KRIDE_NEXT_BTN';
-- 0건 → Spring Boot 재시작 필요
```

**원인 B**: formData가 KRIDE_NEXT_BTN에 전달되나 `selectedRegions` 배열이 비어있음
- SelectionCard chip 모드에서 `onChange?.("selectedRegions", updated)` 호출 확인
- DevTools → Application → Local Storage → `kride_form.selectedRegions` 값 확인

---

### 작업 순서

| 순서 | 작업 | 파일 | 상태 |
|------|------|------|------|
| 1 | V42/V43/V46/V47 배포 (Spring Boot 재시작) | Flyway 자동 | - |
| 2 | DynamicEngine REPEATER wrapper 수정 | `DynamicEngine.tsx:87~101` | [완료] 2026-05-17 |
| 3 | CardImage.tsx 이니셜 폴백 처리 | `components/fields/kride/atoms/CardImage.tsx` | [완료] 2026-05-17 |
| 4 | 기존 화면 회귀 테스트 | MAIN_PAGE, LOGIN_PAGE 등 | 사용자 확인 필요 |

### 수정 내용 요약 (2026-05-17)

**DynamicEngine.tsx — REPEATER grid wrapper**
- css_class에 `grid` 키워드가 있는 REPEATER는 wrapper div를 하나 두고 그 안에 아이템을 배치
- `artist_grid` (grid-cols-3), `region_grid` (grid-cols-4) 적용
- `purpose_grid` (w-full, grid 없음) 및 기존 flex REPEATER는 기존 방식 유지

**CardImage.tsx — 이미지 없을 때 이니셜 폴백**
- `imageUrl`이 빈 문자열이거나 없으면 `/images/placeholder.png` 대신 이름 이니셜을 회색 배경 원/사각형으로 표시
- Next.js `<Image>` 오류 방지 + 아티스트 카드 시각 표시 개선

---

## INTRO3/INTRO4 UX 수정 — 2026-05-17 (V47)

> 문제_5/문제_6 수정: `db/migration/V47__intro3_intro4_ux_fixes.sql`

### 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `db/migration/V47__intro3_intro4_ux_fixes.sql` | INTRO3 title 복원 + INTRO4 레이아웃 5개 UPDATE |

### 수정 내용

**INTRO3 (문제_5)**
- `intro3_title`: `TYPEWRITER_TEXT` → `TEXT` 복원 (의도치 않은 타이핑 효과 제거)

**INTRO4 (문제_6)**
- `purpose_grid`: `pb-24` 패딩 제거 → `w-full` (96px × 6 = 576px 낭비 제거)
- `intro4_root`: `gap-6 py-10` → `gap-3 pt-4 pb-28` (콘텐츠 높이 1260px → 656px)
- `intro4_title`: `sticky top-0 bg-black z-10 py-3` 추가 ('여' 글자 겹침 방지)
- `intro4_next_wrap`: `z-50` 추가 (purpose card에 가려지는 버튼 수정)

### 검증 체크리스트 (V47 배포 후)

- [ ] INTRO3: 제목이 정적 텍스트로 표시 (타이핑 효과 없음)
- [ ] INTRO3: 지역 chip 선택 후 스크롤 없이 다음 버튼 표시
- [ ] INTRO4: '여' 글자가 가려지지 않음
- [ ] INTRO4: 진입 즉시 다음 버튼 표시 (스크롤 불필요)
- [ ] INTRO4 → INTRO5 이동 정상
