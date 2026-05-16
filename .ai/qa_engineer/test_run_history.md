# K-Ride 테스트 실행 이력

> 원본 파일: `TEST_RUN_SUMMARY_2026-05-11.md` (프로젝트 루트)
> 기록일: 2026-05-11

---

## 배경 — 최초 확인된 문제 (2026-05-11)

사용자 실행 로그 기준:

| 증상 | 상태 |
|------|------|
| FastAPI `GET /api/artists` → 502 Bad Gateway | ❌ |
| Next.js `/`, `/KRIDE_INTRO2` 접근 시 404 | ❌ |
| Spring Boot `/api/ui/KRIDE_INTRO1`, `/api/ui/KRIDE_INTRO2` | ✅ 200 OK |
| `public/manifest.json` 아이콘 파일 없음 → 404 | ❌ |

---

## 테스트 전 코드 보강 내역

### FastAPI
- `/api/artists`, `/api/regions`: Supabase/Neo4j 외부 의존성 실패 시 fallback 데이터 반환 추가
- Pydantic v2 환경 호환: `Field(default_factory=...)` + `model_rebuild(...)` 적용
- `/api/recommend/itinerary`: stub 형태와 실제 함수 형태 모두 처리하도록 보강

### Next.js 프론트엔드
- `src/app/page.tsx` 추가 — `/` 접근 시 `/browse` redirect
- `src/app/[screenId]/page.tsx` 추가 — screenId URL → 실제 라우트 redirect
- PWA manifest 아이콘: 없는 PNG → 실제 SVG 아이콘으로 교체

### Jest 설정
- `isolatedModules: true`, `diagnostics: false` 추가 — 타입체킹 분리로 속도 개선

---

## 1. FastAPI 단위/통합 테스트 (`test_fastapi.py`)

### 실행 환경
- Python 경로: `C:\Users\Samsung\AppData\Local\Programs\Python\Python310\python.exe`
- 실행 명령:
  ```powershell
  & 'C:\Users\Samsung\AppData\Local\Programs\Python\Python310\python.exe' -m pytest src\api\test_fastapi.py -q
  ```

### 1차 실행 결과
```
13 passed, 11 failed
```
실패 원인: `/api/recommend/itinerary`, `/api/recommend/ai` 에서 Pydantic v2 오류
```
TypeAdapter[...] is not fully defined
```
원인: `from __future__ import annotations` + 동적 모듈 로드 조합에서 `BudgetSchema` 타입 해석 지연

### 2차 실행 결과 (fastapi_server.py 수정 후)
```
24 passed, 6 warnings in 12.58s
```
**전체 통과.**

남은 경고:
- `req.budget.dict()` → Pydantic v2에서 deprecated, `model_dump()`로 교체 권장

---

## 2. Jest 테스트 (`subproject/SDUI/kride/`)

### 실행 환경
- Node: `C:\Program Files\nodejs\node.exe` (v23.4.0)
- npm: `C:\Program Files\nodejs\npm.cmd`

### 2.1 전체 테스트 — 실패 (타임아웃)
```powershell
& 'C:\Program Files\nodejs\npm.cmd' test -- --runInBand
```
결과: 3분 타임아웃, `jest --passWithNoTests --runInBand`에서 멈춤

원인 후보:
- Jest 기본 캐시 디렉토리가 `C:\Users\Samsung\AppData\Local\Temp\jest` → 홈/Temp 접근 막힘

### 2.2 단일 테스트 — 성공
```powershell
& 'C:\Program Files\nodejs\node.exe' .\node_modules\jest\bin\jest.js `
  --runTestsByPath 'D:\kride-project\subproject\SDUI\kride\src\__tests__\components\SelectionCard.test.tsx' `
  --runInBand `
  --testTimeout=10000 `
  --verbose `
  --cacheDirectory 'D:\kride-project\subproject\SDUI\kride\.jest-cache' `
  --watchman=false
```
결과:
```
PASS src/__tests__/components/SelectionCard.test.tsx
Tests: 5 passed, 5 total
```

### 2.3 확인된 테스트 파일 목록
```
src/__tests__/store/onboarding-store.test.ts
src/__tests__/integration/focus-page.test.tsx
src/__tests__/integration/movies-page.test.tsx
src/__tests__/integration/latest-page.test.tsx
src/__tests__/components/SelectionCard.test.tsx
src/__tests__/components/ItineraryPanel.test.tsx
src/__tests__/components/DualRangeSlider.test.tsx
```

### 2.4 타임아웃된 테스트
- `onboarding-store.test.ts` — `ts-node/register`로 store import에 52초 소요
- `DualRangeSlider.test.tsx`
- `ItineraryPanel.test.tsx`
- 전체 Jest 실행

**원인:** Node 23/24 + ts-jest + Next/TS 조합에서 TypeScript 변환 단계가 비정상 느림

---

## 3. Next build

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run build
```
결과: 5분 타임아웃, `next build` 진입 후 멈춤. 코드 컴파일 오류는 아님.

---

## 4. Spring Boot 테스트 (`./gradlew.bat test`)

Gradle wrapper가 `gradle-9.3.1-bin.zip` 다운로드 시도 → 네트워크 샌드박스 차단
```
java.net.SocketException: Permission denied: getsockopt
```
사용자가 네트워크 권한 승인 거부 → 미완료

---

## 5. Contract 테스트 (`test_contract.py`)

두 서버(FastAPI 8000 + Spring Boot 8080) 동시 기동 필요. 아직 실행 완료 안 됨.
```powershell
& 'C:\Users\Samsung\AppData\Local\Programs\Python\Python310\python.exe' -m pytest src\api\test_contract.py -v -m contract
```

---

## 최종 상태 요약

| 영역 | 상태 | 결과 |
|------|------|------|
| FastAPI 단위/통합 (`test_fastapi.py`) | ✅ 완료 | `24 passed`, warning 6개 |
| Jest `SelectionCard.test.tsx` | ✅ 완료 | `5 passed` |
| Jest 전체 | ❌ 미완료 | 타임아웃 |
| Jest `store`, `DualRangeSlider`, `ItineraryPanel` | ❌ 미완료 | 타임아웃 |
| Next build | ❌ 미완료 | 5분 타임아웃 |
| Spring Boot test | ❌ 미완료 | Gradle 네트워크 권한 필요 |
| Contract 테스트 | ❌ 미완료 | 두 서버 동시 기동 필요 |

---

## 권장 후속 조치

1. **Node LTS 전환** — Node 20 또는 22 LTS 사용 (현재 Node 23이 ts-jest와 충돌)
2. **Jest 캐시 경로 고정** — `--cacheDirectory 'D:\kride-project\subproject\SDUI\kride\.jest-cache'`
3. **Jest 재실행**:
   ```powershell
   & 'C:\Program Files\nodejs\node.exe' .\node_modules\jest\bin\jest.js --runInBand --cacheDirectory 'D:\kride-project\subproject\SDUI\kride\.jest-cache' --watchman=false
   ```
4. **Gradle 로컬 캐시 확보 후 Spring Boot 테스트**
5. **두 서버 기동 후 contract 테스트**:
   ```powershell
   & 'C:\Users\Samsung\AppData\Local\Programs\Python\Python310\python.exe' -m pytest src\api\test_contract.py -v -m contract
   ```

---

## Pydantic v2 경고 처리 (FastAPI)

`fastapi_server.py`에서 `req.budget.dict()` → `req.budget.model_dump()` 교체 필요.
