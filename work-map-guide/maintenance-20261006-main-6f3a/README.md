# KMovement `main` 유지보수·인수인계 보고서

기준 시점: 2026-10-06 KST  
기준 브랜치: `origin/main` / `3a575d169cd0817f7be2e3cb38159e5983024a3c`  
계획 원문: `feed-mina/ME`의 `01-History/2026-10-04_KMovement_전체_작업지도_기능단계분리/kmovement-feature-micro-action-plan-20261004.md`

## 결론

`main`은 F1부터 F12까지 코드·일부 자동검증·Hostinger 운영 검증이 누적된 상태지만, 모든 계획 행동이 완료된 것은 아니다. F7의 남은 조치는 사용자가 해결했다고 알려 왔다. 다만 이번 보고서에서는 새 OAuth·프로필 저장 증거를 직접 확인하지 못했으므로, 해결 사실은 사용자 보고로 기록하고 운영 검증 상태는 별도로 둔다. 그 밖의 유지보수 우선순위는 **F8 실제 인증 사용자별 저장 격리 재확인**, **F12 출처 후보·공급자 키·단가를 준비한 뒤의 유료 생성 시험**, 그리고 F10·F13~F16의 미실행 기능이다. 배포 성공, API 200, 화면 렌더링은 각각 별도의 증거로 보존한다.

계획 문서의 기준 SHA `1f863f9`는 과거 스냅샷이다. 이 보고서는 현재 `main`의 `3a575d1…`와 그 이후의 릴리스 증거를 기준으로 갱신했다.

## 작업 상태 구분

| 구분 | 의미 |
|---|---|
| 확인 완료 | 코드와 해당 테스트 또는 운영 요청·화면 증거가 함께 있음 |
| 부분 완료 | 구현·CI는 있으나 실사용자, 외부 공급자, 일부 계획 행동이 남음 |
| 미실행/차단 | 코드 일부 또는 계획만 있고 검증을 시작할 조건이 없음 |
| 유지보수 주의 | 현재 동작하지만 변경 시 회귀 확인이 필요한 경계 |

## 계획 대비 남은 작업

| 단계 | 현재 확인 | 남은 최소 행동 |
|---|---|---|
| B0 | 기준점·배포 식별자와 롤백 기록이 누적됨 | 릴리스마다 최신 SHA·digest·config·rollback을 다시 묶기 |
| F1 | 웹 주소·지도 화면의 과거 실배포 증거 존재 | Kakao 허용 도메인, 주소 선택→좌표→마커 이동을 최신 main에서 재확인 |
| G1 | Spring/PostgreSQL/Redis, Flyway 122, 백업·health 확인 | 재기동·복원 리허설과 권한/포트 점검을 정기화 |
| F2 | 모바일 주소 검색 계약·구현 존재 | 정상/빈 결과/공급자 오류를 실제 모바일 화면에서 다시 검증 |
| F3 | SDUI 엔진·screen registry 존재 | 화면별 source, loading/empty/error, 역할별 노출을 계약표로 닫기 |
| F4–F5 | 공개 조회와 화면·배포 기록 있음 | 공급자 오류와 출처·좌표·빈 필터를 최신 운영에서 재검증 |
| F6-A/B/C | 공개 카탈로그와 승인·권리·근거 필터가 구현되고 F6 릴리스 증거 있음 | 승인 취소·404/500·cache miss/hit/fallback을 정기 회귀하고 데이터 품질 감시 |
| F7 | 일반 로그인·카카오 진입·프로필·로그아웃 코드와 비로그인 화면 확인. 사용자가 남은 조치를 해결했다고 보고함 | 해결 보고는 반영됨. 새 실계정 callback·`/api/auth/me`·프로필 저장·로그아웃 증거가 제공되거나 재확인될 때 운영 검증까지 완료로 갱신 |
| F8-A/B/C | 저장 API·중복·삭제·페이지 5개·공개 취소 정책의 PostgreSQL CI 통과 | 실제 두 사용자 세션에서 생성→중복→목록→삭제→재조회→격리를 운영 화면으로 확인 |
| F9 | 제보·검수·공개 코드/CI와 병합 기록 있음 | 관리자 실제 승인·거절 화면, 감사 로그, 승인 후 공개를 운영 계정으로 확인 |
| F10 | 커뮤니티 컴포넌트와 API 경로가 존재 | 읽기·게시글·댓글/좋아요·신고/검수의 각 행동과 권한 격리 구현·E2E |
| F11 | 운영 배포, 5폭 실제 화면, 경로/왕복/경계/날씨 오류 증거, CPU 55 tests | 지도 타일·그래프 데이터 갱신 절차와 장애 알림을 운영 런북에 추가 |
| F12 | 빈 후보 200·guest 401·예산 차단·5 USD 상한 설정 확인 | 승인된 출처 후보 준비 → Groq 키·계정 단가 설정 → 모의 공급자/실제 생성 시험. 키 미준비 상태에서는 생성 금지 |
| F13 | SSE 챗봇 진입점 존재 | 401/키 오류/429, 연결·DONE·중단·정리·중복 방지 검증 |
| F14 | Celery task 진입점 존재 | embed→rerank→weather→event→TTS→cleanup 각 상태·retry·revoke·재기동·만료 검증 |
| F15 | RunPod workflow와 비용 감사 경로 존재 | 승인 전 job 0, 비용·자동종료·보존·동의·중복방지 시험. 비용 승인 없이는 실행하지 않음 |
| F16 | 관리자/파트너 컴포넌트·workflow 존재 | 역할별 403, 승인 queue, 감사·rollback, partner 분리 검증 |

## 화면 → 코드 → API → 저장 구조

### 공개 카탈로그와 저장 기능

공개 목록 화면은 `components/constants/screenMap.ts`와 DynamicEngine가 선택한 화면을 렌더링하고, K-POP·F8 경로는 Next route handler가 Spring 내부 API를 호출한다. F6 공개 데이터는 승인·공개 상태와 권리 필터를 통과해야 하며, F8 저장은 사용자 식별자를 서버 세션에서 얻어 다른 사용자의 행을 반환하지 않아야 한다. 페이지 크기 5와 빈 목록은 화면 상태로 분리한다.

유지보수 시 `screenId → 컴포넌트 → Next route → Spring controller/service → PostgreSQL 테이블/Flyway` 순서로 추적한다. API가 200이어도 화면 카드·상세·빈 결과가 실제 계약과 맞는지 별도 확인한다.

### 프로필 저장

`app/api/auth/update-profile/route.ts`는 `AUTH_BACKEND_URL` 또는 `BACKEND_URL`을 선택하고 쿠키를 전달한 뒤 Spring `/api/auth/update-profile`로 프록시한다. 운영 누락 시 503, upstream timeout은 504로 구분한다. Spring `AuthController.updateAdditionalInfo`는 인증 principal을 요구하고 전화·도로명·상세주소·우편번호를 저장하며 역할을 USER로 올리고 신규 사용자 membership/알림 부수효과를 실행한다. 저장 성공은 이 경로와 `/api/auth/me` 재조회가 함께 맞을 때만 완료로 본다.

### F11/F12 경로

`KrideFocusScreen`과 `useKrideItinerary`는 `/api/kride/recommend/itinerary`를 호출한다. Next route는 먼저 Spring `/api/auth/me`로 인증을 확인하고 내부 토큰·수치 user ID를 FastAPI `/api/public/itinerary`에 전달한다. FastAPI는 공개 catalog와 Chroma 검색 결과만 허용하고, 생성 후 catalog를 재조회해 없는 ID·중복·기간 밖 항목을 버린다. 후보가 없으면 200 `empty_candidates`, 비용·usage는 null이다. `itinerary_budget.py`는 SQLite 예약을 사용하고 단가가 0/미설정이면 공급자 호출 전에 차단한다.

## 운영 확인 증거와 한계

확인된 main/운영 증거는 다음과 같다.

- main merge: `3a575d169cd0817f7be2e3cb38159e5983024a3c`.
- Web 이미지: `ghcr.io/feed-mina/kmovement-web@sha256:e5f18e4ad7510cc7f0b04e423ebe616b67fc361a1bad8bda699eaeda94c574ad`.
- F11 릴리스: Spring/CPU/PostgreSQL health, Flyway 122, DB 9025행 보존, CPU 55 tests, PostgreSQL CI 108 tests, 실제 360/390/768/960/1440px 화면 확인.
- F12: guest 401, 내부 빈 후보 200, `usage:null`, 예산 상한 5 USD 설정. Groq 키와 계정 단가가 없어 실제 유료 생성·사용량·추천 마커는 미확인.
- 프로필 수정: 운영 web 이미지와 main CI/web publish 성공, 비로그인 요청 401·로그인 필요 버튼의 LOGIN_PAGE 이동을 390/1440px에서 확인. 사용자는 F7 남은 조치를 해결했다고 알려 왔지만, 새 실 Kakao OAuth·인증 사용자 저장 증거는 이 보고서 작성 시점에 독립 확인하지 못했다.

실제 캡처는 개인정보를 제거한 릴리스 증거 폴더에만 둔다. 정적 테스트·CI·HTTP 200은 고객 계정의 끝단 성공이나 외부 Kakao/Groq 승인 증거로 승격하지 않는다.

## 유지보수 순서

1. F7 해결 상태의 실계정 증거를 기록으로 연결해 운영 검증 표기를 갱신한다.
2. 같은 운영에서 두 사용자로 F8 여섯 행동을 세 종류 모두 반복하고 5개 페이지·빈 목록·비공개 전환을 캡처한다.
3. F12 후보 출처와 확인 시각을 먼저 DB/카탈로그에 준비하고, Groq 보관 경로·계정 단가를 넣은 뒤 모의 공급자 시험을 실행한다. 비용 상한과 동시성·10회/일 예약을 넘으면 즉시 차단한다.
4. 이후 F10, F13, F14, F16을 각각 독립 릴리스로 검증한다. F15는 별도 비용 승인 전까지 비활성 유지한다.

## 근거 파일

- 작업계획: [ME plan](https://github.com/feed-mina/ME/blob/main/01-History/2026-10-04_KMovement_%EC%A0%84%EC%B2%B4_%EC%9E%91%EC%97%85%EC%A7%80%EB%8F%84_%EA%B8%B0%EB%8A%A5%EB%8B%A8%EA%B3%84%EB%B6%84%EB%A6%AC/kmovement-feature-micro-action-plan-20261004.md)
- F11 운영 증거: `work-map-guide/f11-release-20261006-d112/`
- F12 설정·차단 증거: `work-map-guide/f12-live-20261006-091457/`
- 프로필·로그인 수정 증거: `work-map-guide/profile-login-fix-20261006/`
- 적용 스킬 원문: `.codex-work/maintenance-inputs/screen-code-handover/`, `.codex-work/maintenance-inputs/work-map-guide/`

이 문서는 코드·운영 증거에 대한 인수인계 문서이며, 이 보고서 작성으로 코드·DB·운영 설정을 변경하지 않았다.
