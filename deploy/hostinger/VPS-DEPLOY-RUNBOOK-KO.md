# KMovement Hostinger VPS 실배포 복사 실행 런북

> 작성 기준: 2026-10-02, `origin/main` 병합 커밋
> `a51c52f4d4c34f4ffa36feed2363b7153a1c8fc1`

이 문서는 기존 `feedmina.tech` 서비스를 중단하지 않고, Hostinger VPS의
기존 Traefik에 KMovement 웹 컨테이너 한 개만 추가하는 절차입니다.

## 이번 배포의 고정값

| 항목 | 값 |
|---|---|
| VPS | `root@187.127.214.171` |
| 임시 HTTPS 주소 | `https://kmovement.srv1869569.hstgr.cloud` |
| Git SHA | `a51c52f4d4c34f4ffa36feed2363b7153a1c8fc1` |
| 이미지 | `ghcr.io/feed-mina/kmovement-web@sha256:5195aa97b87f480089faf2c95ea1232d63b65a3efa0fc345c2e687077bbb1007` |
| Compose 프로젝트 | `kmovement-web` |
| VPS 작업 폴더 | `/docker/kmovement-web` |

이미지는 공개 pull 가능, `linux/amd64`, 실행 사용자 `nextjs`, OCI revision
라벨은 위 Git SHA와 일치하는 것으로 확인했습니다.

## 실행 전 사용자 확인 1개

Kakao Developers의 JavaScript 키 사이트 도메인에 아래 주소를 등록합니다.

```text
https://kmovement.srv1869569.hstgr.cloud
```

등록하지 않아도 컨테이너 배포는 가능하지만, 주소 선택 후 지도·마커
검증은 실패할 수 있습니다.

## 1. Windows Git Bash에서 VPS 접속

아래 한 줄을 로컬 PC에서 실행합니다.

```bash
ssh root@187.127.214.171
```

이후 명령은 프롬프트의 호스트가 `srv1869569`인지 확인한 뒤 VPS 안에서
실행합니다.

## 2. VPS 대상과 기존 서비스 확인 — 변경 없음

아래 블록 전체를 복사해 실행합니다.

```bash
set -eu

test "$(hostname)" = "srv1869569"
docker compose version
docker compose ls --all
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
ss -ltn '( sport = :80 or sport = :443 )'
getent hosts kmovement.srv1869569.hstgr.cloud
```

통과 기준:

- 호스트 이름이 `srv1869569`입니다.
- 기존 `traefik-y1qz` 프로젝트가 실행 중입니다.
- 80/443은 기존 Traefik이 사용 중입니다.
- 임시 호스트가 이 VPS의 IPv4 또는 IPv6로 해석됩니다.

`feedmina.tech`의 기존 서비스나 컨테이너를 중지하지 않습니다.

## 3. 이번 릴리스 변수 설정

같은 SSH 세션에서 아래 블록 전체를 복사합니다.

```bash
set -eu

KM_RELEASE_SHA='a51c52f4d4c34f4ffa36feed2363b7153a1c8fc1'
KM_IMAGE='ghcr.io/feed-mina/kmovement-web@sha256:5195aa97b87f480089faf2c95ea1232d63b65a3efa0fc345c2e687077bbb1007'
KM_HOST='kmovement.srv1869569.hstgr.cloud'
KM_DIR='/docker/kmovement-web'
KM_RELEASE_DIR="${KM_DIR}/releases/${KM_RELEASE_SHA}"
KM_COMPOSE="${KM_RELEASE_DIR}/web.traefik.compose.yml"
KM_ENV="${KM_DIR}/.env"

printf 'release=%s\nimage=%s\nhost=%s\ndir=%s\n' \
  "$KM_RELEASE_SHA" "$KM_IMAGE" "$KM_HOST" "$KM_DIR"
```

변수를 잃었다면 다음 단계로 넘어가기 전에 이 블록을 다시 실행합니다.

## 4. 배포 파일 준비 — 여기부터 VPS 변경

아래 명령은 KMovement 전용 폴더만 생성하고, 정확한 Git SHA에서 Compose
파일을 내려받습니다.

```bash
set -eu

test "$KM_DIR" = '/docker/kmovement-web'
install -d -m 0750 "$KM_RELEASE_DIR"

curl -fsSLo "$KM_COMPOSE" \
  "https://raw.githubusercontent.com/feed-mina/KMovement/${KM_RELEASE_SHA}/deploy/hostinger/web.traefik.compose.yml"

umask 077
cat > "$KM_ENV" <<EOF
KMOVEMENT_SITE_HOST=${KM_HOST}
KMOVEMENT_WEB_IMAGE=${KM_IMAGE}
EOF

chmod 0600 "$KM_ENV"
docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}' \
  > "${KM_RELEASE_DIR}/docker-ps.before.txt"
```

## 5. Compose 사전 검증 — 아직 컨테이너 미실행

```bash
set -eu

docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" config --quiet
test "$(docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" config --services)" = 'web'

docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" config
```

마지막 출력에서 확인할 내용:

- 서비스가 `web` 하나뿐입니다.
- `ports:`가 없고 `expose: 3000`만 있습니다.
- 라우터 Host는 `kmovement.srv1869569.hstgr.cloud`입니다.
- entrypoint는 `websecure`, certresolver는 `letsencrypt`입니다.

## 6. 이미지 pull과 불변성 확인

```bash
set -eu

docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" pull

docker image inspect "$KM_IMAGE" \
  --format 'user={{.Config.User}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
```

예상 결과:

```text
user=nextjs revision=a51c52f4d4c34f4ffa36feed2363b7153a1c8fc1
```

다른 값이면 `up -d`를 실행하지 말고 중단합니다.

## 7. KMovement 웹 컨테이너만 실행

```bash
set -eu

docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" up -d
docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" ps

KM_CONTAINER_ID="$(docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" ps -q web)"
test -n "$KM_CONTAINER_ID"

for KM_TRY in $(seq 1 18); do
  KM_HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$KM_CONTAINER_ID")"
  printf 'health attempt %s: %s\n' "$KM_TRY" "$KM_HEALTH"
  if [ "$KM_HEALTH" = 'healthy' ]; then
    break
  fi
  sleep 5
done

test "$KM_HEALTH" = 'healthy'
```

실패하면 다음 명령으로 KMovement 로그만 확인합니다.

```bash
docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" logs --tail=200 web
```

## 8. HTTPS 자동 확인

인증서 발급 직후에는 수십 초가 걸릴 수 있습니다.

```bash
set -eu

curl -fsS --retry 12 --retry-delay 5 --retry-all-errors \
  -o /dev/null -w 'home status=%{http_code}\n' \
  "https://${KM_HOST}/"

curl -fsS --retry 12 --retry-delay 5 --retry-all-errors \
  -o /dev/null -w 'holy-submit status=%{http_code}\n' \
  "https://${KM_HOST}/holy/submit"

docker ps --format '{{.Names}}|{{.Status}}|{{.Ports}}|{{.Image}}' \
  > "${KM_RELEASE_DIR}/docker-ps.after.txt"
```

두 결과 모두 `status=200`이어야 합니다.

404이면 Traefik Host 라벨을, 502이면 웹 컨테이너 health와 로그를 먼저
확인합니다.

```bash
docker logs --tail=200 traefik-y1qz-traefik-1
docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" logs --tail=200 web
```

## 9. 브라우저에서 첫 기능 확인

아래 주소를 데스크톱과 모바일 폭으로 엽니다.

```text
https://kmovement.srv1869569.hstgr.cloud/holy/submit
```

확인 순서:

1. 페이지가 로딩 상태를 벗어나는지 확인합니다.
2. `주소 검색`을 눌러 실제 도로명 주소를 선택합니다.
3. 선택된 주소 문자열이 바뀌는지 확인합니다.
4. 위도·경도가 초기 서울 값에서 바뀌는지 확인합니다.
5. Kakao 지도 마커가 선택 위치로 이동하는지 확인합니다.
6. 모바일 폭에서도 검색창·지도·버튼이 잘리지 않는지 확인합니다.
7. 개발자 도구 Console과 Network 증거를 저장하되 키·쿠키는 가립니다.

이번 기능에서는 제출 버튼을 누르지 않습니다. Spring과 DB 저장은 배포하지
않았으므로 제출 성공은 검증 범위가 아닙니다. `/api/auth/me`의 백엔드 실패
후 guest로 전환되는 요청은 현재 web-only 범위에서 예상될 수 있습니다.

## 10. 최초 배포 롤백

이번 배포 전에는 Hostinger에 KMovement 이미지가 없으므로 이전 image
digest가 없습니다. 최초 롤백은 새 프로젝트를 내리는 것입니다. 기존
Traefik과 다른 프로젝트에는 영향을 주지 않습니다.

```bash
set -eu

test "$KM_DIR" = '/docker/kmovement-web'
docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" down
docker compose ls --all
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'
```

`docker system prune`, 다른 프로젝트의 `docker compose down`, Traefik 중지,
볼륨 삭제는 실행하지 않습니다.

## 11. 재접속 후 상태 확인

SSH가 끊긴 뒤 다시 확인할 때는 변수 블록을 다시 실행하고 아래를 사용합니다.

```bash
docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" ps
docker compose --env-file "$KM_ENV" -f "$KM_COMPOSE" logs --tail=100 web
curl -fsS -o /dev/null -w 'status=%{http_code}\n' "https://${KM_HOST}/holy/submit"
```

## 완료와 미완료를 구분하는 기준

- Compose `up -d`만 성공: **컨테이너 실행**
- HTTPS 두 경로 200: **웹 라우팅 확인**
- 실제 주소 선택·좌표·마커 변화: **첫 기능 확인**
- 제출·DB 저장: **이번 범위 밖**
- `feedmina.tech` 전환과 AWS 종료: **별도 승인 전 미실행**
