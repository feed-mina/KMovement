# K-Ride 아키텍처 개선 계획

> 작성일: 2026-05-16
> 상태: 검토 중 (사용자 승인 전)

---

## Phase 1 — FOCUS 화면 FastAPI 연동 [🔴 즉시]

### 목표
온보딩 완료 후 FOCUS 화면에서 FastAPI 추천 결과(일정 + 지도 마커)가 실제로 표시되도록 한다.

### 구현 위치
`subproject/SDUI/metadata-project/components/DynamicEngine/hook/useBusinessActions.tsx`

### 구현 내용
```typescript
case "GOTO_FOCUS": {
  const krideForm = JSON.parse(localStorage.getItem("kride_form") || "{}");
  const response = await fetch("/api/kride/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      duration: krideForm.duration,
      artists: krideForm.selectedArtists ?? [],
      regions: krideForm.selectedRegions ?? [],
      purposes: krideForm.purposes ?? [],
      budget: krideForm.budget ?? {},
    }),
  });
  const data = await response.json();
  // data.itinerary, data.mapData를 FOCUS 페이지 pageData로 주입
  router.push("/view/FOCUS");
  break;
}
```

### Next.js 프록시 추가 (`next.config.ts`)
FastAPI가 `http://localhost:8000`에 있으므로 프록시 규칙 추가:
```typescript
{ source: "/api/kride/:path*", destination: "http://localhost:8000/api/:path*" }
```

### FOCUS 화면 컴포넌트 연동
- `MAP_VIEW`: `pageData.mapData.markers` 배열로 지도 마커 렌더링
- `ITINERARY_PANEL`: `pageData.itinerary` 배열로 일정 카드 렌더링

---

## Phase 2 — V44/V45 Migration 배포 [🔴 즉시]

사용자가 직접 실행:
```bash
cp .ai/V44__fix_intro1_hero_svg.sql    subproject/SDUI/SDUI-server/src/main/resources/db/migration/
cp .ai/V45__intro4_single_select.sql   subproject/SDUI/SDUI-server/src/main/resources/db/migration/
# Spring Boot 재시작 → Flyway 자동 적용
# npm run dev → 프론트엔드 재시작
```

---

## Phase 3 — FastAPI EC2 배포 [🟡 중간]

현재 FastAPI가 로컬(port 8000)에서만 동작. 배포 환경 구성 필요:
- Docker Compose에 FastAPI 서비스 추가 또는 별도 EC2 인스턴스
- `next.config.ts`의 FastAPI 프록시 URL을 환경변수로 분리
- `FASTAPI_URL=http://localhost:8000` (개발) / `FASTAPI_URL=http://ec2-xxx.compute.amazonaws.com:8000` (운영)

---

## Phase 4 — 재온보딩 다이얼로그 [🟢 나중]

로그인 사용자가 이미 온보딩을 완료한 상태에서 INTRO1에 재진입 시:
- "이전 설정을 교체할까요 / 추가할까요?" 확인 다이얼로그 표시
- 취소 시 MY_LIST 또는 FOCUS로 리다이렉트

---

## 결정 사항 이력

| 날짜 | 결정 | 이유 |
|------|------|------|
| 2026-05-16 | turbopack 제거, webpack 강제 | next-pwa@5.6.0과 App Router 라우팅 충돌 |
| 2026-05-16 | DynamicEngine grid/flex 키워드 감지 | CSS cascade 충돌 (flex-row-layout이 grid 덮어씀) |
| 2026-05-16 | PurposeCard 단일 선택 | INTRO4 목적은 1개만 선택 가능 (기획 요건) |
