# F12/F13 CPU release preparation — 2026-10-06

The web chat now calls `/api/kride/chat/stream`. Its server handler verifies the
session with Spring `/api/auth/me`, discards submitted identities, and forwards
only the question and trusted service headers to `/api/public/chat/stream`.
The CPU app exposes this new authenticated route; the unrestricted legacy chat
route remains excluded from this deployment.

F12 and F13 share the existing persistent SQLite reservation ledger, the daily
per-user limit of 10 attempts, and two admission slots in one CPU worker.
Cancellation closes the asynchronous provider stream/client. A missing final
usage record leaves its reservation intact. Provider retries are disabled.
The output cap is 2048 completion tokens, including reasoning tokens where supported.

## Required configuration before activation

- `GROQ_API_KEY`: securely registered in the CPU Compose environment; never in Git.
- `KRIDE_INTERNAL_TOKEN`: existing matching web/CPU service token.
- `KRIDE_AI_MODEL`: account-accessible model verified for JSON and streaming.
- `ITINERARY_INPUT_USD_PER_M` / `ITINERARY_OUTPUT_USD_PER_M`: prices for that exact model.
- `ITINERARY_DAILY_USD`: user-approved combined cap; keep the existing budget volume.
- `KRIDE_AI_TEST_USERS`: comma-separated server-confirmed numeric test user IDs.
  Empty means deny all; it never means public access.

The pilot itinerary endpoint accepts only `regions: ["서울"]` and `duration:
"당일치기"`. Candidate preparation is in
`docs/2026-10-06/f12-seoul-candidates.json`. It is not an import file and no
production catalog rows were changed. Each candidate must pass source/map
comparison and approval before explicit indexing. Do not attach unsupported
artist associations.

## Model evidence

The [official model list](https://console.groq.com/docs/models), checked on
2026-10-06, lists the former fixed Llama model as Enterprise / Contact Sales.
Account eligibility is unverified. GPT-OSS 120B is an evaluation candidate with
public input/output rates of USD 0.15/0.60 per million tokens. It is not selected
or tested against a real account in this change. Both routes now require explicit
model configuration instead of silently assuming model access.

## Release gates

1. Verify key, exact model access, price pair and authenticated test identity.
2. Verify candidate sources and marker locations; read back approved catalog and index.
3. Run the CPU workflow tests and web route/hook tests; publish digest-pinned images.
4. Back up configuration and previous image references; retain data volumes.
5. Apply only the Hostinger CPU and web services with the agreed pilot limits.
6. Log in normally and measure first visible answer, completion, stop, retry,
   session rejection, quota rejection and itinerary/marker/source consistency.
7. On failure disable the new feature or restore prior image/config references;
   never delete the budget or catalog volume to reset limits.

`main` pushes affecting application code also trigger `deploy-ec2.yml`.
Do not merge this preparation branch as an implicit Hostinger-only deployment.
Resolve that release scope before merging. No workflow dispatch, image release,
paid request, environment mutation or live acceptance test was performed here.

## Local evidence

- CPU workflow suite: 75 passed, synthetic provider fixtures only.
- Web route/hook suite: 17 passed, including trusted identity and cancellation.
- TypeScript source check: passed with existing source-only configuration,
  excluding stale generated `.next` route types.
- Spring KrideChat suite: Gradle reports BUILD SUCCESSFUL using unchanged cached results.
- Key-entry helper: syntax and fixture-only preservation/overwrite checks passed;
  real key entry and server write remain unexecuted.

These checks do not establish live latency, actual provider billing or production readiness.
