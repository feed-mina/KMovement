# K-POP 팬 플랫폼 확장 — Phase 0 실행 플랜 (이슈 #168)

- 기준 커밋: `main` `1c2c60cd9` (2026-07-22 확인)
- 성격: **구현 이슈 아님**. 현행 구조 인벤토리 + 재사용/간극 매트릭스 + ADR + 계약 초안 + P1~P5 후속 이슈 분해를 위한 기획 게이트.
- 확정된 열린 결정: **MVP 1차 타깃 = 국내+해외 동시(ko/en, timezone/통화 범위 확장)**. 나머지 열린 결정은 §7 참조.
- 모든 항목은 아래 조사에서 확인한 **실제 파일·테이블·엔드포인트 근거**에 연결됨. 빌드 성공만으로 완료 처리하지 않음.

> 원칙 재확인: 기존 K-RIDE(Holy/장소·동선·모바일 라우팅·인증·SSE/polling)를 깨지 않는다. 개념 모델(`ui_screen`/`ui_component`/`component_master`)은 확정 스키마가 아니며, 기존 구조로 해결 불가한 간극이 증명되기 전까지 신규 테이블을 만들지 않는다.

---

## A. 현행 인벤토리 (근거 기반)

### A-1. SDUI 메타데이터

| 항목 | 확인된 현행 | 근거 |
| --- | --- | --- |
| 테이블 | `ui_metadata` — `screen_id`, `component_id`, `component_type`, `sort_order`, `group_id`/`parent_group_id`, `ref_data_id`(Repeater), `action_type`/`action_url`, `data_sql_key`/`data_api_url`/`data_params`, `component_props`(jsonb, `showWhen` 조건부 렌더), `allowed_roles`, `label_text_overrides`/`css_class_overrides`, `is_visible` | V22 seed, V36 |
| 서빙 | `GET /api/ui/{screenId}` → `UiController` → `UiService`(flat→tree), Redis 1h 캐시 | `domain/ui/*`, SDUI/CLAUDE.md |
| 웹 렌더러 | `packages/core` 공유 엔진 + `kride/src/engine/componentMap.tsx`(web primitives) | `kride/src/engine/*` |
| 모바일 렌더러 | `kride/apps/mobile/app/[screenId].tsx` + `kride/apps/mobile/src/componentMap.tsx` | 확인됨 |
| 라우팅 | 웹 `PATH_TO_SCREEN`(예: `/my-list`→`KRIDE_MY_LIST`), `SCREEN_IDS`(KRIDE_INTRO1~5, MY_LIST, FOCUS) | `kride/src/engine/screenMap.ts` |
| K-POP 선행 자산 | `BTS_EVENT_MAIN` 화면 + `CHEER_MODE` 컴포넌트(조건부 렌더 `showWhen`) | V36 |

**Phase 0 판단**: `ui_metadata`는 screen/component/repeater/조건부/역할까지 표현력이 충분. K-POP 화면(Home/Explore/AI Find/Events/Community/MY)은 **신규 테이블 없이** screen_id 추가 + 최소 신규 `component_type`으로 표현 가능성이 높음. 부족 필드는 §D-1에서 검증.

### A-2. Query Master (동적 쿼리 실행)

| 항목 | 확인된 현행 | 근거 |
| --- | --- | --- |
| 테이블 | `query_master` — `sql_key`(PK), `query_text`, `return_type`(SINGLE/MULTI/COMMAND), `required_role`, `description`, `use_redis_yn`, `redis_ttl_sec`(기본 3600), `param_mapping`(jsonb) | `QueryMaster.java`, V5, V15 |
| 실행 | `/api/execute/{sqlKey}` GET+POST | `CommonQueryController.java` |
| 인증 주입 | 서버가 인증 주체에서 `userSqno`/`userId`를 params에 **강제 주입**(클라이언트 값 신뢰 안 함) | `CommonQueryController.java:75-79` |
| 역할 검사 | `required_role` 있으면 인증/권한 검증(401/403) | `CommonQueryController.java:54-67` |
| 캐시 | Redis 키 `SQL:{sqlKey}` | `QueryMasterService.getQuery` |

**보안 간극(중요)**:
1. `queryParams`(GET) + `bodyParams`(POST)가 **raw로 병합**되어 그대로 SQL 파라미터로 전달됨. `param_mapping` 컬럼은 스키마에만 존재하고 **코드에서 미사용**(전 저장소 grep 결과 V5 이외 참조 없음) → 파라미터 allowlist/validation **미강제**.
2. GET 실패를 무조건 빈 배열로 삼켜(`:108-115`) 감사/오류 가시성 부족.
3. `getQueryInfo`는 DB 직조회(캐시 없음), `getQuery`만 Redis 캐시 → 경로 이원화.

→ §C-2 ADR에서 결정. 클라이언트가 raw SQL/임의 endpoint/사용자 식별자를 주입할 수 없어야 한다는 원칙은 인증 주입/역할 검사로 부분 충족되나, **파라미터 allowlist 강제는 신규 작업 필요**.

### A-3. 비동기 Job (AI 파이프라인 재사용 후보)

| 항목 | 확인된 현행 | 근거 |
| --- | --- | --- |
| 테이블 | `celery_jobs` — `celery_task_id`(unique), `task_type`, `status`(QUEUED 기본), `result_json`, `error_message`, `progress_step`, `progress_pct`, `requested_by`(소유권), `notif_sent` | `CeleryJob.java` |
| API | `POST /api/v1/celery/jobs/{taskType}`(제출), `GET /jobs/{celeryTaskId}`(상태), `GET /jobs/{celeryTaskId}/ownership` | `CeleryJobController.java` |
| 소유권 | `getOwnedJobStatus(taskId, userSqno)`로 소유자만 조회 | 확인됨 |
| 폴링/갱신 | `CeleryJobPollingScheduler`, `refreshJob` | `celery/scheduler`, service |
| 커뮤니티 애니메이션 | `AnimationJob`(V55/V64/V67/V74) — 배치 컬럼·result metadata·fallback metadata | community domain |
| 알림 | `UnifiedNotificationService` → Kakao + FCM 팬아웃(현재 `AnimationJob`에 결합) | `notification/*`, V60/V63 |

**Phase 0 판단**: AI 착장/굿즈 분석 job은 **신규 테이블 없이 `celery_jobs`의 신규 `task_type`으로 확장 가능**. 단, 상태 머신에 `CANCELLED`/`EXPIRED`, 소스 이미지 소유권/삭제, 재시도 계약은 §D-3에서 명시.

### A-4. 스토리지 / 이미지

| 항목 | 확인된 현행 | 근거 |
| --- | --- | --- |
| S3 | `S3Service` — `S3Client` + `S3Presigner`(presigned GET), SSE-S3 암호화, 타입/크기 검증(현재 이력서: pdf/jpeg/png/webp, 50MB), key `resume/{userId}/{uuid}.{ext}` | `ai/service/S3Service.java` |
| 커뮤니티 이미지 | `post_image.storage_url`(Supabase 업로드) | V40, community |

**Phase 0 판단**: AI 업로드 원본은 `S3Service` 패턴(presigned upload/download + SSE + 소유자 prefix)을 **EXTEND**. 보관/삭제/마스킹 정책은 §C-4/§D-6.

### A-5. 커뮤니티 / 팔로우 / 콘텐츠

| 항목 | 확인된 현행 | 근거 |
| --- | --- | --- |
| 게시글 | `community_post`(author_sqno, like_count, report_count, del_yn), `post_image`, `post_like`, `post_report`(reason_code), `user_follow`(follower/followee) | V40 |
| API | `/api/v1/community/**`(CRUD/좋아요/신고/팔로우/이미지) | community controller, SDUI/CLAUDE.md |
| 콘텐츠 | `Content`/`ContentRepository`, `content` 테이블(diary→content 마이그레이션, is_private) | content domain, V2/V3/V31 |
| 최신 마이그레이션 | Flyway **V81**(holy_poi_image_attribution). K-POP 신규는 **V82~**부터 | migration 디렉터리 |

**Phase 0 판단**: `user_follow`는 사용자↔사용자 팔로우. **아티스트 팔로우는 대상 타입이 다르므로**(user→artist) 그대로 재사용 불가 → EXTEND/NEW 판단은 §B. 커뮤니티 게시글/댓글/신고는 MVP에서 REUSE_AS_IS 후보.

### A-6. 인증 / 권한 / 감사

| 항목 | 확인된 현행 | 근거 |
| --- | --- | --- |
| 인증 | JWT(`JwtAuthenticationFilter`, `JwtUtil`), Kakao OAuth | `global/security`, `domain/user` |
| 역할 | `required_role`/`allowed_roles`(ROLE_USER/ROLE_ADMIN) | query_master, ui_metadata |
| 관리자 | `domain/admin`(dashboard/stats/logs SDUI) | V12~V18, V71 |
| 감사 로그 | 관리자 logs query 존재하나 execute 경로의 파라미터/실패 감사 표준 없음 | A-2 간극 |

### A-7. #10 / #91 대비 변경 (재검증 필요 항목)

- 조사 시점 `main` 최신 마이그레이션은 **V81**. #10/#91 이후 추가된 것: tour/holy POI(V75~V81), theme/design tokens(V68/V69), admin SDUI(V71~V73), community animation(V55~V74). → P1 착수 전 #10/#91 문서를 열어 위 항목의 표 값을 최신화(별도 확인 필요, 본 Phase 0 산출물의 후속 체크로 표기).

---

## B. 재사용 / 간극 매트릭스

상태: `REUSE_AS_IS` · `EXTEND` · `NEW` · `OUT_OF_SCOPE`

| # | 요구 엔티티 | 상태 | 근거 / 방침 |
| --- | --- | --- | --- |
| 1 | Artist | **NEW** | 유사 도메인 없음. 신규 `artist` 테이블(다국어 이름·프로필·공식링크). SDUI 표현은 ui_metadata 재사용 |
| 2 | Follow(Artist) | **EXTEND** | `user_follow`는 user→user. `artist_follow`(user_sqno, artist_id) 신설 or `follow_target_type` 도입. 아티스트-사용자 팔로우는 별 관계이므로 신규 테이블 권장 |
| 3 | Event | **EXTEND** | `BTS_EVENT_MAIN`(V36)은 SDUI 화면일 뿐 범용 event 데이터 모델 아님 → 범용 `event`(artist_id FK, region, date, official_url) 신설. SDUI는 재사용 |
| 4 | Bookmark(Event) | **NEW** | `post_like` 패턴 참조하되 대상이 event → `event_bookmark`(user_sqno, event_id) |
| 5 | ContentLink | **EXTEND** | `content` 테이블 존재하나 공식 출처 링크/embed 정책 필드 없음. 링크·출처·권리·갱신 컬럼 확장 or 신규 `content_link` |
| 6 | MediaAsset | **EXTEND** | `S3Service`(presigned+SSE) + `post_image` 패턴 재사용. 소유자 prefix·만료·삭제 계약 추가 |
| 7 | AnalysisJob | **EXTEND** | `celery_jobs`에 신규 `task_type`(예: `KPOP_OUTFIT_ANALYSIS`). 상태에 CANCELLED/EXPIRED, source 소유권/삭제 추가 |
| 8 | AnalysisResult | **EXTEND** | `celery_jobs.result_json` 재사용 + 결과 등급 스키마(§D-5). 대량/검색 필요 시에만 별도 테이블 승격 |
| 9 | ProductCandidate | **NEW** | catalog/evidence grading 신설. provider·가격·재고는 열린 결정(§7). P3 |
| 10 | SavedItem | **NEW** | `POST /saved-items`. 아티스트/이벤트/제품 후보를 다형 저장(`item_type`, `item_ref`) |
| 11 | CommunityPost/Comment/Report | **REUSE_AS_IS** | `community_post`/`post_report` 재사용. 댓글 테이블 존재 여부는 P4 착수 시 확인(현재 확인된 것은 post/like/report/follow) |
| 12 | Notification | **EXTEND** | `UnifiedNotificationService`(Kakao+FCM) 재사용. 현재 `AnimationJob` 결합 → event/artist 알림용 일반화. 등록/동의/발송실패 최소 계약(§D-2 알림) |
| 13 | SDUI Screen/Component | **REUSE_AS_IS(+최소 NEW 컴포넌트)** | `ui_metadata`+componentMap 재사용. Artist/Event 카드·AI 결과·evidence 배지 등 최소 신규 `component_type`만 추가 |

> 각 상태는 P1~P5 이슈에서 실제 migration/endpoint/테스트로 재검증. `celery_jobs` 확장이 곧 완료를 의미하지 않음.

---

## C. ADR 결정 (초안·권장안)

각 ADR은 후속 PR에서 `docs/` 또는 `.ai/adr/`에 확정 기록.

### C-1. SDUI 계층을 기존 `ui_metadata`로 유지할지
**결정(권장): 유지.** 개념 모델(`ui_screen`/`ui_component`/`component_master`) 신규 테이블 도입하지 않음. `ui_metadata`가 screen/component/repeater/조건부(showWhen)/역할까지 커버. 부족 필드가 §D-1 계약에서 증명될 때만 컬럼 추가(migration).

### C-2. Query Master(SQL) vs API/handler registry 경계
**결정(권장): 현 SQL Query Master 유지 + 별도 안전장치 강화.** 이유: 이미지 분석/스트리밍/외부 provider 호출 같은 런타임 로직 큰 기능은 SQL로 표현 불가하므로 **`query_master`에 억지로 합치지 않고** 명시적 코드 컨트롤러(`/api/v1/kpop/...`)로 구현. 단 조회성 데이터는 `query_master` 재사용.
필수 후속:
- `param_mapping`(jsonb)을 **실제 강제**하는 파라미터 allowlist/타입 validation 구현(현재 미사용).
- execute 실패 무음화(빈 배열) 대신 감사 로그 + 표준 에러.
- 외부 API/handler를 query_master에 넣는 확장은 **채택 안 함**(datasource/cache 타입 명시 없이 SQL 테이블과 혼용 위험).

### C-3. canonical DB vs 검색/vector index source-of-truth
**결정(권장): PostgreSQL이 source of truth, vector index는 파생.** 기존 RAG 스택(ChromaDB, `multilingual-e5-small`) 재사용 후보. 제품 후보 검색용 embedding/vector store 선택·재색인 전략은 P3 열린 결정.

### C-4. object storage / signed upload·download / 원본 이미지 보관·삭제
**결정(권장): `S3Service` presigned + SSE-S3 확장.** key `kpop-analysis/{userSqno}/{uuid}.{ext}`. 기본 보관 기간은 열린 결정(§7)이나 **분석 완료 후 원본 삭제 옵션 + 명시적 삭제 API**를 계약에 포함(§D-6). 로그 마스킹·학습 재사용 금지 명문화.

### C-5. AI model/service 경계와 결과 등급
**결정(권장): FastAPI/Celery 파이프라인(기존)로 분리, 등급 3단계.** `EXACT_CANDIDATE` / `SIMILAR` / `INSUFFICIENT_EVIDENCE`. 근거(evidence)·confidence를 결과에 항상 포함. 근거 부족 시 "정확한 제품" 단정 금지(제외 범위).

### C-6. 상품 catalog·가격·재고 provider
**결정: 열린 상태(§7).** MVP는 무제한 실시간 가격 크롤링 제외. provider 확정 전까지 ProductCandidate는 "유사 아이템 + 근거 수준 + 공식/허용 링크"만 노출.

### C-7. 공연/이벤트/공식 콘텐츠 출처·링크·embed 권리
**결정(권장): 공식 링크 중심, embed/thumbnail은 제공자 정책·권한 확인 시에만.** 각 콘텐츠에 출처·권리·갱신 기준 메타 저장. 무단 복제/재호스팅 금지(제외 범위).

### C-8. 관리자 검수·신고 상태 전이
**결정(권장): `domain/admin` 재사용 + 상태 전이 표준화.** 아티스트/이벤트/제품후보/신고: `PENDING → APPROVED/REJECTED`, 신고: `OPEN → REVIEWING → RESOLVED/DISMISSED`. 검수 주체·SLA는 열린 결정(§7).

### C-9. 다국어·timezone·통화 (MVP 범위)
**결정: 국내+해외 동시 → ko/en 동시 지원.** 아티스트/이벤트 텍스트 다국어 필드(최소 ko/en), 이벤트 시간은 UTC 저장 + 지역 timezone 표기, 통화는 표시용 코드 포함(결제 없음). SDUI `label_text_overrides`로 다국어 라벨 일부 흡수 가능성 검증.

---

## D. 계약 초안

### D-1. SDUI metadata / 컴포넌트
- 신규 screen_id 후보: `KPOP_HOME`, `KPOP_EXPLORE`, `KPOP_ARTIST_DETAIL`, `KPOP_EVENTS`, `KPOP_EVENT_DETAIL`, `KPOP_AI_FIND`, `KPOP_AI_RESULT`, `KPOP_COMMUNITY`, `KPOP_MY`.
- route 충돌 확인 필요: 웹 `PATH_TO_SCREEN`/모바일 라우팅과 `/explore` `/events` `/ai-find` 신규 경로 충돌 여부(P1 착수 시).
- 최소 신규 `component_type`(웹+모바일 componentMap 동시 등록): `ARTIST_CARD`, `EVENT_CARD`, `EVIDENCE_BADGE`(등급 표시), `UPLOAD_CONSENT`(동의), `AI_RESULT_CARD`. 이미지/업로드/진행상태처럼 런타임 큰 컴포넌트는 코드 컴포넌트 + 명시 API 계약(metadata는 조합/설정만).

### D-2. `/api/v1/kpop/...` 후보 엔드포인트 (권한: 사용자 자원은 서버가 소유권 검증, 임의 userId 불신뢰)
| Method | Path | 용도 | 인증 |
| --- | --- | --- | --- |
| GET | `/api/v1/kpop/artists` | 목록/필터 | 공개 |
| GET | `/api/v1/kpop/artists/{artistId}` | 상세 | 공개 |
| POST/DELETE | `/api/v1/kpop/artists/{artistId}/follow` | 팔로우 | ROLE_USER |
| GET | `/api/v1/kpop/events` | 목록(지역/날짜 필터) | 공개 |
| GET | `/api/v1/kpop/events/{eventId}` | 상세 | 공개 |
| POST | `/api/v1/kpop/events/{eventId}/bookmark` | 북마크 | ROLE_USER |
| POST | `/api/v1/kpop/analysis-jobs` | 분석 요청(동의 필수) | ROLE_USER |
| GET | `/api/v1/kpop/analysis-jobs/{jobId}` | 상태/결과 | 소유자 |
| GET | `/api/v1/kpop/analysis-jobs/{jobId}/stream` | SSE 진행 | 소유자 |
| DELETE | `/api/v1/kpop/analysis-jobs/{jobId}/source` | 원본 삭제 | 소유자 |
| POST | `/api/v1/kpop/saved-items` | 후보/아이템 저장 | ROLE_USER |
- 조회성(artists/events 목록·상세)은 `query_master` sql_key로도 구현 가능. 소유권/동의/스트리밍/외부호출은 코드 컨트롤러(C-2).
- 알림 최소 계약: **등록 / 수신 동의 / 발송 실패**를 구분하는 상태 필드부터 정의(발송 자체는 후속).

### D-3. 비동기 Job 상태 머신
`QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED | EXPIRED`
- `celery_jobs` 재사용. 추가 필요: `CANCELLED`/`EXPIRED` 처리, source asset 소유권/만료, 재시도 정책(idempotency key). SSE 우선 + polling fallback(기존 패턴 준용).

### D-4. Redis namespace / TTL / invalidation
- Redis는 **source of truth 아님**(PostgreSQL이 진실 원천). 가속/상태 계층만.
- 기존: `SQL:{sqlKey}`(쿼리 캐시), ui 메타 1h 캐시.
- 신규 제안: `kpop:meta:{screenId}`(TTL 3600, 변경 시 invalidation), `kpop:job:progress:{jobId}`(진행), `kpop:result:{jobId}`(결과 캐시 짧은 TTL), `kpop:rate:{userSqno}:{action}`(rate limit), `kpop:idem:{key}`(dedup). 각 key는 TTL·무효화·장애 시 DB fallback 정의.

### D-5. AI 결과 등급 / evidence serialization
```json
{
  "grade": "EXACT_CANDIDATE | SIMILAR | INSUFFICIENT_EVIDENCE",
  "confidence": 0.0,
  "evidence": [{ "type": "visual_match|brand_text|metadata", "score": 0.0, "source": "..." }],
  "candidates": [{ "productRef": "...", "grade": "...", "officialLink": "...", "rightsChecked": true }]
}
```
- 근거 부족(`INSUFFICIENT_EVIDENCE`)은 제품 단정 금지.

### D-6. 사용자 데이터 삭제·보존·감사
- 업로드 동의 기록(who/when/scope), 원본 보관 기간(열린 결정), 삭제 API + 실제 스토리지 삭제, 접근 통제(소유자/관리자), 로그 마스킹, 모델 학습 재사용 금지.
- 감사 이벤트: 업로드/분석요청/결과조회/삭제/관리자검수.

---

## E. 후속 실행 이슈 분해 (P1~P5)

의존 순서대로 생성. 각 이슈는 migration/API/SDUI 변경, 테스트, 배포·QA 증거를 완료 조건에 포함. build 성공이 아닌 실제 route/API/job/브라우저/모바일 증거로 종료.

> **생성 완료 (2026-07-22)**: P1 #169 · P2 #170 · P3 #171 · P4 #172 · P5 #173 (부모 #168)

### P1 (#169) — Artist/Event 기반 (의존: 없음)
- 범위: `artist`/`event`/`artist_follow`/`event_bookmark` migration(V82~), 조회 API(query_master or 코드), admin seed(초기 아티스트/이벤트 — seed 책임 §7), SDUI 목록/상세(KPOP_EXPLORE/ARTIST_DETAIL/EVENTS/EVENT_DETAIL) + ARTIST_CARD/EVENT_CARD 컴포넌트(웹+모바일), 팔로우/북마크.
- 다국어: ko/en 필드 포함(C-9).
- 완료 조건: 웹+Android에서 목록·상세·팔로우·북마크 실제 동작, API 응답/역할 검증, 신규 route 충돌 없음 확인.

### P2 (#170) — AI async skeleton (의존: #169의 인증/스토리지 패턴)
- 범위: consent 기록, presigned upload(S3Service EXTEND), `celery_jobs` 신규 task_type, status/SSE+polling, result shell(등급 스키마), source delete API.
- 완료 조건: 업로드→job 제출→진행(SSE/폴백)→결과 shell→삭제 전 과정 실동작, 소유권 검증, 원본 삭제가 스토리지에 반영.

### P3 (#171) — Product candidate / search (의존: #170)
- 범위: catalog source 결정, evidence grading, vector index(source-of-truth=PG), SavedItem.
- 완료 조건: 분석 결과에 후보+근거 등급 노출, 저장/조회, 근거 부족 케이스 처리.

### P4 (#172) — Community / operations (의존: #169)
- 범위: `community_post`/`post_report` 재사용, 댓글 존재 확인/보강, 아티스트·이벤트·제품후보·신고 관리자 검수 상태 전이(C-8), 감사 로그.
- 완료 조건: 게시/댓글/신고/검수 흐름 실동작, 관리자 검수 상태 전이·감사 기록.

### P5 (#173) — Hardening / release (의존: #169~#172)
- 범위: Redis cache/TTL/invalidation, rate limit, param allowlist 강제(C-2), 접근성, observability, 웹·Android QA, 배포 검증.
- 완료 조건: QA 계획(§QA) 통과, 실제 배포 환경별 적용 확인.

---

## QA 계획 (요약)

- 확인 route: 신규 KPOP_* screen_id ↔ 웹 `PATH_TO_SCREEN`/모바일 `[screenId].tsx`.
- fixture: artist/event seed, 분석 job mock(SSE 이벤트 시퀀스), 결과 등급 3종.
- API 응답: 200/401/403, 소유권 위반 케이스, execute 파라미터 allowlist 위반 케이스.
- SSE/polling fallback: SSE 끊김 시 폴링 전환 검증(기존 celery 패턴 준용).
- 접근성: 카드/배지/업로드 컴포넌트 키보드·스크린리더.
- 다국어: ko/en 라벨·날짜/timezone 표기.

---

## 7. 열린 결정 사항 (업데이트)

- ✅ **MVP 1차 타깃**: 국내+해외 동시(ko/en) — 확정.
- ⬜ 최초 지원 아티스트/이벤트 범위와 seed 책임.
- ⬜ 공식 콘텐츠 링크/thumbnail/embed 허용 범위(제공자별).
- ⬜ 상품 catalog/가격/재고 provider와 운영 비용.
- ⬜ 원본 이미지 object storage 기본 보관 기간.
- ⬜ embedding/model/vector store 선택 및 재색인 전략(ChromaDB/e5 재사용 여부).
- ✅ **Query Master**: SQL 전용 유지 + param allowlist 강제 신규(§C-2) — 권장 확정, ADR 승인 대기.
- ⬜ 관리자 검수 주체와 SLA.
- ✅ **다국어/timezone/통화 첫 출시 범위**: ko/en + UTC 저장/지역 표기 + 표시용 통화(결제 없음) — 권장 확정.

---

## 제외 범위(재확인)
공식 SNS/영상/사진 자동 복제·재업로드, 전체 영상 다운로드·무제한 프레임 추출, 근거 부족 제품 단정, 무제한 실시간 가격 크롤링, P2P 중고거래·결제, 전체 K-RIDE 재설계, Phase 0에서 대형 신규 schema/API/UI 즉시 구현, 명시적 동의 없는 얼굴 식별/사용자 이미지 학습 재사용.

## 작업 원칙(재확인)
기존 dirty worktree·`ASK/`·`Todo/`·활성 브랜치 보존. 한 이슈/PR은 독립 검증 가능 범위. migration/backend/metadata/web/mobile/deploy 각각 확인, 실행 증거 없이 완료 처리 금지. 문서·코드·테스트 불일치 시 갱신 기준·책임자 기록.
