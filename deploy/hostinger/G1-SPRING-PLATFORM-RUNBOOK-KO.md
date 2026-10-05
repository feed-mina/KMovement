# G1 Spring 플랫폼 게이트 실행 런북

## 1. 목적과 경계

G1은 Spring Boot, PostgreSQL, Redis, Flyway의 공통 기반입니다. F2 주소검색에
이어 F4 맛집 공개 조회와 F5 성지 공개 조회의 읽기 경로만 추가 공개합니다.

- 외부 공개: `GET /api/platform/health`, `GET /api/v1/address/search`, 아래 F4/F5 allowlist
  - `GET /api/v1/tour/areas`
  - `GET /api/v1/tour/poi`
  - `GET /api/v1/tour/restaurants`
  - `GET /api/v1/tour/holy`
  - `GET /api/v1/tour/holy/contents`
- 외부 비공개: PostgreSQL, Redis, Spring의 나머지 모든 API와 모든 POST·관리자 경로
- 네트워크: DB·Redis는 `g1` 내부망만 사용하고, Spring만 Kakao Local API 호출용
  `egress` bridge에 추가 연결합니다. 어느 서비스도 host port를 publish하지 않습니다.
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
install -m 0600 /secure/input/kakao_rest_api_key \
  /docker/kmovement-g1/secrets/kakao_rest_api_key
install -m 0600 /secure/input/tour_api_key \
  /docker/kmovement-g1/secrets/tour_api_key
install -m 0400 -o 10001 -g 10001 /docker/kmovement-g1/secrets/db_password \
  /docker/kmovement-g1/secrets/spring_db_password
install -m 0400 -o 10001 -g 10001 /docker/kmovement-g1/secrets/redis_password \
  /docker/kmovement-g1/secrets/spring_redis_password
install -m 0400 -o 10001 -g 10001 /docker/kmovement-g1/secrets/jwt_secret \
  /docker/kmovement-g1/secrets/spring_jwt_secret
install -m 0400 -o 10001 -g 10001 /docker/kmovement-g1/secrets/kakao_rest_api_key \
  /docker/kmovement-g1/secrets/spring_kakao_rest_api_key
install -m 0400 -o 10001 -g 10001 /docker/kmovement-g1/secrets/tour_api_key \
  /docker/kmovement-g1/secrets/spring_tour_api_key
chmod 0600 /docker/kmovement-g1/secrets/db_password \
  /docker/kmovement-g1/secrets/redis_password \
  /docker/kmovement-g1/secrets/jwt_secret \
  /docker/kmovement-g1/secrets/kakao_rest_api_key \
  /docker/kmovement-g1/secrets/tour_api_key
```

Compose의 로컬 file secret은 host 파일의 소유권을 그대로 유지합니다. 그래서
DB·Redis 원본은 root 전용으로 두고, non-root Spring 사용자(UID/GID 10001)가
읽는 복제본만 `10001:10001`, `0400`으로 제한합니다. secret 값을 환경변수나
이미지 레이어에 복사하지 않습니다.

`kakao_rest_api_key`는 GitHub Actions의 `KAKAO_REST_API_KEY` 또는 사용자가
관리하는 비밀 저장소에서 암호화된 경로로 전달합니다. 실제 값은 Kakao Maps가
활성화된 앱의 REST API 키여야 하며, sealing workflow가 실제 Local API 호출을
통과한 키만 암호화합니다. 채팅·로그·Git에 값을 붙여 넣지 않습니다.

GitHub secret을 사용할 때는 VPS에서 일회용 RSA 키를 만들고 공개키만
`deploy/hostinger/f2-recipient-public.pem`에 둡니다. `Seal Hostinger F2 Kakao
secret` workflow가 만드는 암호문은 이 고정 공개키로만 암호화됩니다. 다운로드한
암호문은 VPS에서만 복호화하며, 평문 키는 로컬 PC와 Actions artifact에 남기지 않습니다.
복호화 후 일회용 개인키와 암호문을 삭제하고 최종 secret 파일을 `0600`으로
고정합니다.

TourAPI 키는 `Seal Hostinger F4 TourAPI secret` workflow가 실제 `areaCode2`
호출을 통과한 경우에만 `tour_api_key.enc`로 만듭니다. F4 전용 공개키
`deploy/hostinger/f4-recipient-public.pem`과 VPS root 전용 개인키
`/root/.kmovement-secrets/f4-recipient-private.pem`을 짝으로 사용하며, VPS에서
복호화한 평문은 `spring_tour_api_key`로만 복제합니다.

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
curl -fsS --get --data-urlencode 'keyword=테헤란로 152' \
  https://kmovement.srv1869569.hstgr.cloud/api/v1/address/search
curl -fsS --get --data-urlencode 'areaCode=1' --data-urlencode 'numOfRows=1' \
  https://kmovement.srv1869569.hstgr.cloud/api/v1/tour/restaurants
curl -fsS --get --data-urlencode 'areaCode=1' \
  https://kmovement.srv1869569.hstgr.cloud/api/v1/tour/holy
curl -fsS --get --data-urlencode 'q=방탄소년단' --data-urlencode 'limit=1' \
  https://kmovement.srv1869569.hstgr.cloud/api/v1/tour/holy/contents
```

F2 완료 판정은 위 주소검색 응답이 200이고 `items`에 우편번호와 도로명 주소가
있으며, Android 화면에서 검색 → 결과 선택 → 폼 반영까지 확인된 경우에만 합니다.
F4는 실제 맛집 카드와 다음 페이지가 중복 없이 추가되는지, F5는 승인된 DB 성지만
표시되고 작품 필터 실패가 사용자에게 드러나는지 브라우저에서 별도로 확인합니다.

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
