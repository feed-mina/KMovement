# KRIDE_INTRO1 — Publish package

화면 비율 / 한글 텍스트 오버플로 수정 작업의 최종 산출물.

## 구성

```
publish/
├── README.md                          ← 이 파일
├── KRIDE Intro.html                   ← 프로토타입 (인터랙티브, Tweaks 패널 포함)
├── KRIDE Intro.bundled.html           ← 위 파일의 standalone 번들 (오프라인 동작, 공유용)
├── intro.jsx                          ← 메인 React 컴포넌트
├── ios-frame.jsx                      ← iOS 디바이스 프레임 (보조)
├── tweaks-panel.jsx                   ← Tweaks UI 셸 (보조)
└── production/                        ← 실서비스 적용용 패치 ─────────────
    ├── APPLY.md                       ← 적용 절차 (한글)
    ├── V49__kride_intro1_fit_fix.sql  ← Flyway 마이그레이션
    └── KRIDE.css.append.css           ← KRIDE.css 에 append 할 신규 클래스
```

## 핵심 변경사항

| 문제 | 원인 | 해결 |
|---|---|---|
| 히어로 이미지 좌우/상하 흰 여백 | `max-w-xs h-56 object-contain` 박스 비율 불일치 | `aspect-ratio: 16/10` + `object-fit: cover` |
| 한글 타이틀 음절 단위 줄바꿈 | `text-3xl` + 기본 word-break | `font-size: 28px` + `word-break: keep-all` |
| 버튼이 타이틀 바로 아래 붙음 | `items-center justify-center` + 고정 gap | `margin-top: auto` 로 하단 push |
| 360px 폭 기기에서 텍스트 오버플로 | 큰 타이틀 + 큰 패딩 | 28px 타이틀 + `padding: 4rem 1.5rem 2.25rem` |

## 미리보기

`KRIDE Intro.html` 을 열면:
- **Cinematic split** (기본, 추천)
- **Classic** (V49 가 적용하는 레이아웃)
- **Letterbox** (시네마 바)
- **Typographic** (히어로 없음)
- **⚠ Original** (수정 전 상태, 비교용)

5가지 레이아웃을 Tweaks 패널에서 토글하며 비교할 수 있습니다.
"Side-by-side compare" 토글을 켜면 Before/After 가 나란히 보입니다.

## 적용

`production/APPLY.md` 의 절차대로 진행. 핵심 요약:

1. `KRIDE.css.append.css` 의 내용을 `metadata-project/app/styles/KRIDE.css` 에 append
2. `V49__kride_intro1_fit_fix.sql` 을 `SDUI-server/src/main/resources/db/migration/` 에 배치
3. 백엔드 재시작 (Flyway 자동 적용) → Redis FLUSHDB
4. `/view/KRIDE_INTRO1` 진입 확인

**수정하지 않는 파일:** `next.config.ts`, `globals.css`, `componentMap.tsx`, DynamicEngine 코어.
