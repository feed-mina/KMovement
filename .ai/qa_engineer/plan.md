# K-Ride QA 계획

> 작성일: 2026-05-16

---

## 즉시 검증 항목 (V44/V45 배포 후)

### INTRO1 검증
- [ ] `/view/KRIDE_INTRO1` 진입 시 검은 배경
- [ ] SVG 히어로 이미지 (`public/img/kride/intro1_hero.svg`) 정상 표시 (404 없음)
- [ ] 큰 제목 텍스트 표시
- [ ] 하단 빨간 버튼 3개 (당일치기/1박2일/2박3일)
- [ ] 버튼 클릭 시 `kride_form.duration` 저장 + INTRO2 이동

### INTRO2 검증
- [ ] 아티스트 카드 **3열 grid** 배열 (1열 아님) — [완료] DynamicEngine REPEATER wrapper 수정 2026-05-17, 프론트 재시작 후 확인 필요
- [ ] 아이돌 원형 이미지가 표시됨 — [완료] 이미지 없으면 이름 이니셜(B, B, I, N...) 원형으로 표시 2026-05-17
- [ ] 카드 중앙정렬
- [ ] 아티스트 클릭 시 선택 상태 표시 (체크 아이콘)
- [ ] 1개 이상 선택 시 KRIDE_NEXT_BTN 표시
- [ ] 5개 초과 클릭 시 **토스트** 경고 "5개 이상은 클릭이 어렵습니다" (인라인 텍스트 아님)
### [메모] PWQ앱에서 localStorage 사용 괜찮을까? → [답변] qa_engineer/research.md 2-1 항목 참조
- [ ] `kride_form.selectedArtists` localStorage 저장 확인

### INTRO3 검증
### [메모] chip태그 페이지 -> flex 1열로 보임 → [완료] V46 마이그레이션 + DynamicEngine REPEATER wrapper 수정으로 해결 (2026-05-17)
- [ ] 지역 chip **4열 grid** 배열 (세로 1열 아님) — [완료] DynamicEngine REPEATER wrapper 수정 2026-05-17, 프론트 재시작 후 확인 필요
- [ ] 선택 시 흰색 반전
- [ ] 1개 이상 선택 시 KRIDE_NEXT_BTN 표시
- [ ] 2개 초과 클릭 시 경고 토스트 "지역은 두 곳까지 가능합니다"
- [ ] `kride_form.selectedRegions` localStorage 저장 확인

### INTRO3 추가 검증 (V47)
- [ ] 제목이 정적 텍스트로 표시 (타이핑 효과 없음 — TYPEWRITER_TEXT → TEXT 복원)
- [ ] 지역 chip 1개 선택 후 스크롤 없이 다음 버튼 바로 표시

### INTRO4 검증
- [ ] 목적 카드 6개 표시
- [ ] **단일 선택만 가능** — 다른 카드 클릭 시 이전 선택 해제
- [ ] 서브타이틀 "1개만 선택할 수 있어요" (V45 배포 후)
- [ ] `kride_form.purposes` localStorage 저장 확인
- [ ] **'여' 글자 겹침 없음** — 진입 시 title이 purpose card에 가려지지 않음 (V47)
- [ ] **다음 버튼 즉시 표시** — 진입 직후 스크롤 없이 하단 버튼 확인 (V47)
- [ ] INTRO4 → INTRO5 이동 정상

### INTRO5 검증
- [ ] 예산 DualRangeSlider 표시 및 동작
- [ ] "AI 여행 추천 받기" 버튼 표시
- [ ] 버튼 클릭 시 MY_LIST 이동

---

## FOCUS 화면 연동 후 검증 (P3 완료 후)

- [ ] MY_LIST에서 "AI 추천 시작" 클릭 시 FastAPI POST 요청 발생 (Network 탭)
- [ ] `/api/kride/itinerary` 200 응답 수신
- [ ] FOCUS 화면 진입 시 일정 카드 렌더링
- [ ] FOCUS 화면 진입 시 지도 마커 표시
- [ ] FastAPI 오류 시 빈 화면으로 graceful fallback

---

## 회귀 테스트 (모든 변경 후)

- [ ] `LOGIN_PAGE` 정상 로그인/로그아웃
- [ ] `MAIN_PAGE` Bento Grid 레이아웃 정상
- [ ] 기존 화면에서 console.error 없음
- [ ] DynamicEngine grid/flex 키워드 감지 로직 — 기존 화면 regression 없음

---

## 자동화 테스트 실행

```bash
# 단위 테스트
cd subproject/SDUI/metadata-project
npm run test

# E2E (KRIDE 온보딩 흐름)
npx playwright test tests/kride/

# 백엔드
cd subproject/SDUI/SDUI-server
./gradlew test
```
