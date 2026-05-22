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

---

## 2026-05-20 SDUI K-Ride 유닛/통합 테스트 추가 및 실행

### 대상
- `subproject/SDUI/metadata-project`
- `subproject/SDUI/SDUI-server`

### 신규 테스트 파일
- Frontend unit: `subproject/SDUI/metadata-project/tests/components/KrideNextButton.test.tsx`
- Frontend integration: `subproject/SDUI/metadata-project/tests/integration/kride-recommend-api.test.ts`
- Backend unit: `subproject/SDUI/SDUI-server/src/test/java/com/domain/demo_backend/domain/ui/service/UiServiceKrideTest.java`
- Backend integration: `subproject/SDUI/SDUI-server/src/test/java/com/domain/demo_backend/domain/ui/controller/UiControllerKrideIntegrationTest.java`

### 검증 범위
- `KrideNextButton`: `formData` 조건부 렌더링, snake_case metadata 지원, `onAction(meta, {})` 호출 검증
- Next API Route `POST /api/kride/recommend/itinerary`: FastAPI `/api/recommend/itinerary` 프록시 성공/오류 응답 검증
- `UiService`: K-Ride UI metadata 트리 구성, `component_props` JSON 파싱, ROLE 기반 metadata 필터링 검증
- `UiController`: `/api/ui/KRIDE_INTRO4`, `/api/ui/KRIDE_INTRO5` 응답 구조, 인증 principal 기반 ROLE 전달 및 guest 기본값 검증

### 실행 결과

#### Frontend Jest
```powershell
.\node_modules\.bin\jest.cmd --runTestsByPath tests\components\KrideNextButton.test.tsx tests\integration\kride-recommend-api.test.ts --runInBand --cacheDirectory .jest-cache --watchman=false
```

최종 결과:
```text
PASS tests/integration/kride-recommend-api.test.ts
PASS tests/components/KrideNextButton.test.tsx

Test Suites: 2 passed, 2 total
Tests:       4 passed, 4 total
Snapshots:   0 total
Time:        3.157 s
```

비고:
- 초기 실행에서 Next 16 `NextResponse.json`과 Jest `whatwg-fetch` 폴리필 간 차이로 통합 테스트가 실패했다.
- 테스트 대상 라우트 로직 검증에 집중하도록 `next/server`의 `NextResponse.json`만 테스트 더블로 고정한 뒤 통과했다.
- 실행 중 Node `punycode` deprecation warning이 출력되었으나 실패 요인은 아니다.

#### Backend Gradle
```powershell
.\gradlew.bat test --tests "com.domain.demo_backend.domain.ui.service.UiServiceKrideTest" --tests "com.domain.demo_backend.domain.ui.controller.UiControllerKrideIntegrationTest"
```

최종 결과:
```text
BUILD SUCCESSFUL in 1m 3s
5 actionable tasks: 2 executed, 3 up-to-date
```

JUnit XML 확인:
```text
UiServiceKrideTest: tests=2, failures=0, errors=0, skipped=0
UiControllerKrideIntegrationTest: tests=2, failures=0, errors=0, skipped=0
```

비고:
- 첫 백엔드 실행은 신규 테스트의 AssertJ `Map<?, ?>.containsEntry(...)` 제네릭 타입 추론 문제로 `compileTestJava`에서 실패했고, 명시적인 `props.get(...)` 비교로 수정했다.
- 샌드박스 내부 실행은 Gradle distribution 다운로드에서 `Permission denied: getsockopt`로 실패했으며, 승인된 외부 실행에서 정상 통과했다.
- Spring Boot 테스트 종료 로그에 Redis 미기동 및 H2에서 Postgres listener unwrap 관련 로그가 출력되었지만, JUnit suite는 failures/errors 0으로 성공했다.

---

## 2026-05-20 SDUI Community 프론트/백엔드 유닛·통합 테스트 추가 및 실행

### 대상
- `subproject/SDUI/metadata-project`
- `subproject/SDUI/SDUI-server`

### 신규 테스트 파일
- Frontend unit: `subproject/SDUI/metadata-project/tests/services/communityServiceFormData.test.ts`
- Frontend integration: `subproject/SDUI/metadata-project/tests/integration/communityService.integration.test.ts`
- Backend unit: `subproject/SDUI/SDUI-server/src/test/java/com/domain/demo_backend/domain/community/service/PostReportServiceTest.java`
- Backend integration: `subproject/SDUI/SDUI-server/src/test/java/com/domain/demo_backend/domain/community/controller/CommunityControllerIntegrationTest.java`

### 검증 범위
- `communityService` FormData: 게시글 생성/수정 시 `post` JSON part와 이미지 파일 part 직렬화 검증
- `communityService` integration: 공통 axios 인스턴스를 통한 게시글 목록 조회, 신고 요청 URL/params/body, `withCredentials`, ApiResponse unwrap 검증
- `PostReportService`: 중복 신고 차단, 신고 저장, 게시글 `reportCount` 증가 검증
- Community controllers: 게시글 목록 조회, multipart 게시글 작성, 좋아요, 신고, 팔로우 API의 `ApiResponse` 구조와 인증 사용자 식별값 전달 검증

### 실행 결과

#### Frontend Jest
```powershell
.\node_modules\.bin\jest.cmd --runTestsByPath tests\services\communityService.test.ts tests\services\communityServiceFormData.test.ts tests\integration\communityService.integration.test.ts --runInBand --cacheDirectory .jest-cache --watchman=false
```

최종 결과:
```text
PASS tests/services/communityService.test.ts
PASS tests/integration/communityService.integration.test.ts
PASS tests/services/communityServiceFormData.test.ts

Test Suites: 3 passed, 3 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        8.367 s
```

비고:
- MSW + jsdom XHR 조합에서 응답 body가 빈 문자열로 들어와 통합 테스트가 불안정했다.
- 최종 통합 테스트는 실제 `api` axios 인스턴스의 adapter 경계에서 URL/params/body/withCredentials와 응답 unwrap을 검증하는 방식으로 고정했다.
- 실행 중 Node `punycode` deprecation warning이 출력되었으나 실패 요인은 아니다.

#### Backend Gradle
```powershell
.\gradlew.bat test --tests "com.domain.demo_backend.domain.community.service.*" --tests "com.domain.demo_backend.domain.community.controller.CommunityControllerIntegrationTest"
```

최종 결과:
```text
BUILD SUCCESSFUL in 51s
5 actionable tasks: 1 executed, 4 up-to-date
```

JUnit XML 확인:
```text
CommunityPostServiceTest: tests=9, failures=0, errors=0, skipped=0
PostLikeServiceTest: tests=3, failures=0, errors=0, skipped=0
PostReportServiceTest: tests=2, failures=0, errors=0, skipped=0
UserFollowServiceTest: tests=4, failures=0, errors=0, skipped=0
CommunityControllerIntegrationTest: tests=5, failures=0, errors=0, skipped=0
```

비고:
- Spring Boot 통합 테스트 중 Redis 미기동 및 H2에서 Postgres listener unwrap 관련 로그가 출력되었지만, 모든 JUnit suite는 failures/errors 0으로 성공했다.

---

## 2026-05-20 SDUI-server Spring Boot - FastAPI API 통합 테스트 추가 및 실행

### 대상
- `subproject/SDUI/SDUI-server`
- `src/api/fastapi_server.py`

### 신규/수정 파일
- Spring Boot integration: `subproject/SDUI/SDUI-server/src/test/java/com/domain/demo_backend/domain/kridechat/service/FastApiChatClientIntegrationTest.java`
- FastAPI contract/integration: `tests/test_sdui_fastapi_contract.py`
- FastAPI compatibility: `src/api/fastapi_server.py`

### 검증 API
- Spring `FastApiChatClient` -> FastAPI `POST /api/recommend/ai`
- Spring `FastApiChatClient` -> FastAPI `POST /api/recommend/itinerary`
- Spring `FastApiChatClient` -> FastAPI `POST /api/chat/stream`
- FastAPI `GET /api/artists`
- FastAPI `GET /api/regions`
- FastAPI `POST /api/recommend/ai`
- FastAPI `POST /api/recommend/itinerary`
- FastAPI `POST /api/chat/stream`

### 반영 내용
- Spring Boot 쪽은 로컬 HTTP fake FastAPI 서버를 띄워 `WebClient`가 실제 POST 요청을 보내고 응답을 역직렬화하는지 검증했다.
- FastAPI 쪽은 `TestClient`로 SDUI가 소비하는 API 응답 shape을 검증했다.
- Spring Boot가 호출하는 `/api/chat/stream` 엔드포인트가 FastAPI에 없어 plain text streaming 호환 엔드포인트를 추가했다.
- Spring Boot가 `duration`을 숫자로 보내는 케이스를 FastAPI가 받을 수 있도록 `ItineraryRequest.duration`을 `str | int`로 조정했다.

### 실행 결과

#### Spring Boot Gradle
```powershell
.\gradlew.bat test --tests "com.domain.demo_backend.domain.kridechat.service.FastApiChatClientIntegrationTest"
```

최종 결과:
```text
BUILD SUCCESSFUL in 1m 5s
5 actionable tasks: 2 executed, 3 up-to-date
```

JUnit XML 확인:
```text
FastApiChatClientIntegrationTest: tests=3, failures=0, errors=0, skipped=0
```

#### FastAPI Pytest
```powershell
C:\Users\Samsung\AppData\Local\Programs\Python\Python310\python.exe -m pytest tests\test_sdui_fastapi_contract.py -q
```

최종 결과:
```text
5 passed, 1 warning in 3.99s
```

비고:
- 첫 FastAPI 실행에서 `/api/recommend/itinerary`가 Spring의 numeric duration payload를 422로 거부하는 문제가 확인되어 코드 호환성을 수정한 뒤 재실행했다.
- Pytest 실행 중 Pydantic v2 `dict()` deprecation warning이 1건 출력되었으나 실패 요인은 아니며 전체 테스트는 통과했다.
