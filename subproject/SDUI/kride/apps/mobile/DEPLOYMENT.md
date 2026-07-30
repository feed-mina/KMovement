# KRIDE Mobile Runbook

## 패키지 매니저: pnpm (2026-07 전환)

kride 모노레포는 pnpm으로 설치한다 — `npm install`을 쓰지 말 것
(package-lock.json이 다시 생겨 트리가 이중화된다). 레이아웃은
`.npmrc`의 `node-linker=hoisted`로 npm과 동일하게 유지된다.

최초 1회 준비 (Windows):

```powershell
npm install -g corepack@latest   # 구버전 corepack은 npm 서명 키 교체로 실패한다
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm config set store-dir D:\pnpm-store --global   # 프로젝트와 같은 볼륨이어야 하드링크가 된다
```

설치는 kride 루트에서:

```powershell
cd <repo>\subproject\SDUI\kride
pnpm install
```

첫 설치는 전역 스토어를 채우느라 오래 걸리지만(이 저장소 기준 실측 2h25m),
이후에는 스토어 하드링크로 수 분(실측 3m25s)이면 끝난다. Vercel은
`vercel.json`의 `pnpm install --frozen-lockfile`을, EAS는 pnpm-lock.yaml
자동 감지를 사용하므로 별도 설정이 필요 없다. `store-dir`을 저장소의
`.npmrc`에 넣으면 CI/EAS 리눅스 빌더가 깨지므로 전역 설정만 쓴다.

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
pnpm run start:clear
```

3. Scan the QR code after Metro prints `Metro waiting on exp://...`.
4. If LAN is unstable, use the tunnel profile:

```powershell
pnpm run start:tunnel
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
$env:EXPO_NO_WATCHMAN = "1"
pnpm run export:android
```

This validates that the Expo Router entry, Metro config, and Android JS bundle are all coherent.
If this still remains at `Starting Metro Bundler`, treat the export as failed; do
not publish an OTA from an unverified bundle.

## EAS Android Builds

The app has two Android build profiles in `eas.json`:

- `preview`: internal APK for device testing.
- `production`: AAB artifact for release verification.

Authenticate and verify the project before the first build:

```powershell
eas login
eas whoami
eas project:info
eas env:list preview --format short
```

The `preview` EAS environment must define `EXPO_PUBLIC_API_BASE`. Do not use
`--include-sensitive` while checking the environment. The `env` block in the
build profile is not automatically reused by `eas update`.

### EAS 비용·중복 빌드 사전 확인

EAS 빌드는 한 작업자만 소유합니다. 빌드를 시작할 사람 또는 에이전트는
이슈/PR에 자신을 작업자로 기록하고, 완료·취소 또는 명시적인 인계 전에는 다른
작업자, CI, 로컬 터미널에서 같은 빌드를 시작하지 않습니다.

이 확인은 이제 `pnpm run eas:build:preview` / `eas:build:production` 에 내장돼
있습니다. `scripts/guard-eas-build.mjs` 가 빌드 명령보다 먼저 실행되어 같은
Git SHA·runtimeVersion·Android versionCode 좌표의 빌드가 있으면 빌드를
시작하지 않습니다. 조회 자체가 실패해도 fail-closed로 중단합니다.

2026-07-23에 같은 SHA/runtime/versionCode로 preview 빌드가 2건(약 8.9분 +
9.9분) 실행된 원인은, 이 절차가 문서에만 있고 `eas:build:preview` 가 곧바로
`eas build` 를 호출해 절차를 건너뛸 수 있었기 때문입니다.

빌드 없이 확인만 하려면:

```bash
pnpm run eas:guard:preview
```

가드가 내부적으로 실행하는 조회는 다음과 같습니다:

```powershell
$gitSha = git rev-parse HEAD
$expoConfig = npx expo config --type public --json | ConvertFrom-Json
$runtimeVersion = $expoConfig.version
$versionCode = [string]$expoConfig.android.versionCode

eas build:list `
  --platform android `
  --build-profile preview `
  --git-commit-hash $gitSha `
  --runtime-version $runtimeVersion `
  --app-build-version $versionCode `
  --limit 20
```

> 플래그 이름 주의: 빌드 프로필 필터는 `--profile` 이 아니라 `--build-profile`
> 입니다. 잘못 주면 `build:list` 전체가 실패합니다.

- `new`, `in-queue`, `in-progress`, `pending-cancel`이면 새 빌드를 만들지 말고 기존
  빌드를 기다립니다.
- `finished`이면 기존 artifact와 build ID를 재사용합니다.
- `errored` 또는 `canceled`이면 실패 원인을 수정하고 이전 build ID를
  이슈/PR에 기록한 뒤 한 작업자만 재시도합니다.
- 실제 `pnpm run eas:build:preview` 직전에 같은 조회를 다시 실행하며,
  가드가 이를 자동으로 수행하므로,
  조회와 시작 사이에 생긴 중복 요청도 차단됩니다.
- 의도적으로 중복 빌드가 필요하면 `node scripts/guard-eas-build.mjs preview --allow-duplicate`
  로 이유를 남기고 우회합니다.

JS-only 변경은 새 native binary를 만들지 않습니다. 네이티브 모듈, Expo/RN
버전, 권한, `app.json`의 native config, runtimeVersion이 그대로이고 기존
runtime의 preview APK가 설치·검증돼 있다면 Bundle Check와 테스트 후
`pnpm run eas:update:preview -- "short change summary"`를 사용합니다. 네이티브
경계가 바뀐 경우에만 app version/runtime과 versionCode를 올리고 위 사전
확인을 거쳐 EAS Build를 실행합니다.

Then build the new native runtime:

```powershell
pnpm run eas:build:preview
pnpm run eas:build:production
```

Use EAS managed credentials unless a project keystore has already been provisioned.

## OTA Updates

`expo-updates` is configured for the EAS project
`cc4cddc4-e3df-446d-8f62-7d0d39dc77a2`.

- `preview` builds receive updates from the `preview` channel.
- `production` builds receive updates from the `production` channel.
- `runtimeVersion` follows the app version (`0.2.0` now). Keep the same version
  only for JS-only fixes against the same native runtime.
- `0.2.0` is the first runtime that includes `expo-image-picker` and
  `expo-file-system`. Build and install a new `preview` APK before publishing
  any OTA that imports those modules. Existing `0.1.0` binaries are not a valid
  test target for this batch.

Use OTA for:

- SDUI renderer fixes in `apps/mobile/src/**`.
- shared JS fixes in `packages/core/**`.
- copy, spacing, routing, and non-native UI behavior.

Use a new EAS build instead of OTA for:

- adding/removing native modules,
- Expo SDK / React Native upgrades,
- Android permissions, package id, scheme, icon/splash, or Gradle changes,
- `runtimeVersion` or `app.json` native config changes.

Before every native change, bump `expo.version` so the `appVersion` runtime
policy cannot deliver incompatible JavaScript to an older binary. Android
`versionCode` must also be greater than the last installed/published build;
`preview` is manual (`4` for the next build), while `production` uses
`autoIncrement`.

Publish preview OTA:

```powershell
cd <repo>\subproject\SDUI\kride\apps\mobile
eas channel:view preview
pnpm run eas:update:preview -- "short change summary"
```

Publish production OTA only after preview QA:

```powershell
pnpm run eas:update:production -- "short change summary"
```

Rollback options:

- Roll back the latest update group with
  `eas update:rollback <latest-update-group-id> --platform android --message "rollback reason"`.
- Or republish a known-good group with
  `eas update:republish --group <known-good-update-group-id> --destination-channel preview --platform android --message "rollback reason"`.
- If no compatible known-good OTA exists, use
  `eas update:roll-back-to-embedded --channel preview --runtime-version 0.2.0 --platform android --message "rollback to embedded"`.
- Replace `preview` with `production` only after confirming the affected
  channel. Test rollback against preview first because persistent local state
  may not be backwards-compatible.

Before every OTA, run:

```powershell
$env:EXPO_NO_WATCHMAN = "1"
pnpm run export:android
pnpm exec jest --runInBand
```

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
