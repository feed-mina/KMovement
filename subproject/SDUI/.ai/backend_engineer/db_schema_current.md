# SDUI 데이터베이스 테이블 구조 (V1 ~ V88 기준)

- 작성일: 2026-07-24 · 기준: `SDUI-server/src/main/resources/db/migration` Flyway 마이그레이션 V1~V88
- DB: PostgreSQL (로컬 docker-compose 포트 5433), 캐시: Redis (`SQL:{sqlKey}`, 화면 메타 1시간)
- 표기: **PK**, `FK→테이블`, (Vxx)=해당 컬럼/테이블을 만든 마이그레이션

## 1. 사용자 / 인증

### users (V1)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| user_sqno | bigserial **PK** | 내부 식별자. 대부분의 FK가 이 값을 참조 |
| user_id | varchar(50) | 로그인 아이디 (V79부터 가입 시 중복확인 `^[A-Za-z0-9_]{4,20}$`) |
| password / hashed_password | varchar | BCrypt 해시 |
| role | varchar | ROLE_GUEST / ROLE_USER / ROLE_PARTNER / ROLE_ADMIN (RBAC, ui_metadata.allowed_roles와 연동) |
| email, phone | varchar | 이메일 로그인 키(`user_email`), 전화번호 `010-1234-5678` 형식 |
| zip_code, road_address, detail_address | varchar | 회원가입 주소 (모바일은 /api/v1/address/search로 채움) |
| del_yn, verify_yn | varchar 'N' | 탈퇴/이메일 인증 여부 |
| verification_code, verification_expired_at | | 이메일 인증 코드 |
| social_type | varchar | K=카카오 등 소셜 가입 구분 |
| kakao_access_token, kakao_refresh_token, kakao_token_expires_at | (V27) | 카카오 나에게 보내기용 토큰 보관 |
| fcm_token | varchar (V63) | 푸시 토큰 |
| nickname, username | varchar (V23) | 커뮤니티 표시명 |
| time_using_type, drug_using_type | varchar | 초기 도메인 잔재 (미사용에 가까움) |
| created_at, updated_at, withdraw_at | timestamp | |

### google_oauth_tokens (V34)
구글 캘린더 연동 토큰 (user_sqno 기준, access/refresh/만료).

### (Redis) refresh token
JWT refresh 토큰은 테이블이 아니라 Redis(`RefreshTokenRepository`)에 user_sqno 키로 저장.

## 2. SDUI 엔진 (서버 주도 UI)

### ui_metadata (V1, 화면 = screen_id 단위의 컴포넌트 행 집합)
| 컬럼 | 비고 |
|---|---|
| ui_id | bigserial **PK** |
| screen_id, component_id | 화면/컴포넌트 식별 (복합 유니크는 없음 — INSERT 시 WHERE NOT EXISTS 관행) |
| component_type | INPUT, BUTTON, GROUP, DATA_SOURCE, CHART, STAT_CARD, SELECTION_CARD … 프론트 componentMap 키 |
| label_text, placeholder, default_value | 표시 텍스트 |
| sort_order, group_id, parent_group_id, group_direction | 트리 구성. group_direction: ROW/COLUMN (V79부터 'horizontal'도 사용 — kride 엔진은 둘 다 행으로 처리) |
| is_required, is_readonly, is_visible | 상태 플래그 (is_visible은 varchar 'true'/'false') |
| css_class, inline_style | 스타일 (모바일은 CLASS_MAP으로 번역) |
| action_type, action_url | LOGIN_SUBMIT, REGISTER_SUBMIT, OPEN_POSTCODE, LINK … + 이동/호출 URL |
| data_sql_key, data_api_url, data_params | 데이터 바인딩: query_master 키 또는 직접 API. DATA_SOURCE(AUTO_FETCH) 행과 리피터 GROUP이 사용 |
| ref_data_id | pageData/formData 바인딩 키 |
| submit_group_id/order/separator | 복수 필드 합성 제출용 |
| component_props | JSONB (V19) — 차트 type/labelKey/valueKey/series, 입력 type 등 |
| allowed_roles | varchar (V22) — RBAC 행 필터 (예: ROLE_ADMIN) |
| label_text_overrides, css_class_overrides | JSONB (V22) — 역할별 오버라이드 |
| system_prompt_template | TEXT (V25) — AI 화면용 |

### query_master (V1)
| 컬럼 | 비고 |
|---|---|
| sql_key | varchar **PK** — `/api/execute/{sqlKey}`로 실행 |
| query_text | 실행 SQL |
| return_type | SINGLE / MULTI / COMMAND |
| use_redis_yn, redis_ttl_sec | (V23) kpop_* 키 Redis 캐시 제어 |
| required_role | (V71) ROLE_ADMIN 등 실행 권한 (admin_* 통계 쿼리) |
| required_params | (V82) 허용 파라미터 allowlist |

### design_tokens (V68)
테마 토큰 (KRIDE_DEFAULT 팔레트: color/kakao 등). PUT /api/ui/theme/**는 ADMIN 전용.

### system_logs (V14)
관리자 로그 조회 화면용 로그 적재 테이블.

## 3. 커뮤니티

### community_post (V40)
post_id **PK**, author_sqno `FK→users`, title(200), content, like_count, report_count, del_yn, created/updated_at,
moderation_status (V87: PENDING/APPROVED/REJECTED + due/처리자 컬럼).

### post_image (V40)
post_id `FK→community_post` (CASCADE), storage_url(Supabase), original/stored_name, mime_type, file_size, sort_order.

### post_like / user_follow (V40)
(post_id,user_sqno) / (follower_sqno,followee_sqno) UNIQUE 토글 테이블.

### post_report (V40 → V87 워크플로 확장)
reason_code, detail_text(1000), status(OPEN 기본, NOT NULL), assigned_admin_sqno `FK→users`, review_due_at(+24h 기본), resolved_at, resolution_note.

### post_comment (V87)
comment_id **PK**, post_id/author_sqno FK, content(2000), moderation_status(PENDING 기본, 24h due), del_yn.

### community_animation_jobs (V55)
게시글 이미지 → RunPod 애니메이션 작업 추적: post_id FK, runpod_job_id, status(QUEUED…), result_url, error_message,
notif_sent(V57), total_images/processed_images/route(V63~), 기타 재시도·요금 관련 컬럼(V64~V67).

## 4. K-POP 팬 플랫폼 Phase 0 (V82~V88)

### artist (V82)
artist_id **PK**, slug UNIQUE, name_ko/name_en, profile, image_url, official_url, approved_yn, sort_order.

### event (V82)
event_id **PK**, artist_id `FK→artist`, title_ko/en, region, venue, event_date, description, official_url, approved_yn.

### artist_follow / event_bookmark (V82)
(user_sqno, artist_id|event_id) UNIQUE 팔로우/북마크.

### product_candidate (V82 → V85 카탈로그 확장)
아티스트 착용 의상 후보: artist_id/event_id FK, name, brand, evidence_grade(EXACT_CANDIDATE/SIMILAR/INSUFFICIENT_EVIDENCE CHECK),
confidence, evidence_text, official_url + (V85) catalog_source, provider_product_ref, source_url, rights_checked, last_verified_at, evidence_json JSONB.

### saved_item (V82)
(user_sqno, item_type, item_ref) UNIQUE — item_type CHECK: ARTIST/EVENT/PRODUCT_CANDIDATE.

### kpop_analysis_candidate (V85)
AI 의상 분석 결과 후보 저장 (celery job 연계).

### kpop_moderation_audit (V82)
kpop 콘텐츠 상태 변경 감사 로그 (target_type/id, from→to, actor, reason).

### celery_jobs (V82에서 Flyway로 정식화)
비동기 작업 셸: celery_task_id UNIQUE, task_type, status, result_json, progress_step/pct, requested_by,
notif_sent, request_fingerprint(V88 — 중복 요청 차단).

## 5. 관광 / 성지

### tour_poi (V75 → V76/V78/V80/V81 확장, V90 전국 시드)
TourAPI 공공 POI + 성지 큐레이션 통합: content_id(공공 UNIQUE, NULL=수집), content_type_id, source(TOURAPI/UGC/CRAWL),
title, addr, map_x/map_y(경위도), first_image, cat1~3, area_code/sigungu_code, raw_json JSONB
+ artist/fandom_info/recommend_reason/source_url(V76), review_status(APPROVED 기본)/reviewed_by/at(V76),
submitted_by `FK→users`(V78, UGC 제출자), image_source_url/image_credit(V81), area/sigungu 코드 백필(V80).
V90: 전국 성지 9,017행 시드(kcisa_media_2023, content_id `kride-media-*`, source CRAWL) —
생성기 `scripts/build_holy_poi_seed.py`, sigungu 이름은 raw_json에 보존(주소 LIKE 필터, 시군구 코드 없음).
V92: 그중 식당·카페 촬영지(raw_json sub_category restaurant/cafe, 약 6천 행)를
content_type_id='HOLY_FOOD'로 태깅 — `/holy?kind=FOOD`가 '성지 맛집' 칩. (CSV category=food
1만 행은 전부 tourapi_food 공공 덤프라 성지 아님 — 미임포트, 일반 '맛집' 칩=TourAPI 실시간 유지)

### holy_content / holy_content_poi (V91)
작품별 성지 필터: **holy_content**(content_sqno **PK**, source_ref UNIQUE `kride-artist-*`, name/name_en,
category kpop|drama|movie|show) 1,024건 + **holy_content_poi**(content_sqno FK, poi_sqno `FK→tour_poi`,
relationship, (content,poi) UNIQUE) 링크 14,969건. 생성기 `scripts/build_holy_content_seed.py`.
조회: `GET /api/v1/tour/holy/contents?q=`(자동완성, 성지 수 내림차순), `GET /api/v1/tour/holy?contentSqno=`.

## 6. B2B 파일럿 (V77)

- **b2b_partner**: 파트너사.
- **b2b_exposure_slot**: 노출 슬롯(기간/위치/파트너 FK).
- **b2b_slot_event**: 슬롯 노출/클릭 이벤트 적재 (POST /api/v1/b2b/slots/*/events는 공개).

## 7. 멤버십 / 결제

### memberships (V23)
name UNIQUE(베이직/프리미엄 시드), can_learn/can_converse/can_analyze, duration_days, price_cents.

### user_memberships (V23)
user_id, membership_id `FK→memberships`, started_at/expires_at, status(active), granted_by(purchase).

## 8. 학습·면접 레거시 (다이어리 시절 기능, 현행 KRIDE 플로우와 독립)

| 테이블 | 마이그레이션 | 용도 |
|---|---|---|
| content (구 diary, diary_backup) | V2/V3 (diary는 V7에서 삭제) | 다이어리/게시글 통합 콘텐츠 + is_private(V31), img_url(V35) |
| fan_board | V35 | content LIKE 복제 팬보드 |
| goal_settings | V1 | 목표 시간 기록 (관리자 대시보드 goal-dashboard API 원천) |
| interview_resume / interview_questions / interview_schedule | V26/V29/V30 | AI 면접 |
| leetcode_problems | V28 | 코딩테스트 문제 |
| study_materials | V33 | 학습 자료 |

## 참고: 자주 쓰는 조회 경로

- 화면 렌더: `GET /api/ui/{screenId}` → ui_metadata (role 필터: allowed_roles ↔ 요청자 role, 모바일은 Bearer 헤더 필수)
- 데이터 바인딩: `GET|POST /api/execute/{sqlKey}` → query_master 실행 (required_role/required_params 검사, kpop_* Redis 캐시)
- 주소 검색: `GET /api/v1/address/search?keyword=` → 카카오 로컬 API 프록시 (테이블 없음)
- 카카오 로그인: `GET /api/kakao/callback?code&state` → state=web 쿠키 리다이렉트 / state=app `kride://kakao-callback` 딥링크 / state=mobile JSON(레거시)
