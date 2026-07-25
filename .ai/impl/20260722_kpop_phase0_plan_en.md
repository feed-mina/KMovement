# K-POP Fan Platform Expansion — Phase 0 Execution Plan (Issue #168)

- Base commit: `main` `1c2c60cd9` (verified 2026-07-22)
- Nature: **Not an implementation issue.** This is a planning gate for: current structure inventory + reuse/gap matrix + ADR + contract drafts + P1–P5 follow-up issue decomposition.
- Confirmed open decision: **MVP primary target = domestic + international simultaneously (ko/en, timezone/currency scope expanded)**. Remaining open decisions in §7.
- All items are linked to **actual file/table/endpoint evidence** verified during the investigation below. Completion is not declared on build success alone.

> Principle reaffirmed: Do not break existing K-RIDE (Holy/place·route·mobile routing·auth·SSE/polling fallback). Conceptual models (`ui_screen`/`ui_component`/`component_master`) are not finalized schemas; new tables must not be created until gaps are proven that cannot be resolved with existing structures.

---

## A. Current Inventory (Evidence-Based)

### A-1. SDUI Metadata

| Item | Verified Current State | Evidence |
| --- | --- | --- |
| Table | `ui_metadata` — `screen_id`, `component_id`, `component_type`, `sort_order`, `group_id`/`parent_group_id`, `ref_data_id` (Repeater), `action_type`/`action_url`, `data_sql_key`/`data_api_url`/`data_params`, `component_props` (jsonb, `showWhen` conditional render), `allowed_roles`, `label_text_overrides`/`css_class_overrides`, `is_visible` | V22 seed, V36 |
| Serving | `GET /api/ui/{screenId}` → `UiController` → `UiService` (flat→tree), Redis 1h cache | `domain/ui/*`, SDUI/CLAUDE.md |
| Web renderer | `packages/core` shared engine + `kride/src/engine/componentMap.tsx` (web primitives) | `kride/src/engine/*` |
| Mobile renderer | `kride/apps/mobile/app/[screenId].tsx` + `kride/apps/mobile/src/componentMap.tsx` | Confirmed |
| Routing | Web `PATH_TO_SCREEN` (e.g. `/my-list`→`KRIDE_MY_LIST`), `SCREEN_IDS` (KRIDE_INTRO1~5, MY_LIST, FOCUS) | `kride/src/engine/screenMap.ts` |
| K-POP prior assets | `BTS_EVENT_MAIN` screen + `CHEER_MODE` component (conditional render `showWhen`) | V36 |

**Phase 0 Judgment**: `ui_metadata` has sufficient expressiveness for screen/component/repeater/conditional/roles. K-POP screens (Home/Explore/AI Find/Events/Community/MY) can likely be expressed **without new tables** by adding screen_ids + minimal new `component_type`s. Missing fields verified in §D-1.

### A-2. Query Master (Dynamic Query Execution)

| Item | Verified Current State | Evidence |
| --- | --- | --- |
| Table | `query_master` — `sql_key` (PK), `query_text`, `return_type` (SINGLE/MULTI/COMMAND), `required_role`, `description`, `use_redis_yn`, `redis_ttl_sec` (default 3600), `param_mapping` (jsonb) | `QueryMaster.java`, V5, V15 |
| Execution | `/api/execute/{sqlKey}` GET+POST | `CommonQueryController.java` |
| Auth injection | Server **force-injects** `userSqno`/`userId` from auth principal into params (does not trust client values) | `CommonQueryController.java:75-79` |
| Role check | If `required_role` present, validates auth/authorization (401/403) | `CommonQueryController.java:54-67` |
| Cache | Redis key `SQL:{sqlKey}` | `QueryMasterService.getQuery` |

**Security Gaps (Important)**:
1. `queryParams` (GET) + `bodyParams` (POST) are **merged raw** and passed directly as SQL parameters. The `param_mapping` column exists in the schema but **is unused in code** (repo-wide grep found no references outside V5) → parameter allowlist/validation **not enforced**.
2. GET failures are silently swallowed as empty arrays (`:108-115`) — insufficient audit/error visibility.
3. `getQueryInfo` hits DB directly (no cache), only `getQuery` uses Redis cache → dual-path inconsistency.

→ Decision in §C-2 ADR. The principle that clients must not be able to inject raw SQL/arbitrary endpoints/user identifiers is partially met by auth injection/role checks, but **parameter allowlist enforcement requires new work**.

### A-3. Async Jobs (AI Pipeline Reuse Candidate)

| Item | Verified Current State | Evidence |
| --- | --- | --- |
| Table | `celery_jobs` — `celery_task_id` (unique), `task_type`, `status` (QUEUED default), `result_json`, `error_message`, `progress_step`, `progress_pct`, `requested_by` (ownership), `notif_sent` | `CeleryJob.java` |
| API | `POST /api/v1/celery/jobs/{taskType}` (submit), `GET /jobs/{celeryTaskId}` (status), `GET /jobs/{celeryTaskId}/ownership` | `CeleryJobController.java` |
| Ownership | `getOwnedJobStatus(taskId, userSqno)` — only owner can query | Confirmed |
| Polling/refresh | `CeleryJobPollingScheduler`, `refreshJob` | `celery/scheduler`, service |
| Community animation | `AnimationJob` (V55/V64/V67/V74) — batch columns, result metadata, fallback metadata | community domain |
| Notifications | `UnifiedNotificationService` → Kakao + FCM fan-out (currently coupled to `AnimationJob`) | `notification/*`, V60/V63 |

**Phase 0 Judgment**: AI outfit/goods analysis jobs can be **extended using a new `task_type` on existing `celery_jobs` without new tables**. However, state machine `CANCELLED`/`EXPIRED`, source image ownership/deletion, and retry contracts must be specified in §D-3.

### A-4. Storage / Images

| Item | Verified Current State | Evidence |
| --- | --- | --- |
| S3 | `S3Service` — `S3Client` + `S3Presigner` (presigned GET), SSE-S3 encryption, type/size validation (currently resume: pdf/jpeg/png/webp, 50MB), key `resume/{userId}/{uuid}.{ext}` | `ai/service/S3Service.java` |
| Community images | `post_image.storage_url` (Supabase upload) | V40, community |

**Phase 0 Judgment**: AI upload originals should **EXTEND** the `S3Service` pattern (presigned upload/download + SSE + owner prefix). Retention/deletion/masking policies in §C-4/§D-6.

### A-5. Community / Follow / Content

| Item | Verified Current State | Evidence |
| --- | --- | --- |
| Posts | `community_post` (author_sqno, like_count, report_count, del_yn), `post_image`, `post_like`, `post_report` (reason_code), `user_follow` (follower/followee) | V40 |
| API | `/api/v1/community/**` (CRUD/like/report/follow/image) | community controller, SDUI/CLAUDE.md |
| Content | `Content`/`ContentRepository`, `content` table (diary→content migration, is_private) | content domain, V2/V3/V31 |
| Latest migration | Flyway **V81** (holy_poi_image_attribution). K-POP new migrations start from **V82** | migration directory |

**Phase 0 Judgment**: `user_follow` is a user↔user follow relationship. **Artist follow has a different target type** (user→artist) and cannot be reused as-is → EXTEND/NEW decision in §B. Community posts/comments/reports are REUSE_AS_IS candidates for MVP.

### A-6. Auth / Authorization / Audit

| Item | Verified Current State | Evidence |
| --- | --- | --- |
| Auth | JWT (`JwtAuthenticationFilter`, `JwtUtil`), Kakao OAuth | `global/security`, `domain/user` |
| Roles | `required_role`/`allowed_roles` (ROLE_USER/ROLE_ADMIN) | query_master, ui_metadata |
| Admin | `domain/admin` (dashboard/stats/logs SDUI) | V12~V18, V71 |
| Audit logs | Admin logs query exists, but no standard parameter/failure audit on execute path | A-2 gap |

### A-7. Changes Since #10 / #91 (Items Needing Re-verification)

- Latest migration on `main` at investigation time: **V81**. Added since #10/#91: tour/holy POI (V75~V81), theme/design tokens (V68/V69), admin SDUI (V71~V73), community animation (V55~V74). → Before starting P1, re-open #10/#91 documents and update table values with latest state (separate verification needed; flagged as follow-up check in this Phase 0 deliverable).

---

## B. Reuse / Gap Matrix

Status: `REUSE_AS_IS` · `EXTEND` · `NEW` · `OUT_OF_SCOPE`

| # | Required Entity | Status | Evidence / Policy |
| --- | --- | --- | --- |
| 1 | Artist | **NEW** | No similar domain. New `artist` table (multilingual name, profile, official links). SDUI representation reuses ui_metadata |
| 2 | Follow (Artist) | **EXTEND** | `user_follow` is user→user. Create `artist_follow` (user_sqno, artist_id) or introduce `follow_target_type`. New table recommended as artist-user follow is a different relationship |
| 3 | Event | **EXTEND** | `BTS_EVENT_MAIN` (V36) is a SDUI screen, not a generic event data model → create generic `event` (artist_id FK, region, date, official_url). Reuse SDUI |
| 4 | Bookmark (Event) | **NEW** | Reference `post_like` pattern but target is event → `event_bookmark` (user_sqno, event_id) |
| 5 | ContentLink | **EXTEND** | `content` table exists but lacks official source link/embed policy fields. Extend with link/source/rights/refresh columns or create new `content_link` |
| 6 | MediaAsset | **EXTEND** | Reuse `S3Service` (presigned+SSE) + `post_image` pattern. Add owner prefix, expiry, deletion contract |
| 7 | AnalysisJob | **EXTEND** | New `task_type` on `celery_jobs` (e.g. `KPOP_OUTFIT_ANALYSIS`). Add CANCELLED/EXPIRED states, source ownership/deletion |
| 8 | AnalysisResult | **EXTEND** | Reuse `celery_jobs.result_json` + result grading schema (§D-5). Promote to separate table only if bulk/search is needed |
| 9 | ProductCandidate | **NEW** | New catalog/evidence grading. Provider, price, inventory are open decisions (§7). P3 |
| 10 | SavedItem | **NEW** | `POST /saved-items`. Polymorphic storage for artist/event/product candidates (`item_type`, `item_ref`) |
| 11 | CommunityPost/Comment/Report | **REUSE_AS_IS** | Reuse `community_post`/`post_report`. Verify comment table existence at P4 start (currently confirmed: post/like/report/follow) |
| 12 | Notification | **EXTEND** | Reuse `UnifiedNotificationService` (Kakao+FCM). Decouple from `AnimationJob` → generalize for event/artist notifications. Define minimum contract (register/consent/delivery failure) (§D-2 notifications) |
| 13 | SDUI Screen/Component | **REUSE_AS_IS (+minimal NEW components)** | Reuse `ui_metadata` + componentMap. Add only minimal new `component_type`s for Artist/Event cards, AI result, evidence badge |

> Each status is re-verified in P1–P5 issues with actual migrations/endpoints/tests. Extending `celery_jobs` does not equal completion.

---

## C. ADR Decisions (Draft / Recommended)

Each ADR to be finalized in subsequent PRs under `docs/` or `.ai/adr/`.

### C-1. Maintain SDUI hierarchy with existing `ui_metadata`
**Decision (recommended): Maintain.** Do not introduce conceptual model (`ui_screen`/`ui_component`/`component_master`) as new tables. `ui_metadata` covers screen/component/repeater/conditional (showWhen)/roles. Add columns only when gaps are proven in §D-1 contracts (via migration).

### C-2. Query Master (SQL) vs API/handler registry boundary
**Decision (recommended): Maintain current SQL Query Master + add separate safety measures.** Rationale: Features with heavy runtime logic such as image analysis/streaming/external provider calls cannot be expressed in SQL, so **do not force them into `query_master`** — implement them as explicit code controllers (`/api/v1/kpop/...`). Read-only data can still reuse `query_master`.
Required follow-up:
- Implement parameter allowlist/type validation that **actually enforces** `param_mapping` (jsonb) (currently unused).
- Replace silent GET failure (empty array) with audit log + standard error.
- Extension to add external APIs/handlers into query_master is **not adopted** (risk of mixing with SQL table without explicit datasource/cache type).

### C-3. Canonical DB vs search/vector index source-of-truth
**Decision (recommended): PostgreSQL is source of truth, vector index is derived.** Existing RAG stack (ChromaDB, `multilingual-e5-small`) is a reuse candidate. Embedding/vector store selection and re-indexing strategy for product candidate search are P3 open decisions.

### C-4. Object storage / signed upload·download / original image retention·deletion
**Decision (recommended): Extend `S3Service` presigned + SSE-S3.** Key: `kpop-analysis/{userSqno}/{uuid}.{ext}`. Default retention period is an open decision (§7), but **source deletion option after analysis completion + explicit deletion API** must be included in the contract (§D-6). Formalize log masking and prohibition of model training reuse.

### C-5. AI model/service boundary and result grading
**Decision (recommended): Separate into FastAPI/Celery pipeline (existing), 3-tier grading.** `EXACT_CANDIDATE` / `SIMILAR` / `INSUFFICIENT_EVIDENCE`. Always include evidence and confidence in results. Prohibit asserting "exact product" when evidence is insufficient (exclusion scope).

### C-6. Product catalog, price, inventory provider
**Decision: Open (§7).** MVP excludes unlimited real-time price crawling. Until provider is confirmed, ProductCandidate exposes only "similar items + evidence level + official/permitted links."

### C-7. Performance/event/official content source, link, embed rights
**Decision (recommended): Official link-centric; embed/thumbnail only when provider policy/rights are confirmed.** Store source, rights, and refresh criteria metadata for each content item. Unauthorized replication/re-hosting prohibited (exclusion scope).

### C-8. Admin review and report state transitions
**Decision (recommended): Reuse `domain/admin` + standardize state transitions.** Artist/event/product candidate/report: `PENDING → APPROVED/REJECTED`, report: `OPEN → REVIEWING → RESOLVED/DISMISSED`. Reviewer identity and SLA are open decisions (§7).

### C-9. Multilingual, timezone, currency (MVP scope)
**Decision: Domestic + international simultaneously → ko/en dual support.** Multilingual fields for artist/event text (minimum ko/en), event times stored in UTC + displayed in local timezone, currency includes display code (no payment). Verify feasibility of absorbing multilingual labels via SDUI `label_text_overrides`.

---

## D. Contract Drafts

### D-1. SDUI metadata / components
- New screen_id candidates: `KPOP_HOME`, `KPOP_EXPLORE`, `KPOP_ARTIST_DETAIL`, `KPOP_EVENTS`, `KPOP_EVENT_DETAIL`, `KPOP_AI_FIND`, `KPOP_AI_RESULT`, `KPOP_COMMUNITY`, `KPOP_MY`.
- Route conflict verification needed: Check if new routes `/explore` `/events` `/ai-find` conflict with web `PATH_TO_SCREEN`/mobile routing (at P1 start).
- Minimal new `component_type`s (register in both web+mobile componentMap): `ARTIST_CARD`, `EVENT_CARD`, `EVIDENCE_BADGE` (grade display), `UPLOAD_CONSENT` (consent), `AI_RESULT_CARD`. Components with heavy runtime logic (image/upload/progress) → code components + explicit API contract (metadata for composition/configuration only).

### D-2. `/api/v1/kpop/...` Candidate Endpoints (Auth: server verifies ownership for user resources, does not trust arbitrary userId)

| Method | Path | Purpose | Auth |
| --- | --- | --- | --- |
| GET | `/api/v1/kpop/artists` | List/filter | Public |
| GET | `/api/v1/kpop/artists/{artistId}` | Detail | Public |
| POST/DELETE | `/api/v1/kpop/artists/{artistId}/follow` | Follow | ROLE_USER |
| GET | `/api/v1/kpop/events` | List (region/date filter) | Public |
| GET | `/api/v1/kpop/events/{eventId}` | Detail | Public |
| POST | `/api/v1/kpop/events/{eventId}/bookmark` | Bookmark | ROLE_USER |
| POST | `/api/v1/kpop/analysis-jobs` | Analysis request (consent required) | ROLE_USER |
| GET | `/api/v1/kpop/analysis-jobs/{jobId}` | Status/result | Owner only |
| GET | `/api/v1/kpop/analysis-jobs/{jobId}/stream` | SSE progress | Owner only |
| DELETE | `/api/v1/kpop/analysis-jobs/{jobId}/source` | Delete original | Owner only |
| POST | `/api/v1/kpop/saved-items` | Save candidate/item | ROLE_USER |

- Read-only data (artists/events list·detail) can also be implemented via `query_master` sql_key. Ownership/consent/streaming/external calls use code controllers (C-2).
- Minimum notification contract: define status fields that distinguish **registration / consent / delivery failure** first (actual delivery is follow-up).

### D-3. Async Job State Machine
`QUEUED → RUNNING → SUCCEEDED | FAILED | CANCELLED | EXPIRED`
- Reuse `celery_jobs`. Required additions: `CANCELLED`/`EXPIRED` handling, source asset ownership/expiry, retry policy (idempotency key). SSE first + polling fallback (follow existing pattern).

### D-4. Redis namespace / TTL / invalidation
- Redis is **not source of truth** (PostgreSQL is the source of truth). Acceleration/state layer only.
- Existing: `SQL:{sqlKey}` (query cache), UI meta 1h cache.
- New proposal: `kpop:meta:{screenId}` (TTL 3600, invalidation on change), `kpop:job:progress:{jobId}` (progress), `kpop:result:{jobId}` (result cache, short TTL), `kpop:rate:{userSqno}:{action}` (rate limit), `kpop:idem:{key}` (dedup). Each key must define TTL, invalidation, and DB fallback on failure.

### D-5. AI result grading / evidence serialization
```json
{
  "grade": "EXACT_CANDIDATE | SIMILAR | INSUFFICIENT_EVIDENCE",
  "confidence": 0.0,
  "evidence": [{ "type": "visual_match|brand_text|metadata", "score": 0.0, "source": "..." }],
  "candidates": [{ "productRef": "...", "grade": "...", "officialLink": "...", "rightsChecked": true }]
}
```
- Insufficient evidence (`INSUFFICIENT_EVIDENCE`) must not assert a specific product.

### D-6. User data deletion, retention, audit
- Record upload consent (who/when/scope), original retention period (open decision), deletion API + actual storage deletion, access control (owner/admin), log masking, prohibition of model training reuse.
- Audit events: upload / analysis request / result view / deletion / admin review.

---

## E. Follow-up Execution Issue Decomposition (P1–P5)

Created in dependency order. Each issue must include migration/API/SDUI changes, tests, and deployment/QA evidence in completion criteria. Closure based on actual route/API/job/browser/mobile evidence, not build success alone.

> **Created (2026-07-22)**: P1 #169 · P2 #170 · P3 #171 · P4 #172 · P5 #173 (parent #168)

### P1 (#169) — Artist/Event Foundation (Dependency: none)
- Scope: `artist`/`event`/`artist_follow`/`event_bookmark` migration (V82~), query API (query_master or code), admin seed (initial artists/events — seed responsibility §7), SDUI list/detail (KPOP_EXPLORE/ARTIST_DETAIL/EVENTS/EVENT_DETAIL) + ARTIST_CARD/EVENT_CARD components (web+mobile), follow/bookmark.
- Multilingual: include ko/en fields (C-9).
- Completion criteria: List, detail, follow, and bookmark work on web+Android; API response/role validation confirmed; no new route conflicts.

### P2 (#170) — AI Async Skeleton (Dependency: #169 auth/storage patterns)
- Scope: consent record, presigned upload (S3Service EXTEND), `celery_jobs` new task_type, status/SSE+polling, result shell (grading schema), source delete API.
- Completion criteria: Full flow upload→job submit→progress (SSE/fallback)→result shell→delete works in reality; ownership verified; original deletion reflected in storage.

### P3 (#171) — Product Candidate / Search (Dependency: #170)
- Scope: catalog source decision, evidence grading, vector index (source-of-truth=PG), SavedItem.
- Completion criteria: Candidates + evidence grades displayed in analysis result; save/retrieve works; insufficient evidence case handled.

### P4 (#172) — Community / Operations (Dependency: #169)
- Scope: Reuse `community_post`/`post_report`, verify/add comment table, admin review state transitions for artist/event/product candidate/report (C-8), audit log.
- Completion criteria: Post/comment/report/review flow works in reality; admin review state transitions and audit records verified.

### P5 (#173) — Hardening / Release (Dependency: #169–#172)
- Scope: Redis cache/TTL/invalidation, rate limit, param allowlist enforcement (C-2), accessibility, observability, web+Android QA, deployment verification.
- Completion criteria: QA plan (§QA) passed; confirmed applied in actual deployment environment per environment.

---

## QA Plan (Summary)

- Routes to verify: New KPOP_* screen_id ↔ web `PATH_TO_SCREEN`/mobile `[screenId].tsx`.
- Fixtures: artist/event seed, analysis job mock (SSE event sequence), 3 result grade variants.
- API responses: 200/401/403, ownership violation cases, execute parameter allowlist violation cases.
- SSE/polling fallback: verify fallback to polling when SSE disconnects (follow existing celery pattern).
- Accessibility: keyboard and screen reader for card/badge/upload components.
- Multilingual: ko/en labels, date/timezone display.

---

## 7. Open Decisions (Updated)

- ✅ **MVP primary target**: Domestic + international simultaneously (ko/en) — **confirmed**.
- ⬜ Scope of initial supported artists/events and seed responsibility.
- ⬜ Official content link/thumbnail/embed permitted scope (per provider).
- ⬜ Product catalog/price/inventory provider and operating costs.
- ⬜ Default retention period for original images in object storage.
- ⬜ Embedding/model/vector store selection and re-indexing strategy (ChromaDB/e5 reuse or not).
- ✅ **Query Master**: Maintain SQL-only + enforce new param allowlist (§C-2) — **recommended, pending ADR approval**.
- ⬜ Admin reviewer identity and SLA.
- ✅ **Multilingual/timezone/currency first release scope**: ko/en + UTC storage/local display + display currency (no payment) — **recommended, confirmed**.

---

## Exclusion Scope (Reaffirmed)
Automated replication/re-upload of official SNS/video/photos, full video download + unlimited frame extraction, asserting specific products with insufficient evidence, unlimited real-time price crawling, P2P second-hand trading/payment, full K-RIDE redesign, immediately implementing large-scale new schema/API/UI in Phase 0, facial identification or model training reuse of user images without explicit consent.

## Working Principles (Reaffirmed)
Preserve existing dirty worktree, `ASK/`, `Todo/`, and active branches. Each issue/PR limited to independently verifiable scope. Confirm migration/backend/metadata/web/mobile/deploy separately; no completion without execution evidence. Record standards and responsible parties for resolving discrepancies between docs/code/tests.
