# KMovement Hostinger web-only runbook

This runbook prepares the first parallel Hostinger slice. It supports two
mutually exclusive edge profiles:

```text
Empty VPS: Internet -> Caddy (80/443) -> Next.js web (internal 3000)
Current VPS: Internet -> existing Traefik (80/443) -> Next.js web (internal 3000)
```

It intentionally does **not** deploy Spring, FastAPI, PostgreSQL, Redis,
Celery, or RunPod. It also does not change production DNS or stop AWS.

The 2026-10-02 read-only preflight found that `feedmina.tech` and host ports
80/443 are already in use. Therefore the supplied VPS must use
`web.traefik.compose.yml` with `kmovement.srv1869569.hstgr.cloud`. Do not run
the standalone Caddy profile on that server. See
`HOSTINGER-TRAEFIK-PREFLIGHT.md` for the confirmed boundary.

## 1. Release identity

Run from a clean checkout immediately before the release build:

```bash
git fetch origin --prune
MAIN_SHA="$(git rev-parse origin/main)"
test "$(git status --porcelain)" = ""
test "$(git rev-parse HEAD)" = "$MAIN_SHA"
printf '%s\n' "$MAIN_SHA"
```

The third command is a hard release gate: build only from a checkout whose
`HEAD` is the fetched `origin/main`. If it fails, switch to or create a clean
release worktree at that exact SHA before building. Do not label a feature-branch
working tree with the main SHA.

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

### Recommended after this PR is merged

Run the manual **Publish Hostinger web image** workflow from `main`. Enter the
freshly fetched 40-character `origin/main` SHA as `expected_main_sha`. The
workflow refuses a stale or feature-branch SHA, builds for `linux/amd64`,
publishes to GHCR, and records the immutable image digest without deploying the
VPS. Copy the full `ghcr.io/feed-mina/kmovement-web@sha256:...` value from the
workflow summary into the deployment record and the VPS environment file.

GHCR packages are not assumed to be anonymously pullable. Before deployment,
either authorize public package visibility separately or log the VPS in with a
read-only package token. Do not copy a developer's broad GitHub credential to
the server.

### Manual equivalent

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

For the existing-Traefik profile, only `KMOVEMENT_SITE_HOST` and
`KMOVEMENT_WEB_IMAGE` are required. The Caddy image and ACME contact values
belong only to the empty-VPS profile.

## 4. Validate before any VPS change

```bash
docker compose \
  --env-file deploy/hostinger/.env.compose.example \
  -f deploy/hostinger/web.compose.yml \
  config
```

Expected services are exactly `proxy` and `web`. Only ports 80 and 443 may be
published. Port 3000 is internal through `expose`. The application image's
Dockerfile runs as user `nextjs`. Both Compose images must use full
`@sha256:<64 hexadecimal characters>` references; tags alone are rejected by
the validation workflow. Verify the built web image before release:

```bash
docker image inspect \
  "ghcr.io/feed-mina/kmovement-web:${MAIN_SHA}" \
  --format '{{.Config.User}} {{index .Config.Labels "org.opencontainers.image.revision"}}'
```

Expected output contains `nextjs` and the exact `MAIN_SHA`.

For the supplied VPS, validate the existing-Traefik profile instead:

```bash
docker compose \
  --env-file deploy/hostinger/traefik.env.example \
  -f deploy/hostinger/web.traefik.compose.yml \
  config
```

Its expected service list is exactly `web`. It must publish no host ports and
must route only the temporary hostname to internal port 3000 through the
already-running Traefik instance.

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

### Supplied VPS with existing Traefik

Keep the real environment file untracked. Copy only the Traefik Compose file
and that environment file into a dedicated KMovement directory, then run:

```bash
docker compose --env-file .env -f web.traefik.compose.yml config
docker compose --env-file .env -f web.traefik.compose.yml pull
docker compose --env-file .env -f web.traefik.compose.yml up -d
docker compose --env-file .env -f web.traefik.compose.yml ps
```

This profile adds only the `kmovement-web` project. It must not stop, recreate,
or rename the existing Traefik and application projects. Confirm the temporary
hostname route and certificate before browser testing.

### Empty VPS with standalone Caddy

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
