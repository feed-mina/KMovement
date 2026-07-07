# Integration Regression Checklist

Scope: Google Calendar, KakaoTalk, and Slack integrations used by goal reminders and admin/ops notifications.

## Common Preflight

- Confirm the backend is running with the target profile and can read the expected `.env` or deployment secrets.
- Confirm server time zone is KST or that all target-time conversions explicitly use `Asia/Seoul`.
- Confirm auth cookies/JWT refresh work before testing integration endpoints that require authentication.
- Capture backend logs during the test window and keep request IDs, user IDs, goal IDs, and provider response codes.

## Google Calendar

- Env:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- OAuth encoding:
  - `/api/google/auth-url` returns a URL with encoded `redirect_uri`, `scope`, `access_type=offline`, and `state`.
  - Callback accepts `code` and `state` and resolves the authenticated user.
  - Redirect URI exactly matches the Google Cloud console entry for local, staging, and production.
- Token handling:
  - `google_oauth_tokens` row is created after first consent.
  - Refresh token is retained when Google does not return a new one.
  - Expired access tokens refresh before Calendar calls.
- Event lifecycle:
  - Saving a new goal creates a Calendar event when the user is connected.
  - Failed Calendar creation does not fail goal saving.
  - Arrival success/failure updates the event status or summary when an event ID exists.
- Logs:
  - Success log includes event ID and user number.
  - Failure log includes user number and a safe provider error summary.

## KakaoTalk

- Env:
  - `KAKAO_CLIENT_ID`
  - `KAKAO_TOKEN_ADMIN`
  - Kakao redirect URI configured in deployment metadata.
- OAuth encoding:
  - Login metadata/action URL uses the deployment redirect URI.
  - Local/staging/prod callback URLs are not mixed.
- Reminder flow:
  - Goals in the 180/90/30 minute windows are selected once.
  - `notif_sent_180min`, `notif_sent_90min`, and `notif_sent_30min` prevent duplicate sends.
  - Missing or expired Kakao token logs a warning and continues to Slack fallback.
- Fallback:
  - Kakao send failure does not prevent Slack notification attempt.
  - Scheduler continues processing remaining goals after one provider failure.
- Logs:
  - Log goal ID, user number, reminder window, and send result.
  - Do not log full access/refresh tokens.

## Slack

- Env:
  - `SLACK_WEBHOOK_URL`
  - `SLACK_BOT_TOKEN`
  - `SLACK_CHANNEL_ID`
- Webhook smoke test:
  - `POST /api/admin/slack/test` sends a visible message as an admin.
  - Missing webhook env returns/logs a clear operational warning.
- Reminder fallback:
  - Goal reminders include target time, message, and weekly success ratio.
  - Kakao failure still allows Slack fallback to post.
  - Slack failure does not block goal notification flags from being saved when the scheduler policy expects best-effort.
- Operational alerts:
  - LeetCode and study-material Slack test endpoints still send after env changes.
  - Provider rate-limit or non-2xx responses are visible in warning/error logs.

## Release Gate

- Run one local or staging goal save with Google connected.
- Run one reminder-window scheduler pass with Kakao disabled and Slack enabled.
- Run one admin Slack smoke test.
- Verify no secret values appear in logs.
- Verify failed provider calls are warn/error logs, not uncaught exceptions.
