# Hostinger 영상 전용 중계 적용

이 변경은 A1(영상 접수 창구 분리)이다. 단일 영상과 배치 제출, 작업 상태 조회만 새 주소를 사용한다.
코스·채팅과 개인 사진의 FFmpeg 작업 경로, PostgreSQL·SQLite 데이터는 그대로 유지한다.

| 역할 | 설정 |
|---|---|
| 기존 코스 | 기존 `KRIDE_FASTAPI_URL` 그대로 |
| 기존 채팅 | 기존 `KRIDE_CHATBOT_URL` 그대로 |
| Spring 영상 제출·조회 | `KRIDE_MEDIA_URL=http://media-gateway:7860` |
| 영상 내부 인증 | `KRIDE_MEDIA_INTERNAL_API_KEY`, 중계의 `FASTAPI_INTERNAL_API_KEY`와 동일 |
| 실제 생성 | 기존 RunPod 미디어·Tora 엔드포인트 |

영상 전용 설정을 지정하지 않으면 기존 주소·인증키로 동작한다. 기존 배포와의 호환을 위한 기본값이다.
Hostinger override는 영상 주소와 키가 빠지면 실행을 거부한다. 전용 주소를 지정한 후 연결이 실패하더라도 코스 서버로 자동 재제출하지 않는다.

## 적용 순서

1. 기존 Spring의 Compose 파일 목록·프로젝트 이름·env 파일·이미지 digest와 실효 코스·채팅 주소를 보관한다. 비밀키를 로그나 보고서에 복사하지 않는다.
2. 저장소 루트에서 기존 `deploy/cloud_gateway/Dockerfile`로 가벼운 중계 이미지를 빌드·레지스트리에 올리고 검증한 digest를 고정한다. GPU 모델은 설치하지 않는다.
3. `deploy/hostinger/media.env.example`을 참고해 서버 전용 env 파일을 만든다. 실제 값을 채우고 파일 접근 권한을 제한한다.
4. `KMOVEMENT_MEDIA_NETWORK`는 실제 Spring이 연결된 외부 통신 가능 Docker 네트워크로 지정한다. 기본값은 G1의 `kmovement-g1_egress`다. 중계는 공개 포트와 Traefik 라우터가 없다. Spring이 다른 서버에 있다면 이 Docker 주소에 접근할 수 없으므로, 서버 간 사설망 또는 HTTPS 중계 연결을 먼저 준비해야 한다.
5. 다음처럼 중계만 기동한다. 명령의 env 경로는 운영 파일로 교체한다.

```sh
docker compose --env-file /secure/media.env -f deploy/hostinger/media.compose.yml up -d
docker compose --env-file /secure/media.env -f deploy/hostinger/media.compose.yml ps
```

6. 운영에서 이미 사용하는 Spring Compose 명령에 **마지막 파일로** `-f deploy/hostinger/media-spring.override.yml`을 추가한다. 기존 env 파일과 코스·채팅 override를 그대로 포함한다. 새 영상 변수도 해당 명령에 전달한다. `up -d --no-deps spring`으로 Spring만 재생성한다. 이 변경이 포함된 Spring 이미지를 먼저 준비해야 한다.
7. 모의 제공업체 검증 후 운영에서 기존 작업 번호로 조회를 확인한다. GPU 유료 생성은 다음 A2에서 허용된 시험 입력으로 따로 수행한다.

중계 `/health` 성공은 프로세스가 살아 있다는 뜻이다. RunPod의 작업자 수·모델 준비·영상 생성 성공을 보증하지 않는다.
Tora 단일 요청은 Tora 창구, 배치는 미디어 창구로 간다. 이번 변경은 그 라우팅·대체 정책을 바꾸지 않는다.

## 기존 작업 보존

DB 작업 번호와 결과 URL을 바꾸거나 삭제하지 않는다. 새 중계에서도 기존 RunPod 계정·엔드포인트와 조회 권한을 유지해야 한다.
기존 작업의 창구가 다르면 `RUNPOD_ENDPOINT_ID`에 기존 창구를 남겨 조회 후보에 포함한다.
새 중계가 기존 작업을 조회할 수 있는지 확인하기 전에 이전 중계를 종료하지 않는다. 이전 작업을 새로 제출해서 복구하지 않는다.

## 되돌리기

Spring을 이전 이미지·Compose 파일 목록·env로 되돌린다. 영상 변수만 제거하면 이전 코스 서버가 영상 API도 제공했을 때에만 예전 경로로 돌아갈 수 있다.
복구 후에도 새 중계는 진행 중인 작업을 확인할 때까지 유지하고, DB·사진·완료 영상은 삭제하지 않는다.

## 검증 범위

자동 시험은 내부 인증, 단일·배치 제출, 상태 조회, 미설정·제공업체 실패와 코스·채팅 목적지 보존을 모의 서버로 확인한다.
운영 배포·실제 로그인·GPU 생성·Cloudinary 재생은 별도 운영 확인 항목이다.
