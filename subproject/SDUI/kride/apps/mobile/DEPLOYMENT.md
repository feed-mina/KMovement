# KRIDE Mobile Runbook

## Local Device Smoke Test

1. Copy `.env.example` to `.env`. `EXPO_PUBLIC_API_BASE` is required and must be
   reachable **from the phone** — a local backend needs this machine's LAN IP,
   not `localhost`. Without the variable the app falls back to an empty API base
   and every request goes to an unresolvable relative path, so screens and login
   fail with no obvious cause. The default in the template points at the same
   deployed host the EAS profiles use, which needs no local backend.
2. Start Metro from this directory:

```powershell
cd <repo>\subproject\SDUI\kride\apps\mobile
npm run start:clear
```

3. Scan the QR code after Metro prints `Metro waiting on exp://...`.
4. If LAN is unstable, use the tunnel profile:

```powershell
npm run start:tunnel
```

If `Waiting for Watchman 'query'` keeps increasing for more than about 60 seconds, stop Metro with `Ctrl+C` and clear stale watch/indexing inputs before retrying. The current Metro config intentionally watches only the mobile app and `packages/core`.

### What to check

Automated tests cover the leaves and the login action in isolation; these are the
parts only a device can confirm.

| Step | Expect |
|---|---|
| Open `/LOGIN_PAGE` | Domain chips (`naver.com` …) respond to taps and show as selected |
| Tap `Custom` | A domain text field appears and accepts input |
| Fill id + domain + password, tap 로그인 | Navigates to `MAIN_PAGE` |
| Retry with a wrong password | Alert: 로그인 정보가 올바르지 않습니다 |
| Force-quit and relaunch | Still logged in (SecureStore round-trip) |

The relaunch step is the one with no automated equivalent — the store tests
simulate a restart in memory rather than exercising SecureStore itself.

If the login button does nothing, check the server's DB before the client: the
button is wired by `ui_metadata.action_type = 'LOGIN_SUBMIT'` for
`LOGIN_PAGE.login_btn`. An unmigrated database still holding the old `SUBMIT`
value produces a no-op button no matter what the app does (see `V21`).

### Expo Go limits

`react-native-maps` ships in dev/EAS builds but not in Expo Go, so any screen
with a `MAP_VIEW` component (currently `KRIDE_FOCUS`) crashes there. The login
path (`LOGIN_PAGE` → `MAIN_PAGE`) uses no map and is safe. Use an EAS build to
exercise map screens.

## Bundle Check

Use this before opening or updating an EAS build:

```powershell
npm run export:android
```

This validates that the Expo Router entry, Metro config, and Android JS bundle are all coherent.

## EAS Android Builds

The app has two Android build profiles in `eas.json`:

- `preview`: internal APK for device testing.
- `production`: AAB artifact for release verification.

Login first:

```powershell
eas login
```

Then build:

```powershell
npm run eas:build:preview
npm run eas:build:production
```

Use EAS managed credentials unless a project keystore has already been provisioned.

## Store Readiness Note

This project is currently on Expo SDK 51 / React Native 0.74. Treat APK/AAB builds from this branch as preview and migration verification artifacts. Before Play Store or App Store submission, upgrade the mobile app to a current Expo SDK and re-check store target SDK / Xcode requirements.
