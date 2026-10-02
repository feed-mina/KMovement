# Hostinger existing-Traefik preflight

Checked on 2026-10-02 before making any VPS change.

## Confirmed state

- `feedmina.tech` resolves to the supplied Hostinger VPS.
- HTTPS on `feedmina.tech` is already occupied by a different application and
  currently returns a Basic Authentication challenge.
- The VPS already runs Traefik, and Traefik owns host ports 80 and 443.
- Other Docker workloads are active on the same VPS.
- `kmovement.srv1869569.hstgr.cloud` resolves to the same VPS and is not an
  existing Traefik route in the inspected configuration.
- No KMovement Compose project was running at the time of inspection.

## Decision

Do not start the standalone Caddy profile on this VPS because it would contend
for ports 80 and 443. Use `web.traefik.compose.yml` with the temporary
`kmovement.srv1869569.hstgr.cloud` hostname. This adds one web container and
Traefik labels only; it publishes no host ports and does not stop or replace
any existing container.

## Still gated

- A real digest-pinned web image must exist and be pullable from the VPS.
- The temporary hostname must be allowed in Kakao Developers for the JavaScript
  key used by the build.
- Applying the Compose project to the VPS needs a separate deployment approval.
- `feedmina.tech` routing, AWS shutdown, DNS changes, and production data remain
  outside this step.
