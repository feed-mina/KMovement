# SDUI 엔진 기본단위 분해 리팩토링 플랜 (2026-07-08)

> GitHub 트래킹 이슈: [#44](https://github.com/feed-mina/KMovement/issues/44)
> 서브 이슈: [#45 ①정규화](https://github.com/feed-mina/KMovement/issues/45) · [#46 ②렌더분해](https://github.com/feed-mina/KMovement/issues/46) · [#47 ③등록선언화](https://github.com/feed-mina/KMovement/issues/47)
> 리포: feed-mina/KMovement

## 배경

SDUI 엔진(`metadata-project/components/DynamicEngine/`)은 동작하지만, **camelCase/snake_case 이중키 방어코드**와 **단일 거대 렌더 함수**가 취약성의 뿌리다. 순수 함수 기본단위로 쪼개면 나머지 문제 대부분이 해소되고, 진행 중인 #34(STAT_CARD·CHART 추가) 리스크도 낮아진다.

## 조사 결과 — 고도화 지점

| # | 지점 | 근거 | 심각도 |
|---|------|------|--------|
| 1 | 메타 필드 이중키 방어코드 남발 (`node.componentType \|\| node.component_type`) | `type.ts:3-28` 전 필드 이중정의, DynamicEngine 15곳·usePageMetadata 13곳 | 高 |
| 2 | renderNodes 단일 거대 함수 (그룹/리피터/그리드/노드 4책임 혼재) | `DynamicEngine.tsx:27-180` (150줄+) | 高 |
| 3 | 엔진 내 컴포넌트 특수처리 하드코딩 | `DynamicEngine.tsx:162` KRIDE_NEEDS_FORM, :173 ADDRESS_SEARCH_GROUP | 高 |
| 4 | componentMap 수동 래핑 반복 (36× `withRenderTrack(X,"X")`) | `componentMap.tsx:38-71` | 中 |
| 5 | 데이터 페칭 로직 비대 (AUTO_FETCH/DATA_SOURCE/dataSqlKey + 이중키) | `usePageMetadata.tsx` 285줄 | 中 |
| 6 | 엔진/컴포넌트맵 전용 테스트 부재 (32개 중 렌더엔진 직접검증 0) | tests/ | 中 |
| 7 | 접근성 불완전 (리피터 아이템 클릭에 role/tabIndex 없음) | `DynamicEngine.tsx:96-123` vs :144-145 | 中 |
| 8 | 노드별 ErrorBoundary 부재 (컴포넌트 1개 throw → 화면 전체 crash) | 엔진 | 中 |
| 9 | 타입 안정성 부재 (`any` 남발) | `DynamicEngine.tsx:163`, type.ts | 低 |

## 기본단위 분해 후보 (권장 순서 ①→②→③)

### ① normalizeNode 정규화 계층 (#45) — 가장 근본
- 순수 함수로 이중키를 canonical 단일 필드로 흡수. 방어코드 전부 제거.
- 파급 최대·리스크 최소(순수 함수 + 단위 테스트). 백엔드 DTO 케이스 변경에도 안전.
- 산출물: `normalizeNode.ts`(`normalizeNode`/`normalizeTree`), `NormalizedNode` 타입.

### ② renderNodes 순수 함수 분해 (#46)
- `resolveClassName` / `resolveAction` / `renderRepeater` / `renderGridRepeater` / `renderLeaf` / `renderGroup` 분리.
- 함수당 20~40줄, 각 단위 테스트 가능. ① 선행 시 분기 단순화.

### ③ 컴포넌트 등록 선언화 (#47)
- `{ component, needsFormData, needsSetFormData }` 레지스트리로 엔진의 `KRIDE_NEEDS_FORM`/`ADDRESS_SEARCH_GROUP` 하드코딩 제거.
- `withRenderTrack` 자동 래핑으로 36× 중복 문자열 제거.
- 신규 컴포넌트(STAT_CARD/CHART 등)가 엔진 수정 없이 등록만으로 동작 → #34 연계.

## 연계
- #34(마이페이지/관리자/통계) 차트 작업이 ②·③ 영역을 건드림 → ①·③ 선행 시 #34 수월.
- 세 작업 모두 독립적, 증분 적용 가능.

## 진행 규칙 (CLAUDE.md)
- 커밋 전 테스트 실행 (`npm run test`).
- 신규 의존성 미도입. git 커밋/푸시/배포는 사용자가 직접.

## 참고 파일
- `metadata-project/components/DynamicEngine/DynamicEngine.tsx`, `useDynamicEngine.tsx`, `type.ts`
- `metadata-project/components/DynamicEngine/hook/usePageMetadata.tsx`
- `metadata-project/components/constants/componentMap.tsx`
- `metadata-project/components/utils/withRenderTrack`
