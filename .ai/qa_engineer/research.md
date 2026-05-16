# K-Ride QA 분석 — 알려진 버그 및 테스트 전략

> 분석일: 2026-05-16

---

## 1. 해결된 버그 이력 (Phase 1~4)

| 날짜 | 화면 | 증상 | 원인 | 해결 |
|------|------|------|------|------|
| 2026-05-16 | 공통 | 404 라우팅 | next-pwa + turbopack 충돌 | `next.config.ts`에서 turbopack 제거, `--webpack` 강제 |
| 2026-05-16 | INTRO1 | 이미지 흰 여백/404 | `encodeURIComponent`가 `/`를 `%2F`로 인코딩 | `ImageField.tsx`에서 path segment별 인코딩 |
| 2026-05-16 | INTRO1 | SVG 이미지 없음 | DB `label_text='kride/intro1_hero.png'`, 실제 파일은 `.svg` | V44 migration (미배포) |
| 2026-05-16 | INTRO2 | 아티스트 1열 나열 | `flex-row-layout`이 Tailwind `grid`를 cascade 덮어씀 | DynamicEngine.tsx grid/flex 키워드 감지 |
| 2026-05-16 | INTRO3 | 지역 chip 레이아웃 깨짐 | 동일 원인 | 동일 해결 |
| 2026-05-16 | INTRO4 | 복수 선택 가능 | PurposeCard 배열 push 로직 | `[purposeKey]` 단일 선택으로 교체 |

---

## 2. 현재 미해결 이슈

| 이슈 | 증상 | 상태 |
|------|------|------|
| V44/V45 미배포 | INTRO1 이미지 여전히 404, INTRO4 서브타이틀 "복수 선택 가능해요" | 사용자 직접 실행 필요 |
| FOCUS 화면 데이터 없음 | MAP_VIEW + ITINERARY_PANEL 렌더링되나 데이터 비어있음 | FastAPI 연동 미완료 |

---

## 2-1. [메모] 답변 — 2026-05-17

### [메모] PWA앱에서 localStorage 사용 괜찮을까?

**결론: 안전하게 사용 가능**

PWA(Progressive Web App)에서 `localStorage`는 표준 Web Storage API이며 대부분의 모바일 브라우저(Chrome, Safari, Samsung Internet)에서 정상 지원된다.

**주의 사항:**
- iOS Safari **개인정보 보호 모드**: localStorage 쓰기 시 `QuotaExceededError` 발생 가능. `try/catch`로 처리 권장.
- **PWA 오프라인**: Service Worker는 localStorage에 접근 불가 (SW scope 밖). 현재 K-Ride 설계는 SW에서 localStorage를 읽지 않으므로 문제 없음.
- **용량**: 도메인당 5~10MB. `kride_form` 데이터(아티스트/지역 배열 수십 건) 수준은 문제 없음.

**K-Ride 현재 사용 패턴:**
- `localStorage['kride_form']` — 온보딩 선택값 (앱 재시작 후에도 유지 필요 → localStorage 적합)
- `sessionStorage['kride_focus_data']` — FastAPI 추천 결과 (세션 중 일회성 → sessionStorage 적합)

---

### [메모] chip태그 페이지 → flex 1열로 보임

**원인:** `region_grid`의 css_class가 `flex flex-wrap gap-3`이었고, SelectionCard(chip 모드)에 `w-full`이 없어서 한 칸짜리 행으로 늘어짐.

**해결 (V46 마이그레이션 + SelectionCard 수정 — 2026-05-17):**
1. `region_grid` css_class: `flex flex-wrap` → `grid grid-cols-4 gap-3 pb-28` (4열 고정)
2. `SelectionCard.tsx` chip 모드: `w-full flex items-center justify-center` 추가

결과: 12개 지역 = 4×3 그리드, 각 chip이 셀을 꽉 채워 정렬됨.

**검증 항목 업데이트:**
- [x] INTRO3 chip 태그: V46 배포 후 4열 grid 확인 필요 (기존 체크리스트 항목 대체)

---

## 3. 테스트 전략

### SDUI 렌더링 검증 원칙
- `componentMap` 등록 확인: `console.warn` 없이 컴포넌트 렌더링되는지
- formData 바인딩: `KRIDE_NEEDS_FORM` Set에 등록된 컴포넌트만 `formData` prop 수신
- 리피터: `ref_data_id` 있는 GROUP은 `pageData[refId]` 배열로 렌더링

### localStorage 검증
```javascript
// DevTools Console에서 확인
JSON.parse(localStorage.getItem('kride_form'))
// 예상 결과: { duration, selectedArtists, selectedRegions, purposes, budget }
```

### FastAPI 응답 검증
```bash
curl -X POST http://localhost:8000/api/recommend/itinerary \
  -H "Content-Type: application/json" \
  -d '{"duration":"당일치기","artists":["BTS"],"regions":["서울"],"purposes":["kculture"],"budget":{"min":500000,"max":2000000}}'
# 기대 응답: { itinerary: [...], mapData: { markers: [...] }, source_pois: [...] }
```

---

## 4. 회귀 테스트 범위

K-Ride SDUI 화면 추가 및 DynamicEngine 수정으로 영향 받을 수 있는 기존 화면:
- `LOGIN_PAGE` — Spring Security + JWT 인증
- `MAIN_PAGE` — Bento Grid 레이아웃
- `DIARY_LIST` / `DIARY_WRITE` — 기존 컨텐츠 화면
- `ADMIN_PAGE` — RBAC 권한 관리

DynamicEngine 변경(grid/flex 키워드 감지) 영향 범위:
- `customClass`에 `grid`/`flex` 없는 GROUP → 기존과 동일 동작 (하위 호환 확인됨)
- `customClass`에 `grid`/`flex` 있는 GROUP → direction 클래스 미추가 (KRIDE 화면만 해당)
