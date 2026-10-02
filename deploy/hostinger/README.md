# KMovement Hostinger web-only runbook

This runbook prepares the first parallel Hostinger slice:

```text
Internet -> Caddy (80/443) -> Next.js web (internal 3000)
```

It intentionally does **not** deploy Spring, FastAPI, PostgreSQL, Redis,
Celery, or RunPod. It also does not change production DNS or stop AWS.

## 1. Release identity

Run from a clean checkout immediately before the release build:

```bash
git fetch origin --prune
MAIN_SHA="$(git rev-parse origin/main)"
test "$(git status --porcelain)" = ""
printf '%s\n' "$MAIN_SHA"
```

The date is not the release identity. Record these values together in a copy
of `release-record.example.yml` kept outside the repository if it contains a
real VM identifier:

- `gitSha`
- digest-pinned `image`
- `configRevision`
- Hostinger target/project/temporary hostname
- digest-pinned rollback image

## 2. Build and publish the web image

Use the exact `origin/main` checkout. The disabled backend hostnames satisfy
the current production-build contract without bringing Spring or FastAPI into
this slice. Do not use `/api` or `/kride-api` as success evidence.

```bash
docker buildx build \
  --pull \
  --platform linux/amd64 \
  --label "org.opencontainers.image.revision=${MAIN_SHA}" \
  --build-arg "NEXT_PUBLIC_SITE_URL=https://${TEMP_HOSTNAME}" \
  --build-arg "NEXT_PUBLIC_BACKEND_URL=http://disabled-spring:8080" \
  --build-arg "FASTAPI_URL=http://disabled-fastapi:8000" \
  --build-arg "NEXT_PUBLIC_KAKAO_MAP_APP_KEY=${NEXT_PUBLIC_KAKAO_MAP_APP_KEY}" \
  --tag "ghcr.io/feed-mina/kmovement-web:${MAIN_SHA}" \
  --push \
  subproject/SDUI/metadata-project
```

Resolve the registry digest after the push and use the digest, not the tag, in
the Hostinger environment file:

```bash
docker buildx imagetools inspect \
  "ghcr.io/feed-mina/kmovement-web:${MAIN_SHA}"
```

Also resolve and record the selected Caddy tag's current digest. Never deploy
the all-zero validation digest from `.env.compose.example`.

## 3. Required values

### Build-time public values

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`

The Kakao JavaScript key is browser-visible by design. Restrict the temporary
hostname in Kakao Developers before testing. Keep the Google map and Firebase
values outside this first-feature scope unless they are explicitly required.

### Compose-time values

- `KMOVEMENT_SITE_HOST`
- `KMOVEMENT_WEB_IMAGE` — full `@sha256:` reference
- `CADDY_IMAGE` — full `@sha256:` reference
- `ACME_CONTACT_EMAIL`

Store real values on the VPS or in Hostinger/GitHub secret storage. Do not
commit them.

## 4. Validate before any VPS change

```bash
docker compose \
  --env-file deploy/hostinger/.env.compose.example \
  -f deploy/hostinger/web.compose.yml \
  config
```

Expected services are exactly `proxy` and `web`. Only ports 80 and 443 may be
published. Port 3000 is internal through `expose`. The application image's
Dockerfile runs as user `nextjs`; verify the built image before release:

```bash
docker image inspect \
  "ghcr.io/feed-mina/kmovement-web:${MAIN_SHA}" \
  --format '{{.Config.User}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
```

Expected output contains `nextjs` and the exact `MAIN_SHA`.

## 5. Hostinger preparation

1. Use a Hostinger VPS with Docker/Compose available.
2. Add an SSH key for the deploy operator; do not use password automation.
3. Allow inbound 80 and 443. Restrict SSH to the operator source when
   practical. Do not expose 3000.
4. Create a temporary A record pointing to the VPS. Do not change production
   DNS.
5. Add the temporary hostname to the Kakao JavaScript-key domain allowlist.
6. Create a VPS snapshot as a temporary checkpoint. This does not replace an
   application-level rollback record.

## 6. Deploy only after explicit approval

Place `web.compose.yml`, `Caddyfile`, and a real untracked `.env` together on
the VPS, then validate and apply:

```bash
docker compose --env-file .env -f web.compose.yml config
docker compose --env-file .env -f web.compose.yml pull
docker compose --env-file .env -f web.compose.yml up -d
docker compose --env-file .env -f web.compose.yml ps
```

The `proxy` service waits for the web health check. Caddy obtains TLS for the
temporary hostname and is the only public entry point.

## 7. First-feature verification

Automated probes:

```bash
curl -fsS "https://${TEMP_HOSTNAME}/" > /dev/null
curl -fsS "https://${TEMP_HOSTNAME}/holy/submit" > /dev/null
```

Browser evidence:

1. Open `/holy/submit` on desktop and a mobile viewport.
2. Click `주소 검색` and select a real road address.
3. Confirm the selected address text changes.
4. Confirm latitude/longitude change from the initial Seoul values.
5. Confirm the Kakao marker moves to the selected location.
6. Capture console and network evidence without recording keys or cookies.
7. Do not submit the form or test database persistence.

Because Spring is deliberately absent, `AuthContext` may attempt
`/api/auth/me`, fall back to guest, and finish loading. Record that request as
an expected out-of-scope backend failure; the page must still leave its loading
state and the address/map flow must work. Calls to other `/api` or
`/kride-api` paths do not count as successful verification.

## 8. Rollback

Set `KMOVEMENT_WEB_IMAGE` to the recorded rollback digest and reapply the same
Compose project:

```bash
docker compose --env-file .env -f web.compose.yml pull web
docker compose --env-file .env -f web.compose.yml up -d web
docker compose --env-file .env -f web.compose.yml ps
```

If the proxy/TLS layer is the failure, stop the Hostinger project and keep the
temporary DNS isolated. This slice never authorizes production DNS changes,
AWS shutdown, data deletion, or RunPod use.
