# KRIDE Mobile Runbook

## Local Device Smoke Test

1. Copy `.env.example` to `.env` and keep `EXPO_PUBLIC_API_BASE` reachable from the phone.
2. Start Metro from this directory:

```powershell
cd D:\KMovement\subproject\SDUI\kride\apps\mobile
npm run start:clear
```

3. Scan the QR code after Metro prints `Metro waiting on exp://...`.
4. If LAN is unstable, use the tunnel profile:

```powershell
npm run start:tunnel
```

If `Waiting for Watchman 'query'` keeps increasing for more than about 60 seconds, stop Metro with `Ctrl+C` and clear stale watch/indexing inputs before retrying. The current Metro config intentionally watches only the mobile app and `packages/core`.

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
