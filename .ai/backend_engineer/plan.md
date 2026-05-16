# K-Ride Backend 구현 계획

> 작성일: 2026-05-16
> 상태: 검토 중 (사용자 승인 전)

---

## [P1] FOCUS 화면 FastAPI 연동 — GOTO_FOCUS 액션 구현

### 파일
`subproject/SDUI/metadata-project/components/DynamicEngine/hook/useBusinessActions.tsx`

### 구현 내용

```typescript
case "GOTO_FOCUS": {
  // 1. localStorage에서 온보딩 데이터 읽기
  const raw = localStorage.getItem("kride_form");
  const krideForm = raw ? JSON.parse(raw) : {};

  try {
    // 2. FastAPI 추천 API 호출
    const response = await fetch("/api/kride/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration: krideForm.duration ?? "당일치기",
        artists: krideForm.selectedArtists ?? [],
        regions: krideForm.selectedRegions ?? [],
        purposes: krideForm.purposes ?? [],
        budget: krideForm.budget ?? {},
      }),
    });

    if (!response.ok) throw new Error(`FastAPI 오류: ${response.status}`);

    const data = await response.json();
    // 3. 결과를 sessionStorage에 저장 (FOCUS 페이지에서 읽음)
    sessionStorage.setItem("kride_focus_data", JSON.stringify(data));
  } catch (error) {
    console.error("[GOTO_FOCUS] FastAPI 호출 실패:", error);
    // 실패 시에도 FOCUS 페이지로 이동 (빈 화면 표시)
  }

  // 4. FOCUS 페이지로 이동
  router.push("/view/FOCUS");
  break;
}
```

### next.config.ts 프록시 추가

```typescript
// 기존 SDUI 프록시 뒤에 추가
{
  source: "/api/kride/:path*",
  destination: "http://localhost:8000/api/:path*"
}
```

### FOCUS 페이지에서 데이터 읽기

FOCUS 화면 진입 시 `sessionStorage['kride_focus_data']`에서 `itinerary`와 `mapData`를 읽어 `pageData`로 주입.

---

## [P2] V44/V45 Migration 배포

사용자가 직접 실행:
```bash
cp .ai/V44__fix_intro1_hero_svg.sql    subproject/SDUI/SDUI-server/src/main/resources/db/migration/
cp .ai/V45__intro4_single_select.sql   subproject/SDUI/SDUI-server/src/main/resources/db/migration/
```
이후 Spring Boot 재시작 → Flyway 자동 적용 (Current version: 43 → 45)

---

## [P3] FastAPI 배포 환경 구성 (나중)

```yaml
# docker-compose.yml 추가 서비스
fastapi:
  build: .
  ports:
    - "8000:8000"
  environment:
    - NEO4J_URI=${NEO4J_URI}
    - GROQ_API_KEY=${GROQ_API_KEY}
```

`next.config.ts` 환경변수화:
```typescript
destination: `${process.env.FASTAPI_URL ?? "http://localhost:8000"}/api/:path*`
```

---

---

## KRIDE 인트로 화면 레이아웃 수정 — V46 마이그레이션 — 2026-05-17

> 스크린샷 피드백(.ai/memo/0517log) 반영

### V46 변경 내용

| screen_id | component_id | 변경 컬럼 | 변경 내용 |
|-----------|-------------|----------|----------|
| KRIDE_INTRO1 | intro1_title | component_type | `TEXT` → `TYPEWRITER_TEXT` |
| KRIDE_INTRO1 | intro1_title | css_class | `leading-snug` 추가 |
| KRIDE_INTRO1 | intro1_sub | css_class | `mb-4` 추가 |
| KRIDE_INTRO1 | intro1_buttons | css_class | `mt-auto` 제거 → `mt-6` |
| KRIDE_INTRO2 | intro2_root | css_class | `pt-4` 추가 |
| KRIDE_INTRO2 | intro2_title | css_class | `sticky top-0 bg-black z-10 py-3` |
| KRIDE_INTRO2 | artist_grid | css_class | `place-items-center` 제거 |
| KRIDE_INTRO3 | intro3_root | css_class | `pt-4` 추가 |
| KRIDE_INTRO3 | intro3_title | css_class | `sticky top-0 bg-black z-10 py-3` |
| KRIDE_INTRO3 | region_grid | css_class | `flex flex-wrap` → `grid grid-cols-4 gap-3 pb-28` |

### 배포 방법

```bash
# V46 파일은 이미 migration 폴더에 생성됨
# Spring Boot 재시작 → Flyway 자동 적용 (V45 → V46)
cd subproject/SDUI/SDUI-server
./gradlew bootRun
```

로그 확인: `Successfully applied 1 migration to schema "public" (current version: 46)`

---

## 완료 기준

| 항목 | 확인 방법 |
|------|----------|
| GOTO_FOCUS 액션에서 FastAPI 호출 | 브라우저 Network 탭에서 `/api/kride/itinerary` POST 요청 확인 |
| FOCUS 화면에 일정 표시 | `/view/FOCUS` 진입 시 일정 카드 렌더링 |
| FOCUS 화면에 지도 마커 표시 | MAP_VIEW 컴포넌트에 마커 표시 |
| V44/V45 Flyway 적용 | Spring Boot 로그에 `Successfully applied 2 migrations` 확인 |
