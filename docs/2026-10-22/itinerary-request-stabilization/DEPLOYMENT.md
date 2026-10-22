# 코스 요청 안정화 배포 및 실제 시험

2026-10-22, PR [#288](https://github.com/feed-mina/KMovement/pull/288)을 main에 병합한 `e3e35f222bfa6e31038791832fe223302439ddc9`를 Hostinger 운영 웹과 CPU 생성 서버에 배포했다.

- 서비스: https://kmovement.srv1869569.hstgr.cloud/view/ROUTE_PLANNER
- 웹 이미지: `ghcr.io/feed-mina/kmovement-web@sha256:d5630fcd082b167dba87195efb8882394b41fca5c6289c9d1b73db31a8488c10`
- 서버 이미지: `ghcr.io/feed-mina/kmovement-cpu@sha256:11d1ef9a07db443d161f74d172851a5709f4da25581c8f9723a0485320348b81`
- [웹 빌드 성공](https://github.com/feed-mina/KMovement/actions/runs/39766681166)
- [CPU 빌드·회귀 시험·게시 성공](https://github.com/feed-mina/KMovement/actions/runs/39766745932): 121 passed, 10 subtests passed.
- 두 컨테이너의 revision이 위 SHA와 일치하며 health 상태는 healthy였다. 기존 환경변수와 새 compose 환경변수를 비교해 일치한 경우에만 교체했다. Spring·Postgres·Redis 및 데이터 볼륨은 교체하지 않았다. 이전 이미지·환경 파일 경로는 각 서비스의 release deployment.json에 보존했다. 교체 실패 시 이전 환경으로 복구하는 절차를 준비했으며 이번 실행에서는 복구가 필요하지 않았다.

## 오류 규칙과 실제 결과를 구분

오류 분류표와 자동 시험 범위는 [README](README.md)에 있다. 분류표의 모든 오류가 운영에서 재현됐다는 뜻은 아니다.

### 실제 운영 서버 HTTP 시험

배포된 CPU 컨테이너에서 운영 중인 FastAPI의 `127.0.0.1:8000/api/public/itinerary`로 HTTP 요청했다. 기존에 허용된 시험 계정을 사용했으며 인증값과 계정 ID는 기록하지 않았다. 운영 인증·동시 처리·사용량 제한을 우회하거나 변경하지 않았다. 동의 후 요청은 한 번만 실행했고 자동 재시도하지 않았다. 모의 생성 함수로 바꾸지 않았다.

공통 조건: 서울, 당일치기, 아티스트 미선택, 문화체험, 예산 30,000~2,000,000원, 한국어. 서버가 받은 명시적 boolean 동의값으로 판정했다. 이 요청은 기술 검증용이며 사용자 브라우저의 동의 상태를 변경하지 않았다.

| 시험 | 실제 상태 | 실제 응답 | 시간 |
|---|---|---|---|
| 동의 false | 422 | consent_required, 생성 전 거절 | 0.06초 |
| 동의 true, 부산 | 422 | unsupported_conditions, 생성 전 거절 | 0.01초 |
| 동의 true, 서울 당일치기 | 200 | status=ok, 1일 코스 | 2.29초 |

이 1회의 성공은 추천 내용의 정확성·팬덤 관계·예산 충족·모든 언어의 품질 검증을 뜻하지 않는다.

### 공개 주소 점검

- 코스 화면: 리다이렉트 추적 후 HTTP 200, 최종 경로 `/view/ROUTE_PLANNER`.
- 비로그인 itinerary 프록시 POST: HTTP 401. 인증 없는 호출을 생성 서버로 통과시키지 않는 결과다.

### 자동 시험과 브라우저 확인의 경계

- 앞선 요청 계약 시험: 화면·훅·프록시 Jest 56개, 서버 정책 및 HTTP 통합 22개 통과. PR CI의 전체 프론트엔드 시험과 Next.js 빌드도 성공.
- 이번 게시 이미지의 서버 회귀 시험: 121개 및 subtests 10개 통과.
- 운영 브라우저의 실제 클릭·체크박스·저장·재열람 확인은 미완료. Chrome이 다른 확장 프로그램 UI가 열려 있다는 이유로 해당 페이지 자동 조작을 차단했다. 화면 자동 시험과 운영 서버 HTTP 시험으로 확인한 범위를 실제 브라우저 전체 흐름 완료로 계산하지 않는다.
- 따라서 로드맵 01 단계 전체(생성→설명→저장→재열람)의 완료 상태를 변경하지 않았다. 이번 배포 범위는 요청값·명시적 동의·오류 안내 안정화다.
