# KRIDE 온보딩 화면 UI 구현 현황

---

## Phase 1 — 기반 작업 [완료]

### 해결한 문제
| 문제 | 원인 | 해결 |
|------|------|------|
| 헤더 노출 | `Header.tsx`가 모바일에서도 KRIDE 화면에 헤더 표시 | KRIDE 경로 감지 → `return null` |
| Tailwind 미적용 | `styles/index.css`에 `@import "tailwindcss"` 없음 | 파일 맨 앞에 추가 + `@source` SQL 스캔 |
| 흰 배경 | `engine-container` max-width 제약 | `layout.css`에 `.kride-fullscreen` 오버라이드 추가 |
| Sidebar 노출 | AppShell이 KRIDE 화면 구분 안 함 | `kride-fullscreen` 클래스 조건부 부착 |

### 수정 완료 파일
| 파일 | 내용 |
|------|------|
| `app/styles/index.css` | `@import "tailwindcss"` + `@source "*.sql"` |
| `components/layout/Header.tsx` | KRIDE 경로에서 `return null` |
| `components/layout/AppShell.tsx` | `kride-fullscreen` 클래스 + Sidebar/Header 조건부 렌더링 |
| `app/styles/layout.css` | `.kride-fullscreen` CSS 블록 추가 |

---

## Phase 2 — 데이터 소스 [완료]

- **V40**: INTRO1~5, MY_LIST, FOCUS 화면 메타데이터
- **V41**: `query_master` + `DATA_SOURCE` 3개 (artistList, regionList, purposeList)
- Flyway `Current version: 41` 확인 완료

---

## Phase 3 — 레이아웃 수정 + 조건부 버튼 [완료, 배포됨]

| SQL 파일 | 배포 상태 |
|----------|----------|
| `V42__kride_next_buttons.sql` | ✅ 배포됨 (`db/migration/` 폴더에 있음) |
| `V43__kride_layout_updates.sql` | ✅ 배포됨 (`db/migration/` 폴더에 있음) |

### INTRO1 [완료]
- `intro1_hero` IMAGE 행 추가 (sort_order=1, parent=intro1_root)
- `intro1_root` css: `min-h-screen bg-black flex flex-col items-center px-6 pt-12 pb-8 gap-6`
- `intro1_title` css: `text-4xl font-black text-white text-center leading-tight`
- `intro1_buttons` css: `flex flex-col gap-4 w-full max-w-sm mt-auto`

### INTRO2 [완료]
- `artist_grid`: 4열 → **3열** + `place-items-center` (중앙정렬)
- 아티스트 선택 **1개 이상** → "다음" 버튼 표시 (KRIDE_NEXT_BTN)
- 경고 토스트: 5개 초과 클릭 시 "5개 이상은 클릭이 어렵습니다"

### INTRO3 [완료]
- `region_grid`: 그리드 → **flex-wrap** chip 레이아웃
- `region_card`: `square` → **chip** 모드 (TED 스타일 둥근 태그)
- 지역 선택 **1개 이상** → "다음" 버튼 표시
- 경고 토스트: 2개 초과 클릭 시 "지역은 두 곳까지 가능합니다"

---

## Phase 4 — 레이아웃 버그 수정 (2026-05-16)

### 발견된 문제들 (memo/0516log 스크린샷 기준)

| 화면 | 증상 | 원인 | 수정 방법 |
|------|------|------|----------|
| INTRO1 | 이미지 흰 여백 | DB `label_text='kride/intro1_hero.png'` 인데 실제 파일은 `.svg` | V44 migration 배포 |
| INTRO2 | 아티스트 카드 1열 세로 나열 | `DynamicEngine.tsx`가 항상 `flex-row-layout` 추가 → `display:flex`가 `display:grid` 덮어씀 | `DynamicEngine.tsx` 수정 |
| INTRO3 | 지역 목록 텍스트만 세로 나열 | 동일 원인 (`flex-row-layout` 충돌) | 동일 수정으로 해결 |
| INTRO4 | 복수 선택 가능 (의도: 단일 선택) | `PurposeCard.tsx` 배열 push 로직 | `PurposeCard.tsx` 수정 |

### 수정 완료 파일

**`components/DynamicEngine/DynamicEngine.tsx`** (코드 수정 완료)
- `css_class`에 `grid` 또는 `flex` 키워드가 있으면 `flex-row-layout`/`flex-col-layout` 추가 안 함
- 이유: 두 클래스가 동일 specificity이므로 `pages.css` 의 `flex-row-layout { display:flex }` 가 Tailwind `grid { display:grid }` 를 cascade 순서상 덮어썼음

**`components/fields/kride/PurposeCard.tsx`** (코드 수정 완료)
- 단일 선택: `const updated = selected ? [] : [purposeKey];`

**`.ai/V44__fix_intro1_hero_svg.sql`** (미배포)
```sql
UPDATE ui_metadata SET label_text = 'kride/intro1_hero.svg'
WHERE screen_id = 'KRIDE_INTRO1' AND component_id = 'intro1_hero';
```

**`.ai/V45__intro4_single_select.sql`** (미배포)
```sql
UPDATE ui_metadata SET label_text = '1개만 선택할 수 있어요'
WHERE screen_id = 'KRIDE_INTRO4' AND component_id = 'intro4_sub';
```

**`public/img/kride/intro1_hero.svg`** (생성 완료)
- K-pop 공연 + 여행 테마 SVG (360×280, 다크 배경, 퍼포머 실루엣 3명, 지도 핀, 음표)

### 배포 필요 항목

```bash
# 1. V44/V45 migration 폴더로 복사
cp .ai/V44__fix_intro1_hero_svg.sql    subproject/SDUI/SDUI-server/src/main/resources/db/migration/
cp .ai/V45__intro4_single_select.sql   subproject/SDUI/SDUI-server/src/main/resources/db/migration/

# 2. Spring Boot 재시작 (Flyway 자동 적용)
# 3. npm run dev (프론트엔드 재시작 — DynamicEngine/PurposeCard 코드 변경 반영)
```

---

## 신규 컴포넌트

| 파일 | 타입 | 역할 |
|------|------|------|
| `components/fields/kride/KrideNextButton.tsx` | `KRIDE_NEXT_BTN` | `component_props.checkKey` 배열이 1개 이상일 때만 렌더링 |
| `components/fields/kride/KrideWarningToast.tsx` | `KRIDE_WARNING` | `kride-warning` 커스텀 이벤트 수신 → 2.5초 하단 토스트 |

### componentMap 등록 완료
```
KRIDE_NEXT_BTN → KrideNextButton
KRIDE_WARNING  → KrideWarningToast
```

---

## SelectionCard.tsx 변경사항

| 항목 | 변경 전 | 변경 후 |
|------|---------|---------|
| mode 감지 | `circle` / `square` | `circle` / `chip` / `square` |
| 아티스트 최대 | 5개 | 5개 (유지) |
| 지역 최대 | 5개 | **2개** |
| 초과 클릭 시 | 조용히 무시 | `kride-warning` 이벤트 dispatch |
| chip 렌더링 | 없음 | 둥근 태그 (선택 시 흰 배경 반전) |

---

## localStorage 상태 관리 [완료]

- `useBaseActions.tsx`에서 KRIDE 화면(`KRIDE_*` screen_id)의 formData를 `localStorage['kride_form']`에 동기화
- 화면 이동 시 formData 초기화 없이 이전 선택값 복원
- 저장되는 키: `selectedArtists`, `selectedRegions`, `duration`, `purposes`, `budget`

---

## 화면 흐름 및 FastAPI 연동 현황

### 전체 온보딩 흐름

```
INTRO1 (여행 기간)  →  INTRO2 (아티스트)  →  INTRO3 (지역)
  ↓ SET_DURATION        ↓ TOGGLE_ARTIST       ↓ TOGGLE_REGION
                                                   ↓
                     MY_LIST (요약)  ←  INTRO5 (예산)  ←  INTRO4 (목적)
                          ↓              ↑ GOTO_MY_LIST     ↓ SET_PURPOSES
                     FOCUS (지도+일정)       ↑ GOTO_FOCUS
```

- INTRO4 다음 버튼: `ROUTE → /view/INTRO5`
- INTRO5 다음 버튼: `GOTO_MY_LIST → /view/MY_LIST`
- MY_LIST AI 버튼: `GOTO_FOCUS → /view/FOCUS`

### FastAPI 파이프라인

FastAPI 서버(`src/api/fastapi_server.py`)에 AI 추천 엔드포인트가 구현되어 있음.

| 엔드포인트 | 역할 |
|---|---|
| `POST /api/recommend/ai` | 온보딩 기반 POI 추천 리스트 |
| `POST /api/recommend/itinerary` | 일정 JSON + 지도 마커 생성 |

**파이프라인:**
```
Neo4j (아티스트 촬영지 POI) ┐
Neo4j (지역 POI)            ├─→ 합산 + 중복제거 → Groq LLM → 일정 JSON
ChromaDB (목적 벡터검색)    ┘    ↑
                            intfloat/multilingual-e5-small 임베딩
```

**요청 형식 (`/api/recommend/itinerary`):**
```json
{
  "duration": "당일치기",
  "artists": ["BTS", "BLACKPINK"],
  "regions": ["서울"],
  "purposes": ["kculture", "food"],
  "budget": { "min": 500000, "max": 2000000 }
}
```

**응답 형식:**
```json
{
  "itinerary": [
    {
      "day": 1,
      "morning": { "places": [{"name": "...", "address": "...", "tip": "..."}] },
      "afternoon": { "places": [...] }
    }
  ],
  "mapData": { "markers": [{"name": "...", "lat": 37.55, "lon": 126.98}] },
  "source_pois": [...]
}
```

### FOCUS 화면 연동 현황 [미완료 — 다음 작업]

- FOCUS 화면은 `MAP_VIEW` + `ITINERARY_PANEL` 컴포넌트로 DB에 정의되어 있음
- **현재 문제:** DATA_SOURCE가 FastAPI와 연결되지 않아 지도/일정 데이터가 비어있음
- **필요한 작업:**
  1. `useBusinessActions.tsx`의 `GOTO_FOCUS` 액션에서 localStorage 온보딩 데이터를 읽어 FastAPI 호출
  2. 응답(`itinerary`, `mapData`)을 상태에 저장 후 FOCUS 페이지 진입 시 `pageData`로 주입

---

## 검증 체크리스트

### 배포 후 확인 항목
- [ ] `/view/INTRO1`: 검은 배경 + SVG 히어로 이미지 + 큰 제목 + 하단 빨간 버튼 3개
- [ ] `/view/INTRO2`: 3열 grid, 카드 중앙정렬, 1개 선택 시 "다음" 버튼 노출, 5개 초과 시 토스트
- [ ] `/view/INTRO3`: chip 태그 flex-wrap, 선택 시 흰색 반전, 1개 선택 시 "다음" 노출, 2개 초과 시 토스트
- [ ] `/view/INTRO4`: 1개만 선택 가능 (다른 것 클릭 시 이전 선택 해제), 서브타이틀 "1개만 선택할 수 있어요"
- [ ] `/view/INTRO5`: 예산 슬라이더 + "AI 여행 추천 받기" 버튼
- [ ] localStorage `kride_form` 에 선택값 유지 (DevTools → Application → Local Storage)
- [ ] 기존 화면(`/view/MAIN_PAGE`, `/view/LOGIN_PAGE`) 회귀 없음

---

## 남은 작업

| 우선순위 | 항목 | 내용 |
|---------|------|------|
| 🔴 즉시 | V44/V45 배포 | migration 폴더 복사 후 Spring Boot 재시작 |
| 🔴 즉시 | 프론트엔드 재시작 | DynamicEngine/PurposeCard 코드 변경 반영 |
| 🟡 다음 | FOCUS FastAPI 연동 | `GOTO_FOCUS` 액션에서 FastAPI 호출 + 결과 주입 |
| 🟢 나중 | 재온보딩 다이얼로그 | 로그인 사용자 재온보딩 시 "교체/추가" 확인 |
