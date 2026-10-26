# 기존 웹과 영상 중계의 자동 배포를 분리하기

## 무엇이 자동으로 실행되는가

main에 병합하면 GitHub Actions가 자동 검사(CI, Continuous Integration)를 먼저 수행한다.
검사가 성공하면 그 push 전체의 변경 목록으로 배포 대상을 고른다. 선택된 작업만 이미지 빌드와
SSH(Secure Shell, 암호화된 원격 접속)를 거쳐 해당 Hostinger 컨테이너를 교체한다.

| 바뀐 파일 | 기존 웹 배포 | 영상 중계 배포 | 기타 |
|---|---|---|---|
| Next.js 앱 `subproject/SDUI/metadata-project/**` | 실행 | 건너뜀 | 영상 화면도 현재 이 앱 안에 있음 |
| 중계 `deploy/cloud_gateway/**` | 건너뜀 | 실행 | GPU 모델을 이미지에 넣지 않음 |
| `deploy/hostinger/media.compose.yml`, `deploy_media.py` | 건너뜀 | 실행 | `media-gateway`만 교체 |
| 웹 배포 설정·웹 배포 스크립트 | 실행 | 건너뜀 | 기존 웹만 교체 |
| 위 두 종류가 함께 변경됨 | 실행 | 실행 | 서로 다른 작업·이미지·잠금·프로젝트 |
| 문서·시험 코드만 변경됨 | 건너뜀 | 건너뜀 | 자동 검사는 실행 |
| Spring 코드·`media-spring.override.yml` | 건너뜀 | 건너뜀 | 공유 API이므로 별도 Spring 릴리스 필요 |
| GPU 모델·`deploy/media_motion/**` | 건너뜀 | 건너뜀 | RunPod 작업자 배포는 명시적으로 별도 수행 |
| 개인 영상 `deploy/photo_video/**` | 건너뜀 | 건너뜀 | 개인 API·FFmpeg 작업자도 별도 릴리스 |

`ci.yml`의 deployment-plan 작업은 push 이전·이후 커밋 전체를 비교한다. 여러 커밋을 한 번에 올린 경우와
삭제·이동된 파일도 포함한다. 파일 목록이나 계획이 없으면 전부 배포하는 대체 처리를 하지 않고 실패로 알린다.

배포 화면에서 workflow_run 작업이 보이더라도 **deploy 작업이 skipped이면 SSH·이미지 빌드·컨테이너 교체는 실행되지 않은 것**이다.
검증용 작업 자체는 공통 CI 뒤에 나타날 수 있다.

## 영상 중계가 떠 있는 것과 영상 생성은 다르다

중계는 사용자의 요청을 받아 RunPod로 전달하는 가벼운 CPU 서버다. 배포만으로 영상 생성이 시작되지 않는다.

- 미디어 배포는 Docker Compose의 `kmovement-media` 프로젝트에서 `media-gateway` 서비스만 지정한다.
- `up --no-deps`로 기존 웹·Spring·CPU 코스 서버·개인영상 작업자를 함께 재시작하지 않는다.
- RunPod 작업자 이미지를 빌드하거나 배포하지 않고, GPU 작업자 수를 변경하지 않는다.
- 배포 확인은 `GET /health`와 인증키 없는 `GET /jobs/runpod/auth-probe`의 401 확인뿐이다.
- `POST /jobs/runpod`, `POST /jobs/runpod/batch`, RunPod의 `/run`을 호출하지 않는다.
- `KRIDE_MODEL_GENERATION_ENABLED=false`를 강제하고 공개 포트·Traefik 라우터를 허용하지 않는다.

실제 생성은 사용자가 로그인·소유권 확인 등을 통과해 영상 생성 요청을 제출했을 때 별도로 이루어진다.
이 자동화는 기존 생성 기능의 공개 여부·동의 정책·이용 한도를 변경하지 않는다.

## 현재 구조에서 완전히 분리되지 않은 부분

영상 화면은 기존 Next.js 앱에 있고 영상 제출 API 일부는 기존 Spring 앱에 있다.
따라서 **영상 화면 자체를 수정하면 같은 웹 앱을 새로 배포해야 한다.**
Spring 영상 서비스를 수정하면 공유 Spring 이미지의 별도 배포가 필요하다.
파일 이름에 ‘video’가 있다는 이유만으로 필요한 웹 빌드를 숨기면 수정이 운영에 반영되지 않는다.

이번 작업은 독립 컨테이너인 **영상 중계와 기존 웹의 교차 배포를 막는 자동화**다.
영상 화면·Spring API까지 재시작을 완전히 분리하려면 별도 앱·서비스로 나누는 후속 설계가 필요하다.
Spring을 영상 중계 배포에 끼워 넣어 자동 재시작하는 방식은 사용하지 않는다.

## 최초 한 번 준비할 값

기존 웹 자동 배포와 같은 GitHub Environment `hostinger-production`을 사용한다.
이미 등록된 `HOSTINGER_SSH_PRIVATE_KEY`, `HOSTINGER_SSH_KNOWN_HOSTS`와
`HOSTINGER_SSH_HOST/PORT/USER` 설정을 그대로 사용한다. 매번 브라우저에서 SSH를 누를 필요는 없다.
서버 호스트키 확인을 생략하거나 runner에서 새 키를 무조건 신뢰하지 않는다.
Environment에 승인 규칙이 있다면 그 규칙은 유지된다.

Hostinger에는 **서버 전용** `/docker/kmovement-media/runtime.env` 파일이 먼저 있어야 한다.
`deploy/hostinger/media.env.example`을 참고해 실제 RunPod 키·엔드포인트·내부 인증키·Docker 네트워크를 넣고,
소유자만 읽도록 권한을 0600으로 설정한다. GitHub나 브라우저 공개 변수에 올리지 않는다.
워크플로는 키를 새로 만들거나 기존 운영 키를 임의로 교체하지 않는다. 이 파일이 없으면
운영 컨테이너를 변경하지 않고 준비가 필요하다고 알린다.

처음 Spring에 영상 중계 주소·인증키를 연결하는 작업은 PR #301의
[영상 중계 적용 가이드](hostinger-media-relay.md)를 따른다. 이 최초 연결은 별도 Spring 배포이며,
이후 중계만 바꾸는 배포에서는 Spring을 재시작하지 않는다.
Spring과 중계의 내부 인증키는 일치해야 한다.

레지스트리의 중계 이미지에 Hostinger가 접근할 수 있어야 하고, 지정한 외부 Docker 네트워크가 있어야 한다.
환경에 따라 서버의 레지스트리 로그인 또는 패키지 읽기 권한을 미리 준비해야 한다.

## 실패·복구·수동 재시도

배포는 이미지 digest와 소스 커밋을 확인하고, 서버에서 현재 main인지 다시 확인한 뒤 교체한다.
다른 main이 더 먼저 도착하면 오래된 배포는 적용하지 않는다.
**배포 계획은 push 단위**이므로 연속 병합으로 이전 작업이 superseded되거나 배포가 실패했다면,
필요한 서비스의 workflow를 현재 main에서 수동 실행해 누락된 배포를 완료한다.
무관한 다음 커밋에서 실패했던 다른 서비스까지 자동 재배포하지 않는다.

- 기존 웹 수동 재시도: Actions → Auto deploy Hostinger web → Run workflow(main).
- 중계 수동 재시도: Actions → Auto deploy Hostinger media relay → Run workflow(main).
- 수동 실행도 해당 서비스만 선택하며 성공한 main CI·SSH 검증을 통과해야 한다.
- 중계 교체·상태 검사 실패: 보관한 이전 Compose·이미지로 중계만 복구하고 다시 확인한다.
- 첫 설치 실패: 이전 중계가 없으므로 실패한 중계만 중지한다.
- 복구 실패: `rollback_failed`로 남기며 성공으로 표시하지 않는다.

릴리스 기록은 `/docker/kmovement-media/releases`에 비공개로 남긴다. DB·사진·완료 영상은 삭제하지 않는다.
새 배포의 Compose 파일이나 env 파일을 임의로 지우면 이후 재배포·복구가 막힐 수 있으므로 보관한다.

## 검증과 실제 운영의 구분

회귀 시험은 웹 전용·중계 전용·혼합·문서·삭제 파일·잘못된 계획을 구별하고,
모의 Docker로 중계 단독 교체·상태 실패·이전 이미지 복구·첫 설치 실패를 검증한다.
실제 SSH와 Hostinger 배포는 main 병합 후 선택된 workflow에서 별도로 확인해야 한다.
GPU 생성이나 운영 DB 시험은 이 자동화 검증에 포함되지 않는다.
