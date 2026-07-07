# 디자인 통일성·UX 고도화 — 로드맵 & 실행 계획 (2026-07-07)

> 선행: [0612_ui_theming_design_tokens_plan.md](0612_ui_theming_design_tokens_plan.md) — tokens.css 신설, design_tokens 테이블(V68), ThemeProvider(V69) 구축 완료.
> 이 문서는 "토큰은 있으나 단일 원천으로 작동하지 않는" 문제를 해결하고, 컴포넌트/타이포/UX까지 통일하는 후속 계획이다.

---

## 1. 진단 — 통일성을 깨는 근본 원인 (모두 코드 근거)

| # | 문제 | 근거 |
|---|---|---|
| 1 | **토큰 ↔ Tailwind 분리** | Tailwind v4(`@import "tailwindcss"`)인데 `globals.css`에 `@theme` 없음 → `--kride-*`와 `bg-red-600`이 별개 시스템 |
| 2 | **`:root` 팔레트 2벌 충돌** | `tokens.css`는 `--kride-primary:#E50914`, `globals.css`는 `--primary:#4A90E2`(블루). text/border 값도 상이 |
| 3 | **하드코딩 팔레트 지배** | `text-gray-500`×26, `bg-red-600`×8 등. goal-dashboard는 emerald/sky/rose 직접 사용 |
| 4 | **화면별 CSS 파편화** | `AI_CHAT.css`/`KRIDE.css` 등 33개 파일, ~8,274줄, `!important` 다수 |
| 5 | **타이포 혼재** | Outfit + Inter 동시 로드 + body는 system-font 스택. 한글(Noto Sans KR) 전략 불명확 |

기준 스타일 가이드: 이 세션에서 시각화한 `kride_design_style_guide` 위젯 참고.

---

## 2. 로드맵 (레버리지 높은 순, 3단계)

### Phase 1 — 토큰 단일화 (최대 효과 · 낮은 리스크)
색/간격/라운드/그림자의 단일 원천을 만들고 Tailwind에 연결.
- `globals.css`에 `@theme` 블록 추가 → `--kride-*`를 Tailwind 색으로 승격
- `globals.css` `:root`의 충돌 변수 제거(블루 `--primary` 등) → tokens.css로 일원화
- 원시 토큰 → **시맨틱 토큰**(`--color-accent`, `--surface`, `--text-muted`, `--danger`) 계층 도입
- 다크모드를 토큰 override로 정식화

### Phase 2 — 컴포넌트 프리미티브 + 리듬
- 토큰 기반 `Button`/`Card`/`Badge`/`Metric`/`EmptyState`/`Skeleton` 1벌
- 타이포 스케일(12/14/16/20/24/32) + 8px 스페이싱 그리드 규칙화
- 폰트 확정: 라틴 1종(Inter) + Noto Sans KR, `font-display:swap`, 나머지 제거
- 화면별 CSS 33개 → 공통 토큰 참조로 점진 축소

### Phase 3 — UX 만족감 레이어
- 상태 완결성: 모든 목록/카드에 loading(Skeleton)·empty·error 통일
- 마이크로 인터랙션: hover/press/focus-ring, 진입 페이드(120–200ms ease-out)
- 접근성: WCAG AA 대비, 터치 48px, 포커스 가시성, `prefers-reduced-motion`
- 일관된 피드백: 토스트/로딩/성공 패턴 1벌

---

## 3. 상세 실행 계획 (Phase 1 우선, 파일 단위)

### 3.1 변경 대상 파일
| 파일 | 작업 |
|---|---|
| `app/styles/tokens.css` | 시맨틱 토큰 계층 추가(원시→의미 매핑), 다크모드 override 블록 |
| `app/globals.css` | `@theme inline` 추가로 토큰→Tailwind 연결, `:root` 충돌 변수 제거 |
| `components/providers/ThemeProvider.tsx` | 런타임 주입 대상 변수명을 시맨틱 토큰에 맞춤(확인) |
| (신규) `components/ui/` | Button/Card/Badge/Metric/EmptyState/Skeleton 프리미티브 (Phase 2) |

### 3.2 Phase 1 구체안

(1) `tokens.css` — 시맨틱 계층 추가 (원시 토큰 아래에):
```css
:root {
  /* 시맨틱 (컴포넌트는 이것만 참조) */
  --color-accent: var(--kride-primary);
  --color-accent-strong: var(--kride-primary-dark);
  --surface-page: var(--kride-bg-cream);
  --surface-card: var(--kride-bg-card);
  --text-strong: var(--kride-text-strong);
  --text-body: var(--kride-text-main);
  --text-muted: var(--kride-text-sub);
  --border-hair: var(--kride-border);
  --danger: var(--kride-primary);
  --focus-ring: var(--kride-focus-ring);
}
:root[data-theme="dark"], .dark {
  --surface-page: var(--kride-bg-dark);
  --surface-card: var(--kride-bg-dark-2);
  --text-strong: #FFFFFF;
  --text-body: #E5E7EB;
  --text-muted: #9CA3AF;
  --border-hair: #2A2A2A;
}
```

(2) `globals.css` — Tailwind v4 `@theme`로 승격 (`@import "tailwindcss"` 아래):
```css
@theme inline {
  --color-accent: var(--color-accent);
  --color-accent-strong: var(--color-accent-strong);
  --color-surface: var(--surface-card);
  --color-page: var(--surface-page);
  --color-ink: var(--text-strong);
  --color-body: var(--text-body);
  --color-muted: var(--text-muted);
  --color-hair: var(--border-hair);
  --radius-card: var(--kride-radius-md);
  --radius-pill: var(--kride-radius-pill);
}
```
→ 이후 `bg-accent text-ink border-hair rounded-card` 유틸 사용 가능.

(3) `globals.css` `:root`에서 삭제/치환:
- `--primary:#4A90E2` 삭제(블루), `--text-main/--text-sub/--border`는 시맨틱 토큰으로 치환

### 3.3 마이그레이션 (점진, 리스크 최소)
1. Phase 1 토큰/`@theme`만 먼저 적용 → **기존 화면 시각 변화 없음**(값 동일, 별칭만 추가)
2. 신규/수정 화면부터 새 유틸 사용(goal-dashboard 먼저: emerald/sky/rose→시맨틱)
3. 하드코딩 팔레트를 화면 단위로 순차 치환. 한 번에 전체 치환 금지

### 3.4 검증
- `npm run build` (Tailwind v4 `@theme` 파싱 확인)
- `npm run test` / 스냅샷 (시각 회귀 없어야 함 — Phase 1은 별칭 추가라 무변화가 정상)
- `npx playwright test` 핵심 플로우
- 다크모드 토글 수동 확인, 대비(WCAG AA) 스팟 체크

---

## 4. 리스크 & 주의
- Tailwind v4 `@theme` 문법/빌드 파이프라인(`@tailwindcss/postcss`) 호환 확인 필요
- `@source inline(...)` safelist에 신규 유틸 추가 여부 점검(DB 주입 클래스)
- ThemeProvider가 주입하는 변수명과 시맨틱 토큰명 정합성(V69 THEME_SETTINGS 관리화면과 연동)
- 화면별 CSS 33개 일괄 삭제 금지 → 회귀 위험. 반드시 화면 단위 점진

## 5. 진행 순서(합의됨)
① 스타일 가이드 시각화(완료) → ② 로드맵(본 문서) → ③ 상세 실행 계획(본 문서) → 이후 Phase 1 구현은 별도 승인 후.

---

## 6. 마스코트 "라이(RAI)" + 친밀한 톤 (2026-07-07 추가)

목표: 강한 브랜드 레드는 유지하되 **더 둥근 형태 + 마스코트 캐릭터**로 친밀감을 더한다. 캐릭터가 챗봇에서 길잡이 역할.

### 6.1 캐릭터 컨셉
- **라이(RAI)** — 브랜드 레드 헬멧을 쓴 둥근 호랑이(한국 상징 + 라이딩). 다정한 존댓말 화자.
- 색은 다크모드 반전 방지를 위해 **고정 hex**(body #FFD29B, helmet #E50914 …). 헬멧색만 테마 토큰 주입 가능(`helmet` prop).

### 6.2 표정 4종 ↔ 챗봇 상태 매핑
| 표정 | 트리거 | chat status |
|---|---|---|
| greeting | 입장/온보딩 | idle |
| thinking | 분석 중 | thinking |
| success | 결과 도착/스트리밍 | streaming |
| sad | 에러 · 결과 0건 | (hook error) |

### 6.3 구현 현황 (완료)
- `components/fields/kride/atoms/Rai.tsx` — `<Rai state size helmet />` SVG 컴포넌트, 표정 4종 variant.
- `components/fields/kride/chat/components/Header.tsx` — 기존 `__logo`("K")를 `<Rai>`로 교체, `STATUS_TO_RAI`로 status→표정 매핑. tsc 통과.

### 6.4 남은 적용 지점 (권장)
- 온보딩 첫 말풍선 / 빈 상태 일러스트(`sad`·`greeting`) / 전역 로딩.
- 에러 시 `sad` 노출: `useKrideChatStream`의 에러 상태를 Header status(또는 별도 prop)로 전달.
- 마이크로 모션: 입장 바운스, 완료 시 살짝 점프(150–200ms), `prefers-reduced-motion` 존중.
- 말맛(마이크로카피) 라이 화자로 통일: "라이가 코스를 그리는 중…", 빈 상태 "아직 다녀온 곳이 없어요 — 첫 코스를 떠나볼까요?".

### 6.5 친밀 톤 조정(전역)
- 라운드 상향(카드 12→16, 버튼 10→12, 칩/아바타 pill).
- 큰 면적은 `--kride-primary-soft`(8% 틴트)·크림, 풀 레드는 CTA/강조에만.
- outline 아이콘 통일.
