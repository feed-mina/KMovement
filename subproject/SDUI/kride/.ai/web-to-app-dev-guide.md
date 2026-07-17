# 웹 개발자를 위한 앱(React Native / Expo) 개발 입문 노트

> KRIDE 웹(Next.js)을 만들던 개발자가 `apps/mobile`(Expo) 앱을 처음 빌드하며 실제로 부딪힌 것들을 정리한 문서입니다.
> 각 항목 끝의 **[사례]** 는 이번 프로젝트에서 겪은 실제 문제입니다.

---

## 0. 한 줄 요약

**웹은 "브라우저라는 런타임 위에서 도는 문서"**, **앱은 "네이티브 런타임에 직접 올라가는 프로그램"**이다. 이 차이 하나에서 대부분의 새로운 개념이 파생된다.

---

## 1. 가장 근본적인 차이: 실행 환경

| | 웹 (Next.js) | 앱 (React Native / Expo) |
|---|---|---|
| 실행 주체 | 브라우저 (Chrome 등) | OS의 네이티브 런타임 (Android/iOS) |
| UI 렌더 | DOM (`div`, `span`) | 네이티브 뷰 (`View`, `Text`) — 진짜 안드로이드/iOS 위젯 |
| 스타일 | CSS (cascade, 상속) | style 객체 (cascade 없음), Flexbox만 |
| 코드 배포 | 서버에 올리면 끝 | JS 번들 + **네이티브 바이너리** 빌드 필요, 스토어 심사 |
| "새로고침" | 브라우저 새로고침 | 앱 리로드 / 재빌드 |

**핵심**: 웹은 브라우저가 HTML/CSS/JS를 해석해준다. 앱은 그런 해석기가 없다. JS는 별도 엔진(**Hermes**)에서 돌고, 화면은 진짜 네이티브 뷰로 그려진다. 그래서 "번들"과 "네이티브 모듈"이라는 개념이 새로 등장한다.

---

## 2. 새로 등장하는 용어들 (웹 대응)

| 앱 용어 | 역할 | 웹에서 비슷한 것 |
|---|---|---|
| **React Native** | JS로 네이티브 UI를 그리는 프레임워크 | React (DOM 대신 네이티브) |
| **Expo** | RN을 쉽게 쓰게 해주는 툴체인 + SDK | Create-React-App / Next.js 같은 상위 프레임워크 |
| **Metro** | RN 전용 번들러 | webpack / vite |
| **Hermes** | RN의 JS 엔진 (번들을 `.hbc` 바이트코드로) | V8 (브라우저 내장) |
| **Expo Go** | 개발용 미리보기 앱 (폰에 설치) | `npm run dev` + 브라우저 |
| **Dev build / EAS build** | 실제 네이티브 빌드(APK/IPA) | production 빌드 + 배포 |
| **expo-router** | 파일 기반 라우팅 | Next.js App Router (거의 동일한 개념) |
| **Watchman** | 파일 변경 감지 데몬 | webpack의 파일 워처 (내장) |

---

## 3. 웹엔 없는 개념 ①: 네이티브 모듈과 Expo Go의 한계

앱은 두 부분으로 나뉜다:
- **JS 번들** — 우리가 짠 로직/화면 (Metro가 만듦)
- **네이티브 코드** — 카메라, 지도, 보안저장소 등 OS 기능 (C/Java/Swift)

**Expo Go**는 "미리 정해진 네이티브 모듈 세트"만 내장한 앱이다. 그래서:
- reanimated, safe-area-context, async-storage 등 **자주 쓰는 건 내장** → Expo Go에서 바로 됨
- `react-native-maps`처럼 **안 내장된 건 Expo Go에서 크래시** → **dev build**(네이티브 빌드)가 필요

> **[사례]** `KrideMap`이 `react-native-maps`를 쓰는데 Expo Go엔 없어서, `expo-constants`로 Expo Go 여부를 감지해 지도 대신 안내 문구를 띄우는 **가드**를 넣었다. 웹이라면 그냥 라이브러리 import하면 끝났을 일이다.

**교훈**: 라이브러리를 고를 때 "이게 Expo Go에서 되나, dev build가 필요하나"를 먼저 따져야 한다. 웹에선 없던 판단 축이다.

---

## 4. 웹엔 없는 개념 ②: 버전 정합성이 훨씬 엄격하다

웹에선 `npm install` 하면 대충 최신으로 깔려도 잘 돈다. 앱은 **JS 버전과 네이티브 버전이 정확히 맞아야** 한다.

- Expo는 SDK 버전마다 "호환되는 패키지 버전"이 정해져 있다 → `npx expo install <pkg>`를 쓰면 **SDK에 맞는 버전**을 자동 선택한다. (그냥 `npm install` 쓰면 안 맞는 최신이 깔림)
- `react-native`는 앱 전체에 **딱 하나의 인스턴스**만 있어야 한다. 여러 개면 크래시.

> **[사례]** 이번에 겪은 문제의 90%가 이 범주였다:
> - `nativewind` 최신(4.2.x)이 깔리며 존재하지 않는 `react-native-worklets/plugin`을 강제 로드 → **4.1.23으로 고정**
> - `@react-native-async-storage/async-storage`가 1.24.0으로 깔렸는데 Expo Go 내장은 1.23.1 → **버전 정렬**
> - 모노레포에서 `react-native`가 웹 패키지 쪽으로 잘못 hoist되며 **RN 0.86 + React 19**가 딸려 들어와 번들 파싱 실패 → Metro 리졸버로 단일 버전 강제

**교훈**: 앱에선 "버전을 SDK에 맞춰 정확히 핀(pin)한다"가 기본기다. `expo install`과 `npx expo-doctor`(버전 검사)를 습관화할 것.

---

## 5. 웹엔 없는 개념 ③: 모노레포 hoisting과 단일 인스턴스

웹 여러 개 + 앱을 한 저장소(모노레포)에 두면, npm이 패키지를 루트로 끌어올리는(hoisting) 과정에서 앱이 깨지기 쉽다.

- 앱 전용 패키지(expo-router, reanimated 등)가 앱 폴더에만 있으면, 루트에 hoist된 `babel-preset-expo`가 이들을 **못 찾아** 기능이 꺼진다.
- 반대로 `react-native`가 여러 위치에 중복되면 앱이 크래시.

> **[사례]** `babel-preset-expo`가 루트에서 `expo-router`를 못 찾아(`hasModule` 실패) 라우터 babel 변환이 통째로 꺼졌다. → expo-router와 그 peer들을 **루트 package.json에 명시**해 hoist를 강제하고, `--legacy-peer-deps`로 설치. Metro 설정에는 `react-native`/`react`를 단일 복사본으로 강제하는 리졸버를 추가했다.

**교훈**: 모노레포 + 앱이면 "누가 어디로 hoist되는가"를 이해해야 한다. 순수 웹만 할 땐 몰라도 됐던 영역이다.

---

## 6. 웹엔 없는 개념 ④: 폰은 "다른 컴퓨터"다 (네트워킹)

웹 개발에선 브라우저가 곧 개발 PC라서 `localhost`가 그냥 됐다. 앱은 **폰이 별개의 기기**다.

- 폰에서 `localhost`(127.0.0.1)는 **폰 자신**을 뜻함 → 개발 서버(PC)에 절대 못 붙는다.
- 폰이 PC의 Metro에 붙으려면 **PC의 LAN IP**(예: `192.168.219.107:8081`)를 써야 한다.
- **API 서버 주소**도 마찬가지. `.env`의 `EXPO_PUBLIC_API_BASE`가 `localhost`면 폰에선 안 된다. 폰이 접근 가능한 주소여야 함.

연결 방식 3가지:
| 모드 | 설명 | 언제 |
|---|---|---|
| **LAN** | 같은 Wi-Fi에서 LAN IP로 직접 | 기본, 가장 빠름 |
| **Tunnel** | Expo 클라우드 경유(ngrok) | 방화벽/AP격리로 LAN이 막힐 때 |
| **localhost** | 에뮬레이터 전용 | 실기기엔 ❌ |

> **[사례]** 폰에 `java.io.IOException: Failed to download remote update`가 떴다. 코드 문제가 아니라 Metro가 `127.0.0.1`로 광고해서 폰이 번들을 못 받은 것. `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.219.107`로 LAN IP를 강제해 해결. (안 되면 `npx expo start --tunnel`)

**교훈**: 앱 개발에선 "이 주소를 폰이 실제로 열 수 있나?"를 항상 자문해야 한다.

---

## 7. 웹엔 없는 개념 ⑤: 개발 환경 도구 (Metro + Watchman)

Metro는 소스 변경을 감지해 즉시 반영(HMR)한다. 이때 파일 감시가 필요한데:
- macOS/Linux는 대체로 문제없음
- **Windows는 Watchman(파일 감시 데몬)이 사실상 필수** — 없으면 거대한 `node_modules`를 느린 기본 워처로 크롤하다 타임아웃

> **[사례]** `Failed to start watch mode`로 Metro가 반복 크래시. 원인은 Watchman 부재 + Windows 기본 워처가 심링크 많은 대형 트리를 4분 안에 못 훑는 것. **Watchman 설치 후 해결**.

**교훈**: 웹 툴체인은 이런 걸 내장해서 몰라도 됐지만, RN에선 Metro/Watchman 같은 하부 도구를 직접 챙겨야 할 때가 있다.

---

## 8. 스타일링: CSS와 다른 점

- **Flexbox가 기본이고, `flex-direction`의 기본값이 `column`** (웹은 `row`). 이거 하나로 많이 헷갈림.
- CSS **cascade/상속 없음**. 각 컴포넌트에 스타일을 직접 준다.
- 단위 `px`, `%` 개념이 다름 (숫자는 dp 단위). `em`, `rem`, 미디어쿼리 없음.
- 텍스트는 **반드시 `<Text>` 안에** 있어야 함. `<View>`에 문자열 직접 넣으면 크래시.
- **NativeWind** = Tailwind를 RN에서 쓰게 해줌 → 웹의 Tailwind 지식을 재사용 가능 (이 프로젝트가 이 방식).

---

## 9. 라우팅: expo-router (Next.js와 비슷)

- **파일 기반 라우팅** — `app/` 폴더 구조가 곧 경로. Next.js App Router와 거의 같은 개념이라 웹 경험이 그대로 통한다.
- `app/index.tsx` = 루트(`/`), `app/[screenId].tsx` = 동적 경로.
- 차이: 뒤에서 **네이티브 스택 네비게이션**(화면 push/pop, 뒤로가기 제스처)으로 동작.
- **딥링크 스킴**(`kride://...`) 개념이 추가 — 앱을 URL로 여는 방법.

> **[사례]** `[screenId].tsx`만 있고 `index.tsx`가 없어서 `/` 진입 시 매칭이 없었다 → `index.tsx`에서 `MAIN_PAGE`로 `Redirect` 추가.

---

## 10. 빌드/배포 파이프라인 (웹보다 여러 단계)

```
개발          →  Expo Go (QR로 즉시 미리보기, 네이티브 모듈 제한)
  ↓
Dev build     →  네이티브 모듈 포함한 개발용 빌드 (expo run:android / EAS)
  ↓
Preview       →  내부 배포용 APK/IPA (EAS build)
  ↓
Production    →  스토어 심사 → 출시
```

- **EAS(Expo Application Services) build** = 클라우드에서 실제 네이티브 빌드. `eas.json`으로 프로파일 관리.
- `app.json` = 앱 이름/아이콘/권한/번들ID 등 앱 메타데이터.
- 웹과 달리 **스토어 심사**라는 사람이 개입하는 관문이 있다 (수 시간~며칠).

---

## 11. 디버깅: 에러의 "종류"를 먼저 구분하라

앱에서 에러가 나면, **어느 단계의 에러인지** 구분하는 게 첫걸음이다. 이번에 다 겪었다:

| 에러 신호 | 단계 | 의미 | 대응 |
|---|---|---|---|
| `Android Bundling failed`, `SyntaxError`, `Unable to resolve module` | **번들(Metro)** | 코드/의존성이 번들이 안 됨 | 버전·hoisting·설정 |
| `Failed to start watch mode` | **개발 서버** | 파일 워처 문제 | Watchman |
| 폰 빨간 화면 / `Something went wrong` + JS 스택 | **런타임(JS)** | 번들은 됐는데 실행 중 예외 | 코드 로직 |
| `Failed to download remote update` | **네트워크** | 폰이 번들을 못 받음 | LAN IP / tunnel |

> **[사례]** "Something went wrong"을 처음엔 코드 크래시로 의심했지만, 로그를 보니 `Failed to download remote update` → **네트워크 문제**였다. 에러 종류를 구분 못 했으면 엉뚱한 코드만 팠을 것이다.

**교훈**: `npx expo export`(번들만 검증)로 번들 단계와 런타임/네트워크 단계를 분리해 원인을 좁힐 수 있다.

---

## 12. 체크리스트 — 앱 프로젝트를 처음 띄울 때

- [ ] `npx expo install`로 SDK에 맞는 버전 설치 (그냥 `npm install` 지양)
- [ ] `npx expo-doctor`로 버전 정합성 검사
- [ ] Windows면 **Watchman 설치** 확인
- [ ] `npx expo export`로 **번들부터** 통과시키기 (실기기 전에)
- [ ] 실기기: 폰과 PC 같은 Wi-Fi + **LAN IP**로 접속 (localhost ❌)
- [ ] API 주소가 폰에서 접근 가능한지 확인
- [ ] 쓰려는 라이브러리가 Expo Go 지원인지, dev build 필요인지 확인
- [ ] 에러가 나면 **번들/서버/런타임/네트워크** 중 어디인지부터 판단

---

## 13. 이번 프로젝트 케이스 스터디 요약

`apps/mobile`을 처음 번들·실행하며 순차적으로 만난 블로커:

1. RN 의존성 미설치 → 설치
2. 패키지 파일 부분 손상 → `npm ci` 클린 재설치
3. nativewind 4.2.x worklets 강제 로드 → **4.1.23 고정**
4. reanimated 플러그인 필요 → 설치
5. css-interop 해석 실패 → 버전 명시로 hoist
6. RN 0.86 중복 유입(파싱 실패) → Metro 단일화 + 루트 hoist
7. expo-router 미탐지(라우터 OFF) → 루트로 hoist
8. Metro 반복 크래시 → **Watchman 설치**
9. 폰 번들 다운로드 실패 → **LAN IP 강제**

→ 공통 근본원인은 대부분 **버전 정합성 + 모노레포 hoisting + 네이티브/네트워크의 물리적 현실**. 전부 웹만 할 땐 마주치지 않던 축이다.

관련 문서: `subproject/SDUI/ARCHITECTURE.md` (웹+모바일 공유 코어 구조), 빌드 재현 방법은 메모리 `kride-mobile-expo-build` 참고.

---

_이 문서는 이번 세션의 실제 트러블슈팅을 바탕으로 작성되었습니다._
