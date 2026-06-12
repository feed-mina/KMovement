# UI 고도화 + DB 기반 테마(디자인 토큰) 시스템 — 리서치 & 플랜 (2026-06-12)

## 1. 목표

1. K-RIDE 브랜드 색상을 살린 모바일 친화적 UI 고도화 (모바일 PWA 우선, PC/노트북 반응형 대응)
2. `ui_metadata` 테이블의 CSS 부분을 **변수(디자인 토큰)화** → 웹 화면에서 값을 선택하면 DB가 갱신되고, 재배포 없이 전 화면 CSS가 바뀌는 구조
3. 곧 진행할 React Native 마이그레이션을 고려한 플랫폼 중립적 설계

---

## 2. 현재 상태 리서치 결과

### 2.1 ui_metadata 테이블 (SDUI_LAB DB, 30개 컬럼)

스타일 관련 컬럼:

| 컬럼 | 타입 | 현재 사용 방식 |
|---|---|---|
| `css_class` | varchar | `DynamicEngine.tsx:49`에서 className으로 그대로 적용 |
| `inline_style` | text | 일부 필드(TextField, ImageField, PasswordField)에서 style로 적용 |
| `css_class_overrides` | jsonb | 역할(role)별 클래스 오버라이드 |
| `component_props` | jsonb | 컴포넌트별 추가 props |

→ **구조(레이아웃·클래스 지정)는 이미 DB 주도(SDUI)**. 그러나 **색상·간격·폰트 등 "값"은 33개 CSS 파일에 하드코딩**되어 있어, 색을 바꾸려면 CSS 수정 + 프론트 재배포가 필요함.

### 2.2 CSS 현황 (metadata-project)

- `app/globals.css` + `app/styles/*.css` 33개 파일, **총 약 8,274줄**
- CSS 변수는 `globals.css`의 `:root`에 7개만 존재 (`--primary: #4A90E2` 등 — K-RIDE 색이 아닌 구형 블루 팔레트)
- Tailwind v4 (`@tailwindcss/postcss`) + DB 주입 클래스용 `@source inline(...)` safelist 운영 중
- 반응형: `common.css`(모바일 기본) + `pc_common.css`(`@media min-width:1024px`) 2단 구조. `!important` 덮어쓰기 다수 → 캐스케이드 취약
- PWA: `public/manifest.json`, `sw.js`, `firebase-messaging-sw.js` 이미 존재 → PWA 테스트 기반은 갖춰짐

### 2.3 K-RIDE 브랜드 색상 (KRIDE.css / KRIDE_CHAT.css에서 추출)

| 용도 | 값 |
|---|---|
| Primary (시그니처 레드) | `#E50914` |
| Primary Dark | `#8B0610` |
| 배경 다크 | `#0A0A0A`, `#1C1C1C`, `#232323` |
| 배경 크림 | `#FDFBF7`, `#EAE5D9` |
| 텍스트 | `#FFFFFF`, `#374151` |

### 2.4 백엔드

- `GET /api/ui/{screenId}` → UiService가 트리 빌드, Redis 1시간 캐시
- `query_master` 테이블 + Redis `SQL:{sqlKey}` 캐시 패턴이 이미 있음 → 토큰 테이블도 동일 패턴 재사용 가능
- Flyway 마이그레이션으로 스키마/데이터 관리 (현재 V66까지)

---

## 3. 핵심 질문에 대한 답: "CSS를 변수처리해서 웹에서 선택 → DB·CSS 변경이 가능한가?"

**가능합니다.** 권장 방식은 `css_class` 문자열 자체를 편집하는 게 아니라, **디자인 토큰(Design Token) 계층을 분리**하는 것:

```
[design_tokens 테이블]  →  GET /api/ui/theme  →  프론트 ThemeProvider가
 (token_key, value)         (Redis 캐시)          :root에 CSS 변수로 주입
                                                  document.documentElement.style.setProperty()

[관리 화면(SDUI 화면으로 제작)] → 컬러피커로 값 선택 → POST /api/ui/theme → DB 갱신 + Redis 캐시 무효화
→ 모든 클라이언트가 재배포 없이 새 테마 적용
```

이 방식의 장점:

1. **CSS 파일은 `var(--kride-primary)`만 참조** → 값은 DB에서 옴. 클래스 구조는 그대로 유지되어 기존 SDUI 엔진과 충돌 없음
2. **React Native 호환**: `css_class` 문자열은 RN에 이식 불가하지만, 토큰은 순수 JSON이라 RN의 ThemeProvider/StyleSheet로 그대로 매핑 가능 (`var(--kride-primary)` ↔ `theme.colors.primary`)
3. **기존 인프라 재사용**: query_master와 동일한 "DB + Redis 캐시 + API" 패턴
4. Tailwind safelist 문제 회피 — 임의 클래스를 DB에서 만들어내는 방식(예: `bg-[#E50914]`)은 Tailwind JIT가 빌드 타임에 클래스를 모르면 스타일이 안 먹는 함정이 있음. CSS 변수 방식은 이 문제가 없음

> 대안 비교: `ui_metadata.inline_style`을 직접 편집하는 방식도 동작은 하지만, 컴포넌트(행) 단위로 흩어져 일괄 테마 변경이 안 되고 RN 마이그레이션 때 전부 재작업이라 비권장.

---

## 4. 실행 플랜 (5단계)

### Phase 1 — 디자인 토큰 추출 & K-RIDE 팔레트 정의 (CSS만, DB 무관)
- `globals.css`의 `:root`를 K-RIDE 토큰 체계로 확장:
  - 색상: `--kride-primary(#E50914)`, `--kride-primary-dark(#8B0610)`, `--kride-bg-dark`, `--kride-bg-cream`, 텍스트/보더 계열
  - 간격: `--space-1~8`, 타이포: `--font-size-*`, 라운드: `--radius-*`
- 33개 CSS 파일의 하드코딩 hex/px 값을 `var()`로 치환 (KRIDE*.css → 공통 → 화면별 순)
- 다크모드는 `prefers-color-scheme` 기존 블록을 토큰 재정의로 전환

### Phase 2 — 모바일 퍼스트 반응형 고도화
- 기준: 모바일(기본) → 태블릿(`768px`) → PC(`1024px`) 3단 브레이크포인트 정리, `!important` 단계적 제거
- PWA 대응: `100dvh`, `env(safe-area-inset-*)`, 터치 타깃 최소 44px, `manifest.json`의 `theme_color`를 K-RIDE 레드로 동기화
- 검증: Chrome DevTools 디바이스 모드 + 실제 모바일 PWA 설치 테스트

### Phase 3 — DB 기반 테마 시스템 (백엔드)
- **[스키마 변경 — 사용자 승인 필요]** Flyway `V67__create_design_tokens.sql`:
  ```sql
  CREATE TABLE design_tokens (
      token_id   BIGSERIAL PRIMARY KEY,
      theme_id   VARCHAR(50) NOT NULL DEFAULT 'KRIDE_DEFAULT',
      category   VARCHAR(30) NOT NULL,        -- color | spacing | typography | radius
      token_key  VARCHAR(100) NOT NULL,       -- 예: primary, bg-dark
      token_value VARCHAR(200) NOT NULL,      -- 예: #E50914
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE (theme_id, token_key)
  );
  ```
- `domain/theme` 패키지: `GET /api/ui/theme/{themeId}` (Redis 캐시 `THEME:{themeId}`), `PUT /api/ui/theme/{themeId}` (관리자 권한, 저장 시 캐시 evict)

### Phase 4 — 프론트 ThemeProvider + 관리 화면
- `components/providers/ThemeProvider.tsx`: 부팅 시 토큰 fetch → `:root`에 CSS 변수 주입 (React Query, 실패 시 globals.css 기본값으로 폴백 — 점진적 적용 가능)
- 관리 화면을 **SDUI 자체로 제작** (`screen_id = THEME_SETTINGS`):
  - 신규 컴포넌트 `COLOR_PICKER`를 `components/fields/` + `componentMap.tsx`에 추가
  - `ui_metadata`에 THEME_SETTINGS 행 추가 (Flyway), `allowed_roles`로 관리자 제한
  - 저장 액션 `THEME_SAVE` → `useBusinessActions`에서 PUT 호출 → 즉시 리렌더

### Phase 5 — React Native 마이그레이션 대비
- 토큰 JSON 스키마를 플랫폼 중립으로 문서화: `{ colors: {...}, spacing: {...}, typography: {...} }`
- RN 측 매핑 가이드 작성: CSS 변수 → RN ThemeContext, `css_class` → 컴포넌트별 StyleSheet 변환표
- `component_props`(jsonb)에 시맨틱 변형(`variant: "primary"`)을 쓰는 방향 권장 — 웹/RN 양쪽에서 해석 가능

### 작업 순서 및 의존성
- Phase 1→2는 DB 없이 즉시 가능 (UI 고도화 체감 효과 가장 큼)
- Phase 3→4는 스키마 승인 후 진행, Phase 1의 토큰 명명이 선행 조건
- Phase 5는 문서 작업으로 병행 가능

### 리스크
- 8,274줄 CSS 치환 중 회귀 위험 → 화면별(KRIDE → MAIN → DIARY → CHAT) 점진 치환 + Playwright 스크린샷 비교
- Redis 캐시(1시간)로 인해 테마 변경이 지연 반영될 수 있음 → 저장 시 명시적 evict 필수
- `inline_style`에 박힌 색상은 토큰 적용이 안 됨 → 마이그레이션 시 `var()` 참조로 데이터 정리(UPDATE) 필요

---

## [별첨] 2026-06-12 — Phase 1~2 MAIN/LOGIN/REGISTER 적용 [완료]

### 추가 리서치 발견
- 실제 CSS 엔트리는 `app/styles/index.css` (layout.tsx에서 import). **`app/globals.css`, `MAIN_PAGE.css`, `LOGIN_PAGE.css`, `pc_*.css`, `DIARY_*.css` 등은 어디서도 import되지 않는 데드 파일** — 라이브 스타일은 `pages.css`/`common.css`/`layout.css`/`components.css`에 있음
- `:root` 변수가 layout.css(`--primary-color: #73c234` 그린)와 pages.css 1261행(중복 재정의)에 분산
- 3개 화면 팔레트가 제각각: MAIN=그린 벤토(#16a34a 계열), LOGIN=핑크(#FDBFBC), REGISTER=블루(#0064ff)

### 변경 내역 [완료]
1. **`app/styles/tokens.css` 신설** — K-RIDE 토큰 35종(색상/간격/라운드/그림자/터치/safe-area), `index.css` 최상단 import
2. **pages.css 로그인 섹션** — 핑크 → `var(--kride-primary)`, 배경 크림 그라데이션, `100dvh` + safe-area, 포커스 링 토큰화. `.signup-nav`, `.logout_button`(+layout.css)도 레드 전환
3. **pages.css REGISTER 섹션** — 블루 → 레드 그라데이션 submit 버튼, 포커스 링, 모바일 카드 여백 축소 + safe-area 미디어쿼리 추가
4. **pages.css 메인 섹션** — 벤토 그리드 그린 팔레트 전체를 K-RIDE 레드/다크/크림으로 전환 (`.bento-card-content`=레드 그라데이션, `.bento-card-login`=다크레드, `.bento-card-dark`=#0A0A0A, 배경=크림), AI 카드 2종 톤 정리, `.setup-button`/`.setup-link`/`.content-btn-*` 레드 전환, 모바일 브레이크포인트에 safe-area 추가
5. **PWA** — `manifest.json` theme_color `#4F46E5`→`#E50914`, background `#FDFBF7`; `layout.tsx` viewport.themeColor 동기화

### 검증
- 사용된 `var(--kride-*)` 103곳 전부 tokens.css에 정의 확인 [완료]
- Jest: 101 passed / 16 failed — 실패는 전부 기존 환경 문제(firebase 미설치→npm install로 7→6 suite로 감소, 나머지는 .env가 프로덕션 IP를 가리켜 MSW 모킹 불일치) — CSS와 무관 [실패원인 기존재]
- `npm run test` 스크립트의 `nyc`가 devDependencies에 없어 실행 불가(기존 문제) → `npx jest tests/`로 대체 실행
- 프로덕션 빌드 검증은 사용자 결정으로 생략

### 남은 작업
- 깃 커밋/푸시 (사용자 직접) → [완료] 2026-06-12
- 모바일 PWA 실기기 확인 (theme_color는 재설치/새로고침 후 반영)
- 데드 CSS 파일 정리 여부 결정 (globals.css, MAIN_PAGE.css, LOGIN_PAGE.css, pc_*.css 등)

---

## [별첨2] 2026-06-12 — Phase 3~4(일부) DB 기반 테마 시스템 구현 [완료]

사용자 승인("DB까지 알아서")에 따라 design_tokens 테이블 + 백엔드 API + 프론트 ThemeProvider 구현.

### 백엔드 (SDUI-server)
| 파일 | 내용 |
|---|---|
| `db/migration/V68__create_design_tokens.sql` | 테이블 생성 + KRIDE_DEFAULT 테마 시드 34종 (V67이 이미 존재해 플랜의 V67→**V68**로 변경) |
| `domain/theme/domain/DesignToken.java` | JPA 엔티티 (@Builder 포함), `updateValue()`로 updated_at 갱신 |
| `domain/theme/domain/DesignTokenRepository.java` | `findByThemeIdOrderByTokenIdAsc` |
| `domain/theme/dto/ThemeResponseDto.java` | `{themeId, tokens:[{category,key,value}]}` |
| `domain/theme/service/ThemeService.java` | Redis 캐시 `THEME:{themeId}` TTL 1h (query_master 패턴), PUT 시 캐시 evict, Redis 장애 시 DB 폴백 + SLF4J 에러 로깅 |
| `domain/theme/controller/ThemeController.java` | `GET/PUT /api/ui/theme/{themeId}` |
| `global/config/SecurityConfig.java` | `PUT /api/ui/theme/**` → `hasRole("ADMIN")` 규칙을 `/api/ui/**` permitAll **앞에** 추가 (선순위 매칭) |

### 프론트 (metadata-project)
| 파일 | 내용 |
|---|---|
| `components/providers/ThemeProvider.tsx` (신설) | React Query로 토큰 fetch(staleTime 1h) → `document.documentElement.style.setProperty('--kride-{key}', value)` 주입. 실패 시 tokens.css 정적값 폴백 |
| `app/layout.tsx` | ReactQueryProvider 바로 안쪽에 ThemeProvider 마운트 |

### 설계 노트
- `token_key` ↔ CSS 변수 `--kride-{token_key}` 1:1 매핑 (예: `primary` → `--kride-primary`)
- `--kride-safe-bottom`(env() 함수)은 DB 시드에서 제외 — CSS 전용
- URL을 `/api/ui/theme/{themeId}`로 잡아 기존 `GET /api/ui/{screenId}`(1-segment)와 충돌 없음(2-segment)
- 테마 변경 흐름: PUT(관리자) → DB UPDATE + Redis evict → 클라이언트 다음 fetch에서 새 값 → CSS 변수 덮어쓰기 → 재배포 없이 전 화면 반영

### 테스트
- 백엔드: `ThemeServiceTest` 5건 (캐시 미스/히트, 미등록 themeId/token_key 예외, 수정+evict) — `./gradlew test --tests` BUILD SUCCESSFUL [완료]
- 프론트: `tests/components/ThemeProvider.test.tsx` 3건 (변수 주입, 실패 폴백, themeId prop)

### 남은 작업 (Phase 4 잔여 + Phase 5)
- THEME_SETTINGS 관리 화면 (COLOR_PICKER 컴포넌트 + ui_metadata 행 추가)
- RN 마이그레이션 매핑 가이드 문서
- 배포 시 Flyway V68 자동 적용 확인 (EC2 백엔드 재기동)
