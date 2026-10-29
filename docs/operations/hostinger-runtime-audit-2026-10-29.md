# KMovement Hostinger 운영 연결 점검 기록

- 점검일: 2026-10-29 (한국시간)
- 대상 저장소: feed-mina/KMovement
- 점검 당시 main: `1b02263d14a5593fc0d3bc07e1db2ea55830f11c`
- 범위: PR #301·#302 반영, GitHub Actions 실제 배포 기록, 공개 웹·Spring 상태 응답 확인
- 결론: 웹은 최신 main 배포 및 현재 응답 확인. 영상 중계는 배포 당시 검증 성공. 현재 Spring과 중계의 연결 및 기존 작업 조회는 미확인.

이 문서는 이번 점검에서 확인한 사실을 기록한다. 코드에 구현된 검사, 과거 배포 때 통과한 검사, 현재 직접 확인한 응답을 구분한다.

## 1. 서비스별 상태

| 대상 | 배포 근거 | 이번 점검 결과 | 남은 확인 |
|---|---|---|---|
| 웹 | 최신 main의 실제 deploy 작업 성공 | 공개 릴리스 커밋 일치, 주요 페이지 HTTP 200 | 이번 범위의 배포 누락은 발견되지 않음 |
| Spring | 공개 상태 응답 확인. 운영 이미지·커밋은 확인하지 못함 | `/api/platform/health` HTTP 200, `status=UP` | PR #301 코드가 포함된 이미지인지, 영상 주소·내부 인증키·Docker 네트워크 |
| 영상 중계 | 최신 main의 실제 deploy 작업 및 서버 검증 성공 | 10월 26일 배포 당시 healthy·health 200·무인증 요청 401 검사 통과 | 현재 컨테이너 상태, Spring에서 접근 가능 여부, 기존 작업 상태 조회 |

Spring의 상태 응답이 정상이어도 영상 중계 연결까지 정상이라는 뜻은 아니다. 중계의 과거 배포 성공을 현재 연결 완료로 해석하지 않는다.

## 2. 코드 병합과 실제 배포 기록

| 구분 | 한국시간 | 확인 내용 |
|---|---|---|
| PR #301 | 2026-10-26 19:54:12 | main 병합. 병합 커밋 `e94c9813f69657170a72f3f7415f0c9e2e3fecbf` |
| PR #302 | 2026-10-26 20:20:35 | main 병합. 병합 커밋 `1b02263d14a5593fc0d3bc07e1db2ea55830f11c` |
| 웹 배포 | 2026-10-26 20:28:18 | 서버 로그 `Hostinger web: verified` |
| 영상 중계 배포 | 2026-10-26 22:43:46 | 서버 로그 `Hostinger media: verified`. 확인한 로그는 attempt 2 |

워크플로 전체의 success 표시뿐 아니라 deploy 작업과 실제 서버 스크립트의 verified 출력을 확인했다.

- [PR #301](https://github.com/feed-mina/KMovement/pull/301)
- [PR #302](https://github.com/feed-mina/KMovement/pull/302)
- [웹 배포 실행 기록](https://github.com/feed-mina/KMovement/actions/runs/40314769658)
- [영상 중계 배포 실행 기록](https://github.com/feed-mina/KMovement/actions/runs/40314769672)

확인된 이미지 digest:

- 웹: `ghcr.io/feed-mina/kmovement-web@sha256:d5d5676f54ee00f83b4e2359338a255c2c969154df775b32e0797acaf129d24d`
- 영상 중계: `ghcr.io/feed-mina/kmovement-media@sha256:c171652e65f7f33a3dc3d6a93e1c1324d7084c53f877f91c7a05327f86e56014`

위 digest는 배포 로그의 값이다. 현재 서버의 docker inspect 결과를 새로 조회한 값은 아니다.

## 3. 이번에 직접 확인한 공개 응답

기준 주소: https://kmovement.srv1869569.hstgr.cloud

| 경로 | HTTP 응답 | 확인 내용 |
|---|---|---|
| `/health/release` | 200 | `status=ok`, `revision=1b02263d14a5593fc0d3bc07e1db2ea55830f11c` |
| `/api/platform/health` | 200 | `status=UP`, groups에 liveness·readiness 포함 |
| `/` | 200 | HTML 응답 |
| `/view/TOUR_EXPLORE` | 200 | HTML 응답 |
| `/view/ROUTE_PLANNER` | 200 | HTML 응답 |

HTML 응답 확인은 로그인, 코스 생성, 지도 조작, 영상 생성 등 화면의 모든 동작을 검증했다는 뜻은 아니다.

## 4. 영상 중계의 배포 당시 검사와 코드상 보호 장치

검토한 소스는 점검 당시 main 기준이다.

- [중계 배포 워크플로](../../.github/workflows/hostinger-media-deploy.yml)
- [중계 배포 스크립트](../../deploy/hostinger/deploy_media.py)
- [중계 Compose](../../deploy/hostinger/media.compose.yml)
- [Spring 영상 연결 override](../../deploy/hostinger/media-spring.override.yml)

중계 배포 스크립트가 verified로 끝나려면 다음 검사를 통과해야 한다.

1. 배포 이미지의 소스 커밋 및 실제 컨테이너 이미지 일치
2. 컨테이너 health 상태 healthy
3. 컨테이너 내부 `GET /health`의 HTTP 200
4. 인증키 없이 요청한 `GET /jobs/runpod/auth-probe`의 HTTP 401

이 검사는 10월 26일 배포 당시의 근거다. 이번 점검에서 서버 내부로 접속해 다시 실행하지는 못했다.

코드에는 다음 보호 장치가 있다.

- 기존 `/docker/kmovement-media/runtime.env`를 읽어 사용하며 자동으로 키를 만들거나 교체하지 않는다.
- env 파일이 없거나 그룹·다른 사용자에게 권한이 열려 있으면 배포를 거부한다.
- `kmovement-media` 프로젝트의 `media-gateway` 서비스만 `up --no-deps`로 교체한다.
- 공개 포트, host 네트워크 모드, 공개 Traefik 라우터를 허용하지 않는다.
- 중계는 지정된 외부 Docker 네트워크를 사용한다. 기본 네트워크 이름은 `kmovement-g1_egress`다.
- `KRIDE_MODEL_GENERATION_ENABLED=false`를 강제한다. 이것을 RunPod 유료 제출 자체가 차단된다는 뜻으로 해석하지 않는다.
- 배포 검증에서 GPU 생성 요청을 제출하지 않는다.

실제 운영 네트워크 이름과 Spring의 네트워크 참여 여부는 이번에 확인하지 못했다.

## 5. Spring 연결에서 남은 항목

기대 설정은 다음과 같다. 비밀키의 실제 값은 문서나 로그에 남기지 않는다.

| 항목 | 기대 조건 | 현재 확인 수준 |
|---|---|---|
| Spring 이미지 | PR #301 영상 전용 연결 코드 포함 | 미확인 |
| `KRIDE_MEDIA_URL` | 내부 중계 주소. 가이드 예시는 `http://media-gateway:7860` | 운영 실효값 미확인 |
| 내부 인증 | Spring의 `KRIDE_MEDIA_INTERNAL_API_KEY`와 중계의 `FASTAPI_INTERNAL_API_KEY` 일치 | 미확인 |
| Docker 네트워크 | Spring과 중계가 같은 통신 가능한 네트워크에 참여 | 미확인 |
| 기존 코스·채팅 주소 | 기존 실효값 유지 | 미확인 |
| 기존 작업 조회 | 기존 계정·엔드포인트를 유지하며 실제 보관된 작업 번호로 상태 조회 | 미실시 |

영상 전용 설정이 없으면 기존 주소·키로 동작하는 호환 기본값이 있다. 따라서 Spring health 성공만으로 전용 중계 설정 적용을 판단하면 안 된다.

## 6. 이번 작업의 실행 범위와 제약

이번 점검에서는 배포나 서버 설정 변경을 수행하지 않았다. `runtime.env`를 읽거나 수정하지 않았으며, 컨테이너 재시작·인증키 교체·DB 변경·기존 작업 재제출도 하지 않았다.

실제 GPU 영상 생성, RunPod의 `/run`, 중계의 영상 제출 POST 요청은 실행하지 않았다.

현재 실행 환경에는 서버 접속용 SSH 키가 없었다. Hostinger는 이 클라우드 브라우저의 로그인을 제한하므로 서버 관리 화면을 통한 내부 점검도 진행하지 못했다. 이 접근 제약 때문에 현재 컨테이너·실효 환경변수·기존 작업 상태를 확인하지 못했다.

## 7. 접근 가능해진 뒤 이어갈 순서

1. 기존 Spring·중계의 이미지 digest, Compose 파일 목록, env 경로, 네트워크와 상태를 읽기 전용으로 확인한다.
2. `runtime.env`를 그대로 보존하고, 인증키 값은 출력하지 않은 채 설정 유무와 양쪽 일치 여부만 확인한다.
3. Spring의 실제 코스·채팅 주소를 보관하고 영상 전용 주소 및 같은 Docker 네트워크 참여 여부를 확인한다.
4. 중계에서 health와 무인증 요청 거부를 다시 확인한다.
5. 접근 가능한 기존 작업 기록에서 실제 작업 번호를 확인하고 인증된 상태 조회만 수행한다. 시험을 위해 새 작업을 제출하지 않는다.
6. 중계 변경이 필요하면 중계만 교체한다. Spring 이미지·설정 변경이 필요한 경우에는 별도 Spring 배포로 진행하며 기존 코스·채팅 설정과 복구 구성을 보존한다.
7. 웹·Spring·중계의 변경 전후 상태와 기존 작업 조회 결과를 각각 기록한다.

접근이 막힌 상태에서 추정으로 재배포하거나 연결 완료로 표시하지 않는다.

## 관련 운영 가이드

- [웹·영상 중계 독립 배포](hostinger-independent-deploy.md)
- [Hostinger 영상 전용 중계 적용](hostinger-media-relay.md)
