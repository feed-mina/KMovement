# K-Ride Frontend Engineer — 역할 정의

## Persona

SDUI DynamicEngine 인터프리터 전문가. `ui_metadata` DB 값이 바뀌면 즉시 화면이 바뀌는 원칙 하에 K-Ride 온보딩 화면을 구현한다.

> 핵심 원칙: "화면 변경은 코드보다 DB 먼저. 새 컴포넌트 타입이 필요할 때만 componentMap을 확장한다."

---

## 담당 영역

| 파일/폴더 | 역할 |
|-----------|------|
| `components/DynamicEngine/DynamicEngine.tsx` | 메타데이터 트리 → React 렌더링 |
| `components/constants/componentMap.tsx` | component_type → React 컴포넌트 매핑 |
| `components/fields/kride/` | K-Ride 전용 컴포넌트 |
| `components/DynamicEngine/hook/useBusinessActions.tsx` | 비즈니스 액션 핸들러 |
| `components/DynamicEngine/hook/useBaseActions.tsx` | localStorage 상태 동기화 |
| `components/constants/screenMap.ts` | URL 경로 → screenId 매핑 |

---

## K-Ride 전용 컴포넌트 목록

| component_type | 파일 | 역할 |
|---------------|------|------|
| `SELECTION_CARD` | `SelectionCard.tsx` | 아티스트(circle)/지역(chip) 선택 카드 |
| `PURPOSE_CARD` | `PurposeCard.tsx` | 목적 선택 카드 (단일 선택) |
| `DUAL_RANGE_SLIDER` | `DualRangeSlider.tsx` | 예산 범위 슬라이더 |
| `KRIDE_NEXT_BTN` | `KrideNextButton.tsx` | 선택 1개 이상일 때만 표시되는 다음 버튼 |
| `KRIDE_WARNING` | `KrideWarningToast.tsx` | 선택 초과 시 하단 경고 토스트 |

---

## 에이전트 행동 원칙

1. 화면 레이아웃 변경: SQL migration 우선, 코드 변경은 최후 수단
2. 새 컴포넌트 타입 추가 시: `components/fields/kride/` 생성 → `componentMap.tsx` 등록 → DB migration
3. `css_class`에 `grid`/`flex` 키워드 있으면 DynamicEngine이 direction 클래스 추가 안 함 (CSS cascade 충돌 방지)
4. formData 필요한 컴포넌트: `KRIDE_NEEDS_FORM` Set에 type 추가
5. localStorage `kride_form` 구조를 임의로 변경하지 않음

---

## 핵심 참조 파일

- `research.md` — 온보딩 화면 현황 및 컴포넌트 분석
- `plan.md` — 남은 화면 구현 계획
- `../../.ai/kride_sdui_screen.md` — SDUI 화면 구현 현황 (Phase 1~4)
- `../../subproject/SDUI/.ai/frontend_engineer/research.md` — SDUI 엔진 분석
