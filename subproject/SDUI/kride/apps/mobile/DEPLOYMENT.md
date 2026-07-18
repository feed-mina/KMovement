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

## Android Preview Build 장애 해결 기록

### 증상과 원인

초기 EAS Android preview 빌드는 Expo 앱이 아닌 Git 저장소 루트 전체를
업로드하려고 하면서 약 1.97GB, 2,098개 파일을 순회했다. 이 과정에서
`.pytest_cache` 권한 오류가 발생했지만, 실제 원인은 모바일 빌드와 무관한
ML 데이터셋·모델까지 아카이브 대상에 포함된 모노레포 업로드 범위였다.

업로드 범위를 줄인 뒤 첫 클라우드 빌드는 Gradle 단계에서
`react-native-screens`가 `react-native` 위치를 찾지 못해 실패했다.
workspace 루트에 `react-native`가 hoist되고 `react-native-screens`는 앱 내부에
중첩 설치된 의존성 트리 불일치가 원인이었다.

### 적용한 해결

- Git 루트 `.easignore`를 allowlist 방식으로 유지하고 `.next/`, `dist-*/`,
  `.env.*`를 제외했다.
- workspace 루트와 모바일 앱의 React 관련 버전을 `18.2.0`으로 정렬했다.
- workspace 루트에 `react-native-screens@3.31.1`을 직접 선언해
  `react-native@0.74.5`와 같은 위치에서 해석되도록 했다.
- `package-lock.json`을 재생성했다.
- `RootLayout`이 SecureStore 세션 복구가 끝날 때까지 `null`을 반환하던
  문제를 제거했다. 복구 중에도 Expo Router `Stack`을 즉시 마운트해 Android
  실기기에서 흰 화면만 보이는 문제를 방지한다.

### 검증 결과

- `eas build:inspect --platform android --stage archive --profile preview`
  성공: 134개 파일, 약 1.29MiB, 실제 업로드 약 309KB
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund` 성공
- React `18.2.0`, React Native `0.74.5`, Screens `3.31.1` 단일 트리 확인
- 성공한 preview APK 빌드:
  [EAS build 29e45104](https://expo.dev/accounts/minyerin/projects/kride-mobile/builds/29e45104-2b56-45dc-baf8-68f8287004f5)
- Gradle `BUILD SUCCESSFUL`, APK 69,121,851 bytes
- APK에 AndroidManifest, DEX 3개, 서명 정보와 4개 Native ABI가 포함됨
- 모바일 Jest 2 suites / 8 tests, TypeScript 검사, Android export 성공
- CodeQL 보안 검사: 경고 0건

### 실기기 QA 체크리스트

다음 검증은 USB 디버깅이 허용된 Galaxy 기기 또는 Android AVD가 필요하다.

- [ ] preview APK 설치 및 `kride:///LOGIN_PAGE` 실행
- [ ] 초기 로딩과 로그인 화면 입력·제출 확인
- [ ] 로그인 후 `MAIN_PAGE` 및 읽기 전용 주요 화면·라우팅 확인
- [ ] API 연결과 인증 유지 확인
- [ ] 강제 종료 후 재실행 시 SecureStore 세션 복구 확인
- [ ] `adb logcat`에서 치명적 오류가 없는지 확인

현재 확인된 사전 조건은 ADB 연결 기기 0대, 등록된 AVD 0개이며,
정상 로그인용 비운영 테스트 계정도 별도로 문서화되어 있지 않다. 따라서
실기기 QA 완료 전에는 production AAB 빌드 및 스토어 배포를 진행하지 않는다.

## Store Readiness Note

This project is currently on Expo SDK 51 / React Native 0.74. Treat APK/AAB builds from this branch as preview and migration verification artifacts. Before Play Store or App Store submission, upgrade the mobile app to a current Expo SDK and re-check store target SDK / Xcode requirements.
