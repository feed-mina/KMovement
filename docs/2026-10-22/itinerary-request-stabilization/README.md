# 01 안정화: 코스 생성 요청과 오류 안내

기준 main: `d13f526ecd61e2ef00c2c7c40564d54232e3a892`.

## 변경 내용

- 빠른 코스(RouteScreen)와 온보딩 결과(useKrideItinerary)에 공통 요청 빌더를 적용했다. 기간, 아티스트·지역 이름, 목적, 슬라이더 예산, 응답 언어, 실제 동의값을 동일하게 만든다.
- 예산을 삭제하거나 동의를 자동으로 켜서 서버의 검사를 우회하지 않는다. `acknowledgeUnverifiedConditions`는 실제 boolean `true`일 때만 동의로 인정한다. 서버도 문자열 `"true"`와 숫자 `1`을 동의로 바꾸지 않는다.
- 빠른 코스는 AI 모드 진입·조건 변경만으로 생성하지 않는다. 처음에는 체크하지 않은 동의 안내를 보여주고, 사용자가 직접 동의한 다음 ‘코스 만들기’를 눌러야 요청한다.
- 서울 당일치기 외 조건은 호출 전에 안내한다. 서버의 422 거절도 유지한다. 다른 지역을 서울로 바꾸거나 숙박 일정을 당일로 바꿔 보내지 않는다.
- 요청 캐시에는 언어·동의·예산을 포함한 전체 본문을 사용하고, 유효한 결과를 얻은 뒤에만 캐시한다. 빈 결과는 같은 조건으로 재시도할 수 있다.
- 전달 서버는 동의·예산·언어와 HTTP 상태를 보존한다. 비정상 JSON 응답과 시간 초과를 각각 502·504로 구분한다.

## 오류 종류: 제품의 판정 규칙

아래 표는 지원하는 분류다. 모든 오류가 실제 운영에서 발생했다는 뜻은 아니다.

| 조건 | 상태 / 종류 | 사용자에게 필요한 행동 |
|---|---|---|
| 동의 없음 | 호출 전 차단 / 서버 422 `consent_required` | 안내를 읽고 직접 동의 |
| 서울 당일치기 외 | 호출 전 차단 / 서버 422 `unsupported_conditions` | 지역·기간 변경 |
| 입력 모양·언어 오류 | 400·413·422 / validation | 입력 확인 |
| 로그인 만료 | 401 / login | 로그인 |
| 테스트 계정 제한 | 403 / forbidden | 허용된 계정 확인 |
| 요청·사용량 제한 | 429 / limit | 한도 확인 후 재시도 |
| 추천 서버 응답 이상 | 502 / upstream | 잠시 후 재시도 |
| 서버·자료 준비 중 | 503 / unavailable | 잠시 후 재시도 |
| 요청 중단·시간 초과 | 504 / timeout | 잠시 후 재시도 |
| 연결 실패 / 오프라인 | network / offline | 인터넷 연결 확인 |
| 확인된 후보 없음 | 200 `empty_candidates` / candidates | 자료 준비 안내 |
| 후보는 있으나 코스 없음 | 200 빈 itinerary / no-route | 목적 변경 또는 명시적 재시도 |

## 실제 시험 기록: 2026-10-22

공급자 호출은 모두 가짜 응답으로 대체했다. 유료 AI 호출, 배포, 실제 추천 품질 측정은 하지 않았다.

| 실행 범위 | 결과 | 확인한 내용 |
|---|---|---|
| Jest: 화면·훅·요청 빌더·프록시, 6개 시험 파일 | 56개 통과 | 미동의 차단, 직접 동의 후 본문, 지원 외 조건 차단, 언어·예산 보존, 오류 종류, 빈 결과 재시도 |
| pytest: 서버 입장 전 정책 단위 시험 | 10개 통과 | 미동의·지원 외 조건 422, 엄격한 boolean, 동의 후 처리 입장 |
| 공통 요청 모듈 TypeScript strict 검사 | 오류 0개 | 새 계약 모듈의 정적 타입 검사 |
| pytest: FastAPI HTTP 통합 시험 | 로컬 완료 불가, CI 실행 대상 12개 | 동의 전·후·지원 외 조건, 인증 401·403, 요청 본문 보존 |

HTTP 통합 시험의 로컬 제한: 이 Windows 실행 환경에서 asyncio가 로컬 socketpair를 만드는 중 멈췄다. faulthandler로 `socket.accept → _fallback_socketpair → ProactorEventLoop` 정체를 확인했다. 제품 실패나 통합 시험 통과로 계산하지 않았다. 별도 GitHub Actions `Itinerary request contract / server-contract`가 Linux에서 통합 12개와 정책 단위 10개를 실행한다. 해당 실행의 실제 결론은 PR 검사에서 확인한다.

재실행 명령:

```sh
cd subproject/SDUI/metadata-project
npx jest --runInBand --forceExit --runTestsByPath tests/hooks/itineraryRequestContract.test.ts tests/hooks/krideItineraryError.test.ts tests/hooks/krideItinerarySources.test.ts tests/components/RouteScreen.test.tsx tests/components/KrideFocusScreen.test.tsx tests/integration/itinerary-proxy-contract.test.ts
```

```sh
python -m pytest tests/test_itinerary_request_contract.py tests/test_itinerary_policy_unit.py -q
```

로컬 Jest는 기존 설치된 의존성을 사용했으며, 격리된 작업 폴더를 위해 의존성 검색 경로와 캐시 경로만 바꿨다. 이 실행 도우미는 제품·PR 파일에 포함하지 않는다. 전체 Next.js 빌드, 전체 회귀 시험, 브라우저 실사용, 운영 데이터와의 추천 품질은 이번 로컬 검증 범위에 포함하지 않는다.

## 요청 경로

`RouteScreen / KrideFocusScreen → 공통 요청 빌더·검사 → Next.js itinerary 프록시 → PublicItineraryRequest → 인증·지원 조건·동의 검사 → 생성 처리`.

채팅은 다른 목적의 API이므로 이번 코스 생성 요청과 합치거나 예산 처리 방식을 바꾸지 않았다.
