# G1 Spring 플랫폼 게이트 실행 런북

## 1. 목적과 경계

G1은 사용자 기능 배포가 아니라 Spring Boot, PostgreSQL, Redis, Flyway의
공통 기반을 복구 가능한 상태로 만드는 단계입니다.

- 외부 공개: `GET /api/platform/health` 한 경로만
- 외부 비공개: PostgreSQL, Redis, Spring의 나머지 모든 API
- 제외: 제출/DB 저장 기능 검증, FastAPI, Celery, RunPod, AWS 종료, DNS 변경
- 금지: 운영 검증 중 `docker compose down --volumes`

컨테이너가 실행된 사실만으로 G1 완료라고 기록하지 않습니다. 빈 DB에서의
Flyway 적용, checksum, Redis 인증 PING, health, 재기동, backup/restore 증거가
모두 있어야 합니다.

## 2. 고정해야 할 식별자

배포 기록 하나에 아래 값을 함께 남깁니다.

- `origin/main` 40자리 SHA
- `ghcr.io/feed-mina/kmovement-spring@sha256:...` 이미지
- `deploy/hostinger/g1.compose.yml` config revision
- PostgreSQL·Redis 이미지 digest
- 대상 `srv1869569` / `kmovement.srv1869569.hstgr.cloud`
- rollback Spring image digest

`latest`, 날짜 태그, 짧은 SHA만으로 배포하지 않습니다.

## 3. VPS 비밀값 준비

실제 배포 승인 후 VPS 안에서만 다음 파일을 만듭니다. 파일 값은 터미널,
Git, CI 로그, 배포 보고서에 출력하지 않습니다.

```bash
install -d -m 0700 /docker/kmovement-g1/secrets
umask 077
openssl rand -hex 32 > /docker/kmovement-g1/secrets/db_password
openssl rand -hex 32 > /docker/kmovement-g1/secrets/redis_password
openssl rand -hex 64 > /docker/kmovement-g1/secrets/jwt_secret
chmod 0600 /docker/kmovement-g1/secrets/*
```

배포 환경 파일에는 비밀값 대신 경로와 digest만 둡니다.

```dotenv
KMOVEMENT_SITE_HOST=kmovement.srv1869569.hstgr.cloud
KMOVEMENT_SPRING_IMAGE=ghcr.io/feed-mina/kmovement-spring@sha256:REPLACE_WITH_64_HEX
KMOVEMENT_G1_SECRETS_DIR=/docker/kmovement-g1/secrets
```

## 4. 배포 전 검증

```bash
test "$(hostname)" = "srv1869569"
docker compose \
  --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml \
  config --quiet
```

확인해야 할 값:

- 서비스는 `postgres redis spring` 세 개뿐입니다.
- published port는 하나도 없습니다.
- Spring 이미지는 full digest입니다.
- secrets 파일 권한은 `0600`, 디렉터리는 `0700`입니다.
- 기존 Traefik과 `kmovement-web-web-1` container ID를 기록합니다.

## 5. 순차 기동

PostgreSQL과 Redis를 먼저 기동하고 healthy를 확인한 뒤 Spring을 기동합니다.

```bash
docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml up -d postgres redis

docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml up -d spring
```

Spring health가 실패하면 외부 기능 경로를 추가하지 않습니다. Spring 로그에
비밀값이 없는지 확인한 뒤 이미지 또는 config만 롤백합니다. DB volume은
삭제하지 않습니다.

## 6. 완료 증거

### Flyway와 테이블

```bash
docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml exec -T postgres \
  psql -U kmovement -d kmovement -Atc \
  "select installed_rank, version, description, checksum, success from flyway_schema_history order by installed_rank;"

docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml exec -T postgres \
  psql -U kmovement -d kmovement -Atc \
  "select count(*) from information_schema.tables where table_schema='public';"
```

### Redis와 Spring

```bash
docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml exec -T redis sh -ec \
  'REDISCLI_AUTH="$(cat /run/secrets/redis_password)" redis-cli ping'

curl -fsS https://kmovement.srv1869569.hstgr.cloud/api/platform/health
```

### 재기동

```bash
docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml restart spring
```

재기동 후에도 container health와 외부 health가 모두 `UP`이어야 합니다.

## 7. 백업과 복원 검사

```bash
install -d -m 0700 /docker/kmovement-g1/backups
docker compose --env-file /docker/kmovement-g1/.env \
  -f /docker/kmovement-g1/g1.compose.yml exec -T postgres \
  pg_dump -U kmovement -d kmovement -Fc \
  > /docker/kmovement-g1/backups/g1-platform.dump
chmod 0600 /docker/kmovement-g1/backups/g1-platform.dump
```

백업 파일 생성만으로 복구 가능하다고 판정하지 않습니다. 운영 DB와 분리된
임시 DB에 `pg_restore --exit-on-error`를 실행하고, Flyway 이력·테이블 수가
원본과 같은지 확인한 결과를 배포 기록에 남깁니다.

## 8. 롤백

1. `.env`의 `KMOVEMENT_SPRING_IMAGE`만 이전 digest로 되돌립니다.
2. `docker compose pull spring` 후 `docker compose up -d spring`을 실행합니다.
3. 내부 health와 외부 health를 확인합니다.
4. PostgreSQL·Redis volume은 그대로 보존합니다.

DB migration이 비호환이면 자동 롤백하지 않습니다. 먼저 backup/restore 경로와
하위 버전 앱의 schema 호환성을 확인하고 사용자 승인을 받습니다.
