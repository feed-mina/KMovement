# 기능 고도화 플랜 — 마이페이지 · 관리자 대시보드 · 통계 시각화 (2026-07-08)

> GitHub 트래킹 이슈: [#34](https://github.com/feed-mina/KMovement/issues/34)
> 서브 이슈: [#35 P0](https://github.com/feed-mina/KMovement/issues/35) · [#36 P1](https://github.com/feed-mina/KMovement/issues/36) · [#37 P2](https://github.com/feed-mina/KMovement/issues/37) · [#38 P3](https://github.com/feed-mina/KMovement/issues/38) · [#39 P4](https://github.com/feed-mina/KMovement/issues/39)
> 리포: feed-mina/KMovement

## 배경

- 마이페이지 화면이 비어 있음 (`metadata-project/components/constants/screenMap.ts:15` 에서 `MY_PAGE` 주석 처리).
- 관리자 통계는 백엔드 API(`/api/admin/goal-dashboard`, `/api/admin/users`)가 있으나 프론트 시각화 계층이 없음.
- 기존 데이터/API를 활용해 마이페이지·관리자 대시보드·통계 시각화를 **SDUI 메타데이터 방식**으로 고도화.

## 현황 조사 결과

### 어드민 계정
- `users` 테이블 `role` 컬럼으로 구분. `role = 'ADMIN'`.
- `SecurityConfig.java:105` — `/api/admin/**` 전체 `hasRole("ADMIN")`.
- 기존 관리자 API 3종: `AdminUserController`(사용자 목록/역할변경/슬랙), `GoalDashboardController`(목표 통계), `SduiAdminController`(SDUI 관리).
- 권한 변경: `PUT /api/admin/users/role`.

### 마이페이지
- 골격만 존재. `screenMap.ts:15-16` 에 `MY_PAGE`, `DASHBOARD_PAGE` 주석 처리 → 화면 없음.
- `KRIDE_MY_LIST`(`/MY_LIST`)는 여행 플랜 결과 화면일 뿐, 개인 통계/히스토리 마이페이지 아님.

### 활용 가능한 데이터
- Spring PG(SDUI_TD): `goal_settings`, `community_post`, `community_animation_jobs`(V55), `users`.
- FastAPI/Supabase: `user_route_history` (여행 이력).

## 아키텍처 결정 (확정)

- **A1 — 차트 렌더링:** 신규 의존성 없이 **자체 경량 SVG 컴포넌트**(bar/line/donut). recharts 등 미도입. (package.json에 차트 라이브러리 없음 확인)
- **A2 — 여행 데이터 경로:** `user_route_history`가 Supabase(FastAPI)에 있어 Spring `query_master`로 못 읽음 → **FastAPI 읽기 전용 집계 엔드포인트 신설**(DB 스키마 변경 없음). Spring `/kride-api/*` 프록시 경유.
- **A3 — userId 바인딩:** ✅ **확인 완료, 백엔드 수정 불필요.**
  - `CommonQueryController.execute()` L74-79 — 인증 사용자에게 `userSqno`/`userId` 자동 주입. SQL에서 `WHERE user_id = :userSqno` 바로 사용 가능.
  - 주의: `DynamicExecutor.executeList`(SELECT)는 누락 파라미터 자동 null 처리 없음(`executeUpdate`에만 있음, L55-65). 비로그인 개인화 SELECT는 예외 → GET catch에서 빈 배열 반환. 마이페이지는 `PROTECTED_SCREENS`라 무관.
  - `CommonQueryController` L54-67 — `required_role` 검증 있음(관리자 SQL에 활용).

## 신규 SDUI 컴포넌트 타입

| component_type | 역할 |
|----------------|------|
| `STAT_CARD` | 단일 숫자 카드 (총 여행 수, 목표 달성률 등) |
| `CHART` | bar / line / donut (css_class로 종류 지정), 자체 SVG |
| `HISTORY_LIST` | 시간순 히스토리 리스트 (Repeater) |
| `GALLERY_GRID` | 추억영상/이미지 썸네일 그리드 |

위치: `metadata-project/components/fields/stats/` → `componentMap.tsx` 등록.
데이터: `DATA_SOURCE` + `data_sql_key` → `/api/execute/{key}` 자동 fetch 패턴 재사용 (`usePageMetadata.tsx`).

## 데이터 계층 (query_master 집계 SQL)

**마이페이지 (Spring PG)**
- `mypage_memory_gallery` — `community_animation_jobs WHERE user_id = :userSqno`
- `mypage_community_activity` — `community_post` 게시글/좋아요/팔로우 카운트
- `mypage_goal_stats` — `goal_settings` 개인 목표 달성률

**마이페이지 여행 히스토리 (FastAPI 신설 — A2)**
- `GET /kride-api/users/{id}/route-history`
- `GET /kride-api/users/{id}/summary`

**관리자 대시보드**
| 지표 | 소스 | 방식 |
|------|------|------|
| 사용자/가입 추이 | `users` (PG) | `admin_signup_trend` |
| 커뮤니티/콘텐츠 | `community_post` | `admin_community_stats` |
| AI·미디어 사용량 | `community_animation_jobs` | `admin_media_usage` |
| 여행 트렌드 | `user_route_history` (Supabase) | FastAPI 집계 (A2) |
| 목표 성공률 | goal-dashboard | 이미 구현됨 — 프론트 연결만 |

## 화면 설계

**마이페이지 (`MY_PAGE`)** — `screenMap.ts` 주석 해제 + `ui_metadata` INSERT + `PROTECTED_SCREENS`
```
[프로필 헤더] 닉네임 · 가입일 · 여행 N회
[STAT_CARD ×3] 총 여행 · 추억영상 · 목표달성률
[CHART donut]  선호 아티스트/지역 비율
[HISTORY_LIST] 내 여행 플랜 타임라인 (재추천 버튼 → INTRO1)
[GALLERY_GRID] 추억영상 갤러리
[커뮤니티 활동] 내 게시글·좋아요
```

**관리자 대시보드 (`ADMIN_DASHBOARD`)** — `PROTECTED_SCREENS` + role=ADMIN
```
[STAT_CARD ×4] 총유저 · 오늘가입 · 여행플랜수 · 영상생성수
[CHART line]   일별 가입/활성 추이
[CHART bar]    인기 아티스트·지역 TOP10
[CHART donut]  AI/미디어 기능별 사용 비율
[CHART bar]    월별 목표 성공률 (goal-dashboard)
[테이블]        최근 가입자 / 역할 변경 (/api/admin/users)
```

## 개발 플랜 (Phase)

| Phase | 이슈 | 선행 | 산출물 | 추정 |
|-------|------|------|--------|------|
| P0 기반 | #35 | — | STAT_CARD·CHART 자체 SVG + componentMap | 0.5d |
| P1 관리자 | #36 | P0 | 기존 API + PG 집계 SQL + ADMIN_DASHBOARD | 1d |
| P2 마이페이지 | #37 | P0 | 추억영상·커뮤니티·목표 + MY_PAGE | 1.5d |
| P3 여행 트렌드 | #38 | P1·P2 | FastAPI 집계 엔드포인트(A2) + HISTORY_LIST | 1.5d |
| P4 UI/UX 마감 | #39 | P1·P2·P3 | 애니메이션·스켈레톤·테마 토큰·빈 상태 | 1d |

권장 순서: P0 → P1(빠른 성과) → P2 → P3 → P4.

## 진행 규칙 (CLAUDE.md — Ask first)
- DB 스키마 변경 전 확인. 마이그레이션 SQL은 우선 `.ai/`에 작성 후 실제 경로(`SDUI-server/src/main/resources/db/migration/`) 이동.
- 신규 의존성 추가 금지(A1 결정으로 차트 라이브러리 미도입).
- git 커밋/푸시/배포는 사용자가 직접 수행.

## 참고 파일
- `metadata-project/components/constants/componentMap.tsx`, `screenMap.ts`
- `metadata-project/app/view/[...slug]/page.tsx` (`PROTECTED_SCREENS`)
- `metadata-project/components/DynamicEngine/hook/usePageMetadata.tsx` (DATA_SOURCE AUTO_FETCH)
- `SDUI-server/.../query/controller/CommonQueryController.java` (userId 주입, required_role)
- `SDUI-server/.../query/repository/DynamicExecutor.java` (executeList 주의)
- `SDUI-server/.../admin/**` (기존 관리자 API)
- `src/api/route_history.py`, `src/api/fastapi_server.py` (여행 이력 A2)
