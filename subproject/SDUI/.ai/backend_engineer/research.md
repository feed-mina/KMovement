# Backend Engineer — Research

> 이 파일은 백엔드 구현 분석 결과를 기록한다.

---

## 패키지 구조 (2026-02-28 기준)

```
com.domain.demo_backend/
├── domain/
│   ├── diary/          # 일기 도메인
│   ├── Location/       # 위치 서비스
│   ├── time/           # 시간/목표 추적
│   ├── token/          # 토큰 관리
│   ├── ui/             # ★ SDUI 핵심 — 메타데이터 트리 빌딩
│   ├── user/           # 인증 & 사용자
│   └── query/          # 동적 쿼리 실행
├── global/
│   ├── common/         # ApiResponse, 유틸리티
│   ├── config/         # Security, Redis, WebSocket, CORS
│   ├── error/          # 예외 처리
│   ├── security/       # JWT, 비밀번호, SSO
│   └── infra/          # 이메일
└── DemoBackendApplication.java
```

---

## API 엔드포인트 전체 목록

| 경로                      | 메서드 | 인증          | 컨트롤러              | 설명                      |
| ------------------------- | ------ | ------------- | --------------------- | ------------------------- |
| `/api/ui/{screenId}`    | GET    | No            | UiController          | SDUI 메타데이터 트리 반환 |
| `/api/auth/login`       | POST   | No            | AuthController        | 로그인                    |
| `/api/auth/register`    | POST   | No            | AuthController        | 회원가입                  |
| `/api/auth/verify-code` | POST   | No            | AuthController        | 이메일 인증               |
| `/api/auth/logout`      | POST   | No            | AuthController        | 로그아웃                  |
| `/api/auth/me`          | GET    | No            | AuthController        | 현재 사용자 정보          |
| `/api/auth/refresh`     | POST   | No            | AuthController        | 토큰 갱신                 |
| `/api/auth/signup`      | POST   | No            | AuthController        | 인증 이메일 발송          |
| `/api/kakao/**`         | ALL    | No            | KakaoController       | 카카오 OAuth              |
| `/api/diary/**`         | ALL    | **Yes** | DiaryController       | 일기 CRUD                 |
| `/api/execute/{sqlKey}` | POST   | **Yes** | CommonQueryController | 동적 쿼리 실행            |
| `/api/goalTime/**`      | ALL    | No            | GoalTimeController    | 목표 시간                 |
| `/api/location/**`      | ALL    | ?             | LocationController    | 위치 서비스               |
| `/api/admin/users`      | GET    | **ADMIN** | AdminUserController   | 사용자 목록 조회 (keyword/role 필터, 페이징) |
| `/api/admin/users/role` | PUT    | **ADMIN** | AdminUserController   | 사용자 권한 변경 (최대 5명) |

---

## 핵심 엔티티 분석

### UiMetadata (`domain/ui/domain/UiMetadata.java`)

| 필드                 | 타입         | 설명                          |
| -------------------- | ------------ | ----------------------------- |
| uiId                 | BIGINT PK    | 자동 증가                     |
| screenId             | VARCHAR(50)  | 화면 식별자                   |
| componentId          | VARCHAR(50)  | 컴포넌트 고유 ID              |
| componentType        | VARCHAR(20)  | React 컴포넌트 타입           |
| labelText            | VARCHAR(100) | 표시 텍스트                   |
| sortOrder            | INT          | 렌더링 순서                   |
| isRequired           | BOOLEAN      | 필수 입력                     |
| isReadonly           | BOOLEAN      | 읽기 전용                     |
| placeholder          | VARCHAR(255) | 입력 힌트                     |
| cssClass             | VARCHAR(100) | CSS 클래스명                  |
| actionType           | VARCHAR(50)  | 액션 타입                     |
| refDataId            | VARCHAR(50)  | pageData 키, Repeater 식별자  |
| groupId              | VARCHAR(50)  | 자신의 그룹 ID                |
| parentGroupId        | VARCHAR(50)  | 부모 그룹 ID (트리 구조 핵심) |
| groupDirection       | VARCHAR(10)  | ROW / COLUMN                  |
| isVisible            | VARCHAR(50)  | 가시성 조건                   |
| inlineStyle          | TEXT         | 인라인 CSS                    |
| dataSqlKey           | VARCHAR(50)  | query_master 연결 키          |
| defaultValue         | VARCHAR(255) | 기본값                        |
| submitGroupId        | VARCHAR(50)  | 제출 그룹                     |
| submitGroupOrder     | INT          | 제출 순서                     |
| submitGroupSeparator | VARCHAR(10)  | 제출 구분자                   |

### User (`domain/user/domain/User.java`)

| 필드                  | 타입                | 설명                     |
| --------------------- | ------------------- | ------------------------ |
| userSqno              | BIGINT PK           | 자동 증가                |
| userId                | VARCHAR(50) UNIQUE  | 사용자 ID                |
| email                 | VARCHAR(100) UNIQUE | 이메일                   |
| password              | VARCHAR(255)        | 원본 (사용 지양)         |
| hashedPassword        | VARCHAR(255)        | BCrypt 해시              |
| role                  | VARCHAR(50)         | ROLE_USER, ROLE_ADMIN 등 |
| verifyYn              | CHAR(1)             | 이메일 인증 여부 (Y/N)   |
| verificationCode      | VARCHAR(10)         | 6자리 인증 코드          |
| verificationExpiredAt | DATETIME            | 인증 코드 만료 시간      |
| socialType            | VARCHAR(20)         | K (카카오)               |
| zipCode               | VARCHAR(10)         | 우편번호                 |
| roadAddress           | VARCHAR(255)        | 도로명 주소              |
| detailAddress         | VARCHAR(255)        | 상세 주소                |
| timeUsingType         | VARCHAR(50)         | 시간 사용 유형           |
| drugUsingType         | VARCHAR(50)         | 약물 사용 유형           |

### Diary (`domain/diary/domain/Diary.java`)

| 필드                  | 타입         | 설명                         |
| --------------------- | ------------ | ---------------------------- |
| diaryId               | BIGINT PK    | 자동 증가                    |
| userSqno              | BIGINT FK    | users.user_sqno              |
| title                 | VARCHAR(255) | 제목                         |
| content               | TEXT         | 내용                         |
| emotion               | INT          | 감정 인덱스                  |
| dayTag1~3             | VARCHAR      | 태그 1~3                     |
| selectedTimes         | JSON         | 선택한 시간 슬롯 배열        |
| dailySlots            | JSON         | 일일 시간 배분 맵            |
| diaryStatus           | ENUM         | 'true'(공개) / 'false'(초안) |
| regDt, updtDt         | TIMESTAMP    | 등록/수정 일시               |
| frstRegIp, lastUpdtIp | VARCHAR      | IP 주소                      |

---

## 보안 설정 현황

### JWT 토큰 설정 (`JwtUtil.java`)

| 항목              | 값                     |
| ----------------- | ---------------------- |
| Access Token TTL  | 1시간                  |
| Refresh Token TTL | 7일                    |
| 암호화            | AES-256 + PBKDF2       |
| 저장소            | Refresh Token → Redis |

### 로그인 응답 — HttpOnly 쿠키 설정 (AuthController.java:87-102) ✅

```java
// 로그인/카카오 OAuth 모두 동일 방식으로 쿠키 설정
ResponseCookie accessTokenCookie = ResponseCookie.from("accessToken", tokenResponse.getAccessToken())
        .httpOnly(true)       // ✅ JavaScript 접근 불가
        .secure(false)        // 로컬 테스트용 (프로덕션: true 필요 — P2)
        .path("/")
        .maxAge(60 * 60)      // 1시간
        .sameSite("Lax")
        .build();

ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", tokenResponse.getRefreshToken())
        .httpOnly(true)       // ✅ JavaScript 접근 불가
        .secure(false)
        .path("/")
        .maxAge(60 * 60 * 24 * 7)  // 7일
        .sameSite("Lax")
        .build();
```

**프로덕션 배포 시 필수:** `secure(false)` → `secure(true)` 변경 (P2, ❌ 미수정)

### CORS 허용 Origin (`SecurityConfig.java`)

```
localhost:3000 (Next.js 개발)
localhost:8080 (Backend 개발)
프로덕션 도메인 (EC2/Vercel)
```

### 공개 엔드포인트 (인증 불필요)

```
/api/auth/**
/api/ui/**
/api/goalTime/**
/api/kakao/**
```

---

## Redis 캐시 전략

| 키                         | 값                          | TTL             | 관리                                      |
| -------------------------- | --------------------------- | --------------- | ----------------------------------------- |
| `SQL:{sqlKey}`           | 쿼리 텍스트                 | 영구            | 수동 삭제                                 |
| `ui:metadata:{screenId}` | List&lt;UiMetadata&gt; JSON | **1시간** | UiMetadataService 자동 (수동 삭제도 가능) |
| `{userId}`               | RefreshToken 객체           | 7일             | 자동 만료                                 |

**주의:** `SQL:{sqlKey}` 캐시는 자동 만료되지 않음. `query_master` 쿼리 변경 시 Redis에서 해당 키 수동 삭제 필요.

---

## 도메인별 의존성 지도

```
UiController → UiService → UiMetadataService → UiMetadataRepository
                                              → Redis (`ui:metadata:{screenId}`, TTL 1h) ✅ 구현됨

AuthController → AuthService → UserRepository
                             → EmailUtil
                             → JwtUtil → Redis (RefreshToken)

CommonQueryController → QueryMasterService → QueryMasterRepository (query_master 테이블)
                                           → Redis (SQL:{key})
                                           → DynamicExecutor (SQL 실행)
```

---

## Gradle 주요 의존성

| 의존성                              | 버전   | 용도        |
| ----------------------------------- | ------ | ----------- |
| spring-boot-starter-data-jpa        | -      | ORM         |
| spring-boot-starter-security        | -      | 보안        |
| spring-boot-starter-data-redis      | -      | Redis       |
| spring-boot-starter-mail            | -      | 이메일      |
| spring-boot-starter-websocket       | -      | WebSocket   |
| postgresql                          | -      | DB 드라이버 |
| mybatis-spring-boot-starter         | 3.0.3  | MyBatis     |
| jjwt-api                            | 0.11.5 | JWT         |
| springdoc-openapi-starter-webmvc-ui | 2.2.0  | Swagger     |
| net.nurigo:sdk                      | 4.3.0  | SMS         |

### 민감 정보 로깅 — System.out.println → SLF4J 전환 ✅ 완료 (2026-03-08)

> **출처:** frontend_engineer/research.md에서 이동 (commit b2ec8d5 이후 재스캔 기준)
> **2026-03-08 완료:** 11개 파일, 활성 println 45개 전부 SLF4J로 전환

| 파일                             | 개수 | 민감도                              | 상태                                       |
| -------------------------------- | ---- | ----------------------------------- | ------------------------------------------ |
| `ContentService.java`          | 8개  | MEDIUM — 콘텐츠 요청, 에러         | ✅ 완료 (log.debug / log.error)            |
| `ContentController.java`       | 11개 | MEDIUM — 요청 정보, IP             | ✅ 완료 (log.debug / log.warn / log.error) |
| `AuthService.java`             | 3개  | MEDIUM — User 객체, 에러 메시지    | ✅ 완료 (log.debug)                        |
| `GoalTimeQueryService.java`    | 9개  | MEDIUM — 캐시키, SQL, params       | ✅ 완료 (log.debug)                        |
| `GoalTimeController.java`      | 2개  | LOW — userSqno, targetTime         | ✅ 완료 (log.debug)                        |
| `UiController.java`            | 3개  | LOW — screenId 로깅                | ✅ 완료 (log.debug)                        |
| `UiService.java`               | 2개  | LOW — 데이터 정합성 경고           | ✅ 완료 (log.warn)                         |
| `JwtAuthenticationFilter.java` | 1개  | LOW — System.err + printStackTrace | ✅ 완료 (log.warn + e 객체 포함)           |
| `KakaoController.java`         | 1개  | LOW — kakaoUserInfo                | ✅ 완료 (log.debug)                        |
| `MockAuthFilter.java`          | 1개  | LOW — 필터 실행 로그               | ✅ 완료 (log.debug)                        |
| `PasswordUtil.java`            | 2개  | LOW — 비밀번호 일치 여부           | ✅ 완료 (log.debug)                        |

**비고:** 주석 블록(`//`, `/* */`) 내 잔존 println 3건은 비활성 코드로 그대로 유지.

---

## 로컬 Docker DB 환경 구성 및 Flyway 수정 (2026-03-06)

> _출처: frontend_engineer/research.md에서 이동 (2026-03-08)_

### 배경 — 포트 충돌 문제

| 서비스                    | 포트           |
| ------------------------- | -------------- |
| PostgreSQL 18 (로컬 설치) | 5432           |
| PostgreSQL 13 (로컬 설치) | 5433           |
| Docker sdui-db (변경 후)  | **5434** |

로컬 PostgreSQL 13이 5433을 점유하여 `application.yml`의 Docker DB 포트를 **5434로 변경**했다.
변경 파일 3개: `src/main/resources/application.yml`, `out/production/resources/application.yml`, `bin/main/application.yml`

```yaml
# 변경 전
url: jdbc:postgresql://localhost:5433/SDUI_TD
# 변경 후
url: jdbc:postgresql://localhost:5434/SDUI_TD
```

> **AWS 환경**: RDS를 사용하므로 포트 충돌 없음 — 이 변경 불필요.

---

### Flyway 마이그레이션 실패 원인 분석

**현상:** Spring Boot 기동 시 V2 마이그레이션 실패

```
WARN  DB: there is already a transaction in progress (SQL State: 25001)
ERROR Migration of schema "public" to version "2 - create content table" failed!
       Message: ERROR: relation "users" does not exist
       Location: db/migration/V2__create_content_table.sql
       Line: 39
```

**근본 원인 두 가지:**

1. **`baseline-version: 1` 설정**: V1은 실행 안 되고 V2부터 실행됨
   → 빈 Docker DB에 `users` 테이블이 없어 V2의 FK 제약 실패
2. **명시적 `BEGIN;/COMMIT;`**: V2~V8 모두 파일 안에 `BEGIN;/COMMIT;`을 포함
   → Flyway가 이미 트랜잭션을 시작한 상태에서 중첩 트랜잭션 경고 발생

---

### V1 파일 문제

기존 V1은 **주석/문서 전용** 파일이었다 (실제 SQL 없음).
`baseline-version: 1`이므로 Flyway는 V1을 baseline marker로만 처리하고 실행하지 않는다.
결과: 빈 Docker DB에 기본 테이블(`users`, `diary`, `ui_metadata`, `query_master`, `goal_settings`)이 없는 상태에서 V2가 실행되어 실패.

---

### 적용된 수정사항

#### 1. `V1__baseline_schema.sql` — 실제 DDL로 교체

기존 주석 전용 파일을 실제 테이블 생성 SQL로 교체:

| 생성 테이블       | 비고                                               |
| ----------------- | -------------------------------------------------- |
| `users`         | `user_sqno BIGSERIAL PK`, 인증·프로필 컬럼 전체 |
| `diary`         | `diary_id BIGSERIAL PK`, V7에서 삭제됨           |
| `ui_metadata`   | `ui_id BIGSERIAL PK`, 화면 메타데이터            |
| `query_master`  | `sql_key VARCHAR PK`, 동적 SQL                   |
| `goal_settings` | `id BIGSERIAL PK`, 약속 시간 설정                |

초기 데이터: V8 벤토 그리드 마이그레이션에 필요한 **MAIN_PAGE MAIN_SECTION** root GROUP 삽입

```sql
INSERT INTO ui_metadata
  (screen_id, component_id, component_type, parent_group_id, label_text, css_class, sort_order, created_at)
VALUES
  ('MAIN_PAGE', 'MAIN_SECTION', 'GROUP', NULL, '메인', 'main-page', 1, NOW());
```

> `RefreshToken`은 `@RedisHash` → PostgreSQL 테이블 불필요

#### 2. `application.yml` (3개 파일) — `baseline-version: 0`으로 변경

```yaml
# 변경 전
baseline-version: 1   # V1은 baseline marker만 (실행 안 됨)
# 변경 후
baseline-version: 0   # V0이 baseline → V1부터 실제 실행
```

> **기존 DB(AWS)**: 이미 `flyway_schema_history`가 있으면 Flyway가 새 baseline을 삽입하지 않으므로 안전.

#### 3. V2~V8 전 파일 — `BEGIN;` / `COMMIT;` 제거

Flyway는 각 마이그레이션을 자체 트랜잭션으로 감싼다.
파일 내 명시적 `BEGIN;/COMMIT;`은 중첩 트랜잭션 경고를 발생시키고 Flyway 상태를 혼란스럽게 한다.

| 파일                                 | 처리                          |
| ------------------------------------ | ----------------------------- |
| V2__create_content_table.sql         | `BEGIN;` / `COMMIT;` 제거 |
| V3__migrate_diary_to_content.sql     | `BEGIN;` / `COMMIT;` 제거 |
| V4__update_ui_metadata_rbac.sql      | `BEGIN;` / `COMMIT;` 제거 |
| V5__update_query_master_redis.sql    | `BEGIN;` / `COMMIT;` 제거 |
| V6__update_metadata_content_refs.sql | `BEGIN;` / `COMMIT;` 제거 |
| V7__drop_diary_table.sql             | `BEGIN;` / `COMMIT;` 제거 |
| V8__main_page_bento_grid.sql         | `BEGIN;` / `COMMIT;` 제거 |

---

### docker-compose.yml 서비스 이름 주의

```yaml
services:
  db:                      # ← 서비스 이름 (docker-compose 명령에 사용)
    container_name: sdui-db  # ← 컨테이너 이름 (docker 명령에 사용)
```

```bash
# 올바른 명령어
docker-compose stop db
docker-compose rm -f db
docker-compose up -d db

# 틀린 명령어 (에러 발생)
docker-compose stop sdui-db   # ← no such service: sdui-db
```

---

### 로컬 테스트 순서 (최종)

```bash
# 1. Docker DB 초기화 (SDUI 프로젝트 루트에서)
docker-compose stop db
docker-compose rm -f db
docker-compose up -d db

# 2. DB 기동 확인 (5~10초 후)
docker ps   # sdui-db 컨테이너가 Up 상태인지 확인

# 3. DemoBackendApplication 재기동
# → Flyway V1~V8 순차 실행 → Hibernate validate → 서버 기동 완료 (8080)

# 4. 프론트엔드 기동
cd metadata-project && npm run dev
```

### Flyway 실패 시 특정 버전 재실행

```sql
-- flyway_schema_history에서 해당 버전 삭제 후 Spring Boot 재기동
DELETE FROM flyway_schema_history WHERE version = '8';
```

### 완료된 마이그레이션 현황

| 버전 | 내용                                                         | 상태    |
| ---- | ------------------------------------------------------------ | ------- |
| V1   | 기본 테이블 생성 (users, ui_metadata 등) + MAIN_SECTION root | ✅ 완료 |
| V2   | content 테이블 생성                                          | ✅ 완료 |
| V3   | diary → content 데이터 이전                                 | ✅ 완료 |
| V4   | ui_metadata RBAC 컬럼 추가 (allowed_roles 등)                | ✅ 완료 |
| V5   | query_master Redis 컬럼 추가                                 | ✅ 완료 |
| V6   | diary → content 참조 업데이트                               | ✅ 완료 |
| V7   | diary 테이블 삭제                                            | ✅ 완료 |
| V8   | MAIN_PAGE 벤토 그리드 삽입                                   | ✅ 완료 |
| V9   | USER 카드 라벨 변경                                          | ✅ 완료 |
| V10  | 벤토 카드 전체 클릭 가능 전환                                | ✅ 완료 |

---

## [P0] Security Fix 상세 분석 — 코드 재검증 (2026-02-28)

> **⚠️ 상태 업데이트:** 이전 분석([P1])의 `anyRequest().permitAll()` 진단은 구버전 기준.
> 실제 현재 코드에서는 `anyRequest().denyAll()`이 이미 적용됨. 그러나 새로운 P0 취약점 3개 발견.

---

### 현재 SecurityConfig permitAll 화이트리스트 (실제 코드 기준)

**파일:** `SecurityConfig.java:72-90`

| 경로 패턴                                  | HTTP Method         | 비고                                                       |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------- |
| `/**`                                    | OPTIONS             | CORS preflight                                             |
| `/api/auth/login`                        | POST                | 로그인                                                     |
| `/api/auth/register`                     | POST                | 회원가입                                                   |
| `/api/auth/signup`, `/api/auth/signUp` | POST                | 이메일 인증 발송                                           |
| `/api/auth/me`                           | GET                 | 현재 사용자 (게스트 응답 가능)                             |
| `/api/auth/refresh`                      | POST                | 토큰 갱신                                                  |
| `/api/auth/logout`                       | POST                | 로그아웃                                                   |
| `/api/auth/verify-code`                  | POST                | 인증 코드 검증                                             |
| `/api/auth/resend-code`                  | POST                | 인증 코드 재발송                                           |
| `/api/auth/confirm-email`                | GET                 | 이메일 확인 링크                                           |
| `/api/auth/check-verification`           | GET                 | 인증 상태 확인                                             |
| `/api/kakao/**`                          | ALL                 | OAuth (공개)                                               |
| `/api/ui/**`                             | GET                 | SDUI 메타데이터 (공개 의도)                                |
| `/api/timer/**`                          | GET                 | 타이머 (공개)                                              |
| **`/api/goalTime/**`**             | **ALL**       | **⚠️ 전체 공개 — 컨트롤러 레벨 인증만 부분 적용** |
| **`/api/execute/**`**              | **GET, POST** | **🔴 CRITICAL — 동적 SQL 무인증 실행 가능**         |

**인증 필수 (SecurityConfig 레벨):**

| 경로                       | HTTP | 권한                    |
| -------------------------- | ---- | ----------------------- |
| `/api/auth/editPassword` | POST | `.authenticated()` ✅ |
| `/api/auth/non-user`     | POST | `.authenticated()` ✅ |
| `/api/diary/**`          | ALL  | `.authenticated()` ✅ |

**기본 정책:** `.anyRequest().denyAll()` ✅ (이미 적용됨)

---

### 발견된 P0 취약점 3개

#### [P0-1] `GET/POST /api/execute/{sqlKey}` — CRITICAL 🔴

**파일:** `CommonQueryController.java:29`

```java
// 현재: @PreAuthorize 없음, Authentication 파라미터는 있으나 null 허용
@RequestMapping(value = "/{sqlKey}", method = {RequestMethod.GET, RequestMethod.POST})
public ResponseEntity<?> execute(
    @PathVariable String sqlKey,
    @RequestParam(required = false) Map<String, Object> queryParams,
    @RequestBody(required = false) Map<String, Object> bodyParams,
    Authentication authentication) {  // null이어도 동작

    if (authentication != null) {  // null 허용 — 인증 없어도 계속 실행
        params.put("userSqno", userDetails.getUserSqno());
    }
    // ... SQL 실행
}
```

**위험:** SecurityConfig Line 85에 `permitAll()` + 컨트롤러 내 인증 체크 없음
→ 누구나 `query_master` 테이블의 모든 SQL 쿼리 실행 가능

```bash
# 공격 예시:
curl -X POST http://localhost:8080/api/execute/user_list
curl -X GET http://localhost:8080/api/execute/diary_delete?diaryId=1
```

**권고 수정:**

```java
@PreAuthorize("hasRole('ADMIN')")  // 또는 authenticated() + 쿼리별 권한 체크
@RequestMapping(value = "/{sqlKey}", method = {RequestMethod.GET, RequestMethod.POST})
public ResponseEntity<?> execute(..., Authentication authentication) {
    if (authentication == null)
        return ResponseEntity.status(403).body(Map.of("message", "권한이 없습니다."));
    // ...
}
```

SecurityConfig에서도:

```java
.requestMatchers("/api/execute/**").hasRole("ADMIN")  // permitAll 대신
```

---

#### [P0-2] JwtAuthenticationFilter — DB 역할 무시, ROLE_USER 하드코딩 🔴

**파일:** `JwtAuthenticationFilter.java:123`

```java
// 현재: DB의 role 필드 무시, 모든 인증 사용자 = ROLE_USER
List<GrantedAuthority> authorities = List.of(() -> "ROLE_USER");
```

**영향:**

- DB에 `ROLE_ADMIN`이 있어도 Spring Security에서는 `ROLE_USER`로만 처리
- `@PreAuthorize("hasRole('ADMIN')")` 기반 접근 제어가 절대 작동 안 함
- `/api/execute/**`에 관리자 권한을 추가해도 무의미

**권고 수정:**

```java
// JwtAuthenticationFilter.java에서 DB에서 실제 역할 조회:
User user = userRepository.findByEmail(email).orElse(null);
String role = (user != null) ? user.getRole() : "ROLE_USER";
List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority(role));
```

---

#### [P0-3] WebSocket 인증 없음 — HIGH 🟠

**파일:** `LocationController.java:22-45`

```java
@MessageMapping("/location/update")
public void updateLocation(LocationRequest message) {
    // JWT 검증 없음 — 누구나 위치 데이터 브로드캐스트 가능
    stringRedisTemplate.opsForGeo().add("active_workers", ...);
    messagingTemplate.convertAndSend("/sub/admin/locations", message);
}

@MessageMapping("/location/emergency")
public void handleEmergency(LocationRequest message) {
    // JWT 검증 없음 — 누구나 긴급 신호 발송 가능
    messagingTemplate.convertAndSend("/sub/admin/emergency", message);
}
```

**WebSocketConfig.java:19:** `.setAllowedOriginPatterns("*")` — 모든 도메인 허용

**위험:** 거짓 위치 데이터, 긴급 신호 스팸, 직원 위치 무단 수신

**권고 수정:**

```java
@MessageMapping("/location/update")
public void updateLocation(LocationRequest message,
        @Header("Authorization") String token) {
    if (!jwtUtil.validateToken(token)) throw new AccessDeniedException("인증 필요");
    // ...
}
```

---

### /api/auth 취약점 재분석 (구버전 진단 수정)

| 엔드포인트                 | 이전 진단             | 실제 현황                                                       | 재진단             |
| -------------------------- | --------------------- | --------------------------------------------------------------- | ------------------ |
| `/api/auth/editPassword` | ❌ permitAll          | ✅`.authenticated()` + `@AuthenticationPrincipal` null 체크 | 보호됨             |
| `/api/auth/non-user`     | ❌ permitAll          | ✅`.authenticated()` + `@AuthenticationPrincipal` null 체크 | 보호됨             |
| `/api/execute/{sqlKey}`  | ❌ permitAll + 무인증 | ❌ 여전히 permitAll + 무인증                                    | **CRITICAL** |

**주의:** `editPassword`에 현재 비밀번호 검증 로직이 없음 (인증은 됨).

---

### /api/goalTime/** 부분 인증 현황 //[메모] 로그인 하지 않은 경우, 페이지에 처음 진입했을때 nogoal 상태를 보여주기  위해 

| 메서드        | 경로             | @AuthenticationPrincipal | null 허용                    | 위험                  |
| ------------- | ---------------- | ------------------------ | ---------------------------- | --------------------- |
| getGoalTime   | `/getGoalTime` | ✅ 있음                  | ⚠️ null 허용 (삼항 연산자) | 타인 데이터 조회 가능 |
| saveGoalTime  | `/save`        | ✅ 있음                  | ✅ null 체크 후 401          | 안전                  |
| getGoalList   | `/getGoalList` | ✅ 있음                  | ⚠️ null 허용               | 타인 데이터 조회 가능 |
| recordArrival | `/arrival`     | ✅ 있음                  | ✅ null 체크 후 401          | 안전                  |

---

### JwtAuthenticationFilter EXCLUDE_URLS 오타 발견

**파일:** `JwtAuthenticationFilter.java:27-34`

```java
private static final List<String> EXCLUDE_URLS = List.of(
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/kakao/login",
    "/api/kakao/callback",
    "/api/ui/LOGIN_PAGE",
    "api/ui/MAIN_PAGE"   // ← 오타: 앞에 '/' 없음 → 필터 통과 안 됨
);
```

→ `/api/ui/MAIN_PAGE` 요청은 JWT 검증을 받게 되어 토큰 없는 첫 방문자가 차단될 수 있음.

---

### 우선순위 수정 체크리스트

| 항목                                                                                                                                                             | 우선순위             | 상태                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------ |
| `/api/execute/**` → query_master.required_role 컬럼 기반 쿼리별 권한 검증 (Option B 채택)                                                                   | **P0 — 즉시** | ✅ 코드 수정 완료 (QueryMaster.requiredRole + CommonQueryController 검증 로직), V15 migration 폴더 배치 완료, **로컬 DB 적용(서버 실행) 대기** |
| JwtAuthenticationFilter 역할 하드코딩 → JWT 클레임 role 읽기                                                                                                    | **P0 — 즉시** | ✅ 수정됨 (line 125:`claims.get("role")`, ROLE_USER는 폴백만)    |
| WebSocket 인증 추가 (`/location/update`, `/location/emergency`)                                                                                              | **P0**         | ❌ 미수정 (LocationController JWT 검증 없음)                       |
| `/api/goalTime/getGoalTime`, `getGoalList` null 체크 강화 <br />//[메모] 로그인 하지 않은 경우, 페이지에 처음 진입했을때 <br />nogoal 상태를 보여주기  위해 | **P1**         | ❌ 미수정 (삼항 연산자로 null 허용 유지)                           |
| `/api/auth/editPassword` 현재 비밀번호 검증 추가                                                                                                               | **P1**         | ❌ 미수정                                                          |
| JwtAuthenticationFilter EXCLUDE_URLS 오타 수정 (`"api/ui/MAIN_PAGE"`)                                                                                          | **P2**         | ✅ 수정됨 (line 33:`"/api/ui/MAIN_PAGE"` 슬래시 추가됨)          |
| WebSocket Origin `*` → 실제 도메인으로 제한                                                                                                                   | **P2**         | ❌ 미수정 (WebSocketConfig `setAllowedOriginPatterns("*")` 유지) |
| `anyRequest().denyAll()` 유지 확인                                                                                                                             | —                   | ✅ 이미 적용됨                                                     |
| `/api/auth/editPassword`, `/api/auth/non-user` authenticated                                                                                                 | —                   | ✅ 이미 적용됨                                                     |

---

### 2026-03-07: 이슈 및 해결 기록

#### 1. 카카오 로그인 리다이렉트 문제 (1차 수정 완료 → 2차 버그 발견)

- **1차 현상(해결됨):** 카카오 로그인 후 JSON 응답이 표시됨. state 분기 처리로 수정.
- **2차 현상(2026-03-07 발견):** 배포 후 카카오 로그인 시 로그인이 안되고 바로 메인페이지로 이동.
- **2차 원인 (쿠키 도메인 불일치):**
  - `KAKAO_REDIRECT_URI`가 백엔드 직접 URL(`yerin.duckdns.org/api/kakao/callback`)로 설정되어 있었음.
  - 카카오가 브라우저를 `yerin.duckdns.org`로 직접 리다이렉트 → 백엔드가 쿠키를 `yerin.duckdns.org` 도메인에 설정 후 Vercel(yerin.duckdns.org)로 302.
  - 브라우저가 Vercel에 도착하면 `yerin.duckdns.org` 도메인 쿠키는 전송되지 않음 → `accessToken` 없음 → 로그인 안된 상태로 메인페이지 표시.
  - `WEB_URL`도 deploy.yml에 미주입, `http://` 기본값 사용.
- **2차 해결:**
  - `deploy.yml`: `KAKAO_REDIRECT_URI=https://yerin.duckdns.org/api/kakao/callback` (비밀이 아니므로 하드코딩), `WEB_URL=https://yerin.duckdns.org` 추가.
  - `application-prod.yml`: WEB_URL 기본값을 `https://`로 수정.
  - `V11__fix_kakao_redirect_uri.sql`: DB `ui_metadata`의 카카오 버튼 `action_url`도 새 redirect_uri로 업데이트.
  - **사용자가 수동으로 해야 할 일**: 카카오 개발자 콘솔에서 `https://yerin.duckdns.org/api/kakao/callback`을 Redirect URI로 등록.
- **동작 원리:** `yerin.duckdns.org/api/kakao/callback` → Next.js rewrite → `yerin.duckdns.org/api/kakao/callback` → 백엔드 처리 후 302+Set-Cookie → Next.js가 응답 전달 → 쿠키가 `yerin.duckdns.org` 도메인에 설정됨 ✓

#### 2. 배포 후 데이터 불일치 미스터리 (진행 중)

- **현상:** 배포된 환경에서 일반 로그인은 정상적으로 되는데, DB의 `users` 테이블을 조회하면 데이터가 없음.
- **가설:**
  - 애플리케이션이 바라보는 DB(`SDUI_LAB` vs `SDUI_TD`)와 사용자가 직접 조회하는 DB가 다를 가능성이 높음.
  - `deploy.yml` 설정상 `lab` 브랜치는 `SDUI_LAB` 데이터베이스를 사용하고, `main` 브랜치는 `SDUI_TD`를 사용함.

#### 3. DB 백업 전략 변경 (2026-03-07)

- **EC2 로컬 저장 + 7일 보관 주기(Retention)** 방식으로 변경.
- **스크립트:** `.ai/scripts/backup_sdui_db_to_ec2.sh`

---

## RBAC / User Role 구현 현황 상세 분석 (2026-03-08)

### Role 값의 전체 흐름

```
DB (users.role 컬럼)
  → JWT 발급 시 "role" 클레임에 포함 (JwtUtil)
    → JwtAuthenticationFilter: JWT 검증 시 클레임에서 읽어 GrantedAuthority 생성
      → SecurityContextHolder에 인증 저장
        → UiController.extractRole(): UserDetails.getAuthorities() 첫 번째 값 추출
          → UiService.getUiTree(screenId, userRole): isAccessible() 필터링
```

### JwtAuthenticationFilter — Role 처리 (line 127-135)

```java
// JWT 클레임에서 role 읽기 (DB 역할 체계 반영, 2026-03-01)
String role = claims.get("role", String.class);
if (role == null || role.isBlank()) {
    role = "ROLE_USER"; // 폴백 (기존 토큰 호환)
}
List<GrantedAuthority> authorities = List.of(new SimpleGrantedAuthority(role));

CustomUserDetails userDetails = new CustomUserDetails(user);  // DB에서 조회한 User 객체
Authentication authentication = new UsernamePasswordAuthenticationToken(
    userDetails, null, authorities  // ⚠️ authorities는 JWT 기반, userDetails.getAuthorities()는 DB 기반
);
```

**⚠️ 주의:** `UsernamePasswordAuthenticationToken`에 전달되는 `authorities`는 JWT 클레임 기반이고, `userDetails.getAuthorities()`는 DB `users.role` 기반으로 **소스가 다름**. `UiController.extractRole()`은 `userDetails.getAuthorities()`를 사용하므로 DB role이 최종 결정.

### SecurityConfig — 엔드포인트별 접근 제어

| 엔드포인트           | 설정                | 비고                                             |
| -------------------- | ------------------- | ------------------------------------------------ |
| `/api/ui/**`       | `permitAll()`     | RBAC는 컨트롤러+서비스 레이어에서 처리           |
| `/api/goalTime/**` | `permitAll()`     | 컨트롤러 레벨에서 부분 인증 처리                 |
| `/api/execute/**`  | `permitAll()`     | **🟡 P0 — Controller 레벨 required_role 검증 추가됨 (V15 DB 적용 후 완전 적용)** |
| `/api/content/**`  | `authenticated()` | Spring Security 레벨 보호                        |
| `/api/admin/**`    | `hasRole("ADMIN")` | ✅ 2026-03-08 추가 — ADMIN 전용 (SecurityConfig line 90) |
| 나머지               | `denyAll()`       | 기본 차단                                        |

**Spring Security 레벨의 `hasRole()` 접근 규칙: `/api/admin/**`에 최초 적용 (2026-03-08)**

### UiController → UiService RBAC (ui_metadata 컴포넌트 필터링)

```java
// UiController.getUiMetadataList()
String userRole = (userDetails != null)
    ? extractRole(userDetails)   // UserDetails.getAuthorities().stream().findFirst()
    : "ROLE_GUEST";              // 비인증 → ROLE_GUEST

// UiService.isAccessible()
private boolean isAccessible(UiMetadata entity, String userRole) {
    String allowedRoles = entity.getAllowedRoles();
    if (allowedRoles == null || allowedRoles.trim().isEmpty()) return true; // NULL → 전체 허용
    return Arrays.stream(allowedRoles.split(","))
            .map(String::trim)
            .anyMatch(role -> role.equals(userRole));
}
```

### allowed_roles 값별 가시성

| `allowed_roles` 값 | ROLE_GUEST | ROLE_USER |
| -------------------- | ---------- | --------- |
| `NULL`             | ✅ 표시    | ✅ 표시   |
| `'ROLE_GUEST'`     | ✅ 표시    | ❌ 숨김   |
| `'ROLE_USER'`      | ❌ 숨김    | ✅ 표시   |

### CustomUserDetails — getAuthorities()

```java
// DB users.role 컬럼에서 직접 읽음
@Override
public Collection<? extends GrantedAuthority> getAuthorities() {
    return Collections.singletonList(new SimpleGrantedAuthority(user.getRole()));
}
```

`UiController.extractRole()`이 이 메서드를 호출하므로 최종 role은 **DB 값 기준**.

### RBAC 계층 요약

| 레이어                             | Role 소스                     | 사용 목적                                                 |
| ---------------------------------- | ----------------------------- | --------------------------------------------------------- |
| JwtAuthenticationFilter            | JWT 클레임 `"role"`         | SecurityContext 인증 토큰 생성                            |
| CustomUserDetails.getAuthorities() | DB `users.role`             | UiController extractRole()                                |
| SecurityConfig                     | —                            | 역할 기반 URL 접근제어 미사용 (permitAll/authenticated만) |
| UiService.isAccessible()           | `ui_metadata.allowed_roles` | 화면 컴포넌트별 RBAC 필터링                               |

---

## 분석 히스토리 (2026-03-08 기준)

| 날짜       | 분석 내용                                                              | 결론                                                                                                                                  |
| ---------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-28 | 전체 백엔드 코드 초기 분석                                             | 위 내용 도출                                                                                                                          |
| 2026-02-28 | [P1] 보안 감사 — anyRequest().permitAll() 위험도 분석                 | 아래 섹션 참고                                                                                                                        |
| 2026-03-06 | Docker DB 포트 변경 + Flyway V1~V8 수정 완료                           | 로컬 Docker DB 섹션 참고                                                                                                              |
| 2026-03-06 | 보안 체크리스트 재확인, Redis/UiService 확인                           | P0-2 JWT role ✅ 수정됨, EXCLUDE_URLS 오타 ✅ 수정됨, ui:metadata Redis 캐시 확인됨                                                   |
| 2026-03-08 | System.out.println → SLF4J 전환 완료                                  | 11개 파일 45건 전환, 주석 블록 3건만 잔존 (비활성)                                                                                    |
| 2026-03-08 | JwtAuthenticationFilter + SecurityConfig RBAC/user role 전체 흐름 분석 | RBAC 구현 현황 상세 분석 섹션 추가. Spring Security 레벨 role-based URL 제어 미사용 확인. UiService.isAccessible()이 실질적 RBAC 담당 |
| 2026-03-08 | 관리자페이지 기획 + P0-1 `/api/execute/**` 무인증 취약점 해소 (Option B) | query_master.required_role 컬럼 추가, QueryMaster.java + CommonQueryController.java 수정 완료. V15 마이그레이션 초안 작성(.ai/). AdminController/Service Phase 1~6 구현 계획 수립. 로컬 DB 환경 기준 진행 예정 |
| 2026-03-08 | 로컬 DB 전환 + V13/V14 버그 수정 + V15 migration 폴더 배치 | application.yml 5432/testdb 전환. V13·V14 `sql_text`→`query_text` 컬럼명 오류 수정. V15 db/migration 폴더 이동 완료. 로컬 서버 실행 후 마이그레이션 적용 대기 중 |
| 2026-03-08 | 순서 1~3 완료 — 서버 기동 확인, SecurityConfig ADMIN 보호, AdminUserController/Service 신규 생성 | V12~V15 로컬 DB 적용 완료(서버 시작 로그 확인). `SecurityConfig.java:90` `/api/admin/**` → `hasRole("ADMIN")` 추가. `domain/admin/` 패키지 신규 — `AdminUserController`, `AdminUserService`, `AdminUserResponse`, `UpdateUserRoleRequest`. `UserRepository`에 `findUsersForAdmin`·`countUsersForAdmin` JPQL 쿼리 추가. |
| 2026-03-08 | 순서 4~5 완료 — V16/V17 Flyway 마이그레이션 작성 | V16: `find_users_for_admin` query_master 등록 + `GET_ADMIN_STATS` required_role 누락 수정. V17: `USER_LIST` 스크린 ui_metadata 등록 — `user_list_page`(GROUP), `user_list_header`(GROUP), `user_list_title`(TEXT), `user_list_back_btn`(BUTTON/LINK→MAIN_PAGE), `user_list_table`(ADMIN_USER_TABLE). |
| 2026-03-08 | 순서 6 완료 — Frontend ADMIN_USER_TABLE 컴포넌트 구현 | `useAdminUsers.ts` 훅(검색 query state, 체크박스 max-5, PUT 권한변경), `AdminUserTable.tsx`(기존 Pagination 재사용, 행 클릭 체크박스), `componentMap.tsx`(ADMIN_USER_TABLE 등록), `pages.css`(admin page CSS 추가). |
| 2026-03-10 | main 브랜치 AWS 배포 — 연속 5가지 오류 수정 | (1) nginx proxy 8081→8080 수정 (`/etc/nginx/sites-enabled/yerin.duckdns.org`). (2) `global.error.GlobalExceptionHandler` 삭제 — `global.exception.GlobalExceptionHandler`와 bean 이름 충돌(`ConflictingBeanDefinitionException`). (3) Flyway V1 checksum 불일치 수정 — SDUI_TD에 SDUI_LAB 값(-559520453)이 들어가 있어 main 브랜치 실제 값(-1381310958)으로 UPDATE. (4) V3 마이그레이션 `SELECT setval(...)` → `PERFORM setval(...)` — PL/pgSQL DO 블록 내에서 SELECT는 목적지 없어 오류. (5) `domain/diary/` 패키지 전체 삭제 — V7이 diary 테이블 드롭했지만 Diary.java @Entity 잔존 → `Hibernate validate: missing table [diary]`. diary→content 마이그레이션 플랜(`.ai/architect/diary_to_content_migration_plan.md`) Step 5 미완이었음. `domain/content`가 이미 완전히 구현되어 있으므로 diary 패키지 삭제. |
| 2026-03-10 | ADDITIONAL_INFO_PAGE `data:[]` 문제 분석 및 V19 마이그레이션 작성 | Vercel(`yerin.duckdns.org`) 접속 시 `/api/ui/ADDITIONAL_INFO_PAGE` → `data:[]` 반환. Flyway V1~V18 중 어느 파일에도 ADDITIONAL_INFO_PAGE 메타데이터 INSERT 없음(V1은 MAIN_SECTION 1건만). `backup_aws_data.sql`에 해당 화면 데이터(ui_id 1036~1039) 존재하나 SDUI_TD에 미적용 상태. V19__add_additional_info_page.sql 작성: HEADER_TEXT(TEXT), PHONE_INPUT(INPUT/ref_data_id=phone), ADDRESS_GROUP(ADDRESS_SEARCH_GROUP), SUBMIT_BTN(BUTTON/SUBMIT_ADDITIONAL_INFO) — WHERE NOT EXISTS 중복 방지. 커밋 대기 중. |
| 2026-03-17 | V23~V26 Flyway squash 완료 + AI 영어 채팅 멤버십 연동 구현 | (1) V23~V40 → V23~V26 squash 마이그레이션 완료. (2) Docker DB V22 PK 충돌 수정: `V22__seed_ui_metadata.sql`에 `SELECT setval(pg_get_serial_sequence('ui_metadata','ui_id'), COALESCE((SELECT MAX(ui_id) FROM ui_metadata),0))` 추가. (3) V26(`interview_resume` 테이블) 끝에 AI 영어 채팅 전환 4개 UPDATE 통합(V27 삭제). (4) `MembershipRepository.findByName(String)` 추가. (5) `UserMembershipService.grantByMembershipName(Long,String,String)` 추가 — 기존 `grant(UserMembershipRequest)` 대신 직접 엔티티 빌더 사용(Request DTO에 setter/builder 없음). (6) `AuthController` SUBMIT_ADDITIONAL_INFO 처리 후 `grantByMembershipName(user.getUserSqno(),"프리미엄","register")` 호출 추가 — 신규 가입자 전원 프리미엄 자동 부여. (7) `application.yml`에 `cloud.gcp.document-ai.*`, `cloud.aws.*`, `fastapi.*` 기본값 추가 — no-profile bootRun(Docker DB 테스트) 시 Bean 초기화 실패 방지. |
| 2026-03-17 | FastAPI 서버 Docker 배포 설정 추가 → 비활성화 | (1) `pronounce-api/Dockerfile` 생성 — python:3.11-slim + default-jdk-headless(konlpy/JPype용). (2) `docker-compose.yml`·`deploy.yml`에 sdui-fastapi 서비스/배포 추가. **→ 현재 비활성화**: Spring Boot가 FastAPI 대신 OpenAI GPT를 직접 호출하고 있어 주석 처리. 재활성화 조건: AI 면접관 이력서 분석 기능 구현 시 — docker-compose.yml의 `sdui-fastapi` 서비스, `depends_on`, `FASTAPI_URL` 주석 해제 + deploy.yml 빌드 step의 `if: false` 제거 + EC2 스크립트 주석 해제. |
| 2026-03-17 | 카카오톡 약속 알림 기능 구현 (V27 마이그레이션) | SET_TIME_PAGE 약속 시간 저장 시 3시간/1.5시간/30분 전 카카오톡 자동 알림 3회 발송 기능 구현. 상세 사양은 아래 섹션 참조. |

---

## 카카오톡 약속 알림 기능 구현 사양 (2026-03-17)

### 기능 개요
`SET_TIME_PAGE`에서 약속 시간 저장 시, 해당 약속 **3시간 / 1시간 30분 / 30분** 전에 카카오톡 "나에게 보내기" 메시지 3회 자동 발송.

### 아키텍처 결정
- 방식: Spring Boot `@Scheduled` (1분 주기) + 카카오 "나에게 보내기" API (`/v2/api/talk/memo/default/send`)
- 토큰: `users` 테이블에 `kakao_access_token` / `kakao_refresh_token` 컬럼 추가 저장
- 알림 추적: `goal_settings` 테이블에 `notif_sent_30min` / `notif_sent_90min` / `notif_sent_180min` boolean 컬럼 추가
- 이메일 로그인 유저: `kakao_access_token IS NULL` → 스케줄러에서 skip (별도 UI 변경 없음)

### 카카오 토큰 생명주기
- access_token 유효기간: 6시간
- refresh_token 유효기간: 60일
- 발송 직전 만료 확인(5분 버퍼) → 만료 시 `POST https://kauth.kakao.com/oauth/token` (grant_type=refresh_token)으로 갱신 후 발송
- `/api/kakao/callback` (웹 OAuth 흐름): access_token + refresh_token 모두 저장
- `/api/kakao/login` (프론트엔드 OAuth 흐름): access_token만 저장, refresh_token=null

### 주요 신규 파일
| 파일 경로 | 역할 |
|-----------|------|
| `domain/kakao/service/KakaoNotificationService.java` | 메시지 구성 + 카카오 API 발송 + 토큰 갱신 |
| `domain/kakao/scheduler/AppointmentNotificationScheduler.java` | 1분마다 알림 대상 조회 + 발송 트리거 |
| `resources/db/migration/V27__add_kakao_tokens_and_notif_flags.sql` | DB 스키마 변경 |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `DemoBackendApplication.java` | `@EnableScheduling` 추가 (누락 상태였음) |
| `domain/user/domain/User.java` | kakaoAccessToken, kakaoRefreshToken, kakaoTokenExpiresAt 필드 추가 |
| `domain/user/service/KakaoService.java` | registerKakaoUser() 시그니처 변경 + refreshKakaoToken() 추가 |
| `domain/user/controller/KakaoController.java` | /callback에서 refresh_token, expires_in 추출 후 KakaoService에 전달 |
| `domain/time/domain/GoalSetting.java` | notifSent30min / notifSent90min / notifSent180min 필드 추가 |
| `domain/time/domain/GoalSettingRepository.java` | 각 시간 창별 알림 대상 조회 JPQL 쿼리 3개 추가 |

### 스케줄러 로직
- `fixedDelay = 60,000ms` (1분)
- 각 약속에 대해 3개 시간 창 체크 (±2분 오차 허용):
  - 180분(3h) 전: `targetTime BETWEEN now+178min AND now+182min`
  - 90분(1.5h) 전: `targetTime BETWEEN now+88min AND now+92min`
  - 30분 전:      `targetTime BETWEEN now+28min AND now+32min`
- 해당 플래그(`notifSent*`)가 `false`인 건만 처리, 성공 후 `true`로 업데이트
- 발송 실패 시 log.error() 후 예외 전파 없이 계속 진행

### 메시지 포맷
| 시간 | 메시지 |
|------|--------|
| 3시간 전 | "⏰ 3시간 뒤에 약속이 있습니다!\n목표 시간: HH:mm\n각오: {todaysMessage}" |
| 1시간 30분 전 | "⏰ 1시간 30분 뒤에 약속이 있습니다!\n목표 시간: HH:mm" |
| 30분 전 | "⏰ 30분 뒤에 약속이 있습니다!\n목표 시간: HH:mm" |

### DB 마이그레이션 (V27)
```sql
ALTER TABLE users
  ADD COLUMN kakao_access_token     TEXT,
  ADD COLUMN kakao_refresh_token    TEXT,
  ADD COLUMN kakao_token_expires_at TIMESTAMP;

ALTER TABLE goal_settings
  ADD COLUMN notif_sent_30min  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN notif_sent_90min  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN notif_sent_180min BOOLEAN NOT NULL DEFAULT FALSE;
```

## 카카오 알림 버그 수정 (2026-03-18)

### 버그 1: 메모가 이전 값으로 표시되는 문제

**증상**: SET_TIME_PAGE에서 새 메모를 저장해도 RecordTimeComponent에 이전 메모("화이팅")가 표시됨

**원인**: `getGoalTime()`과 `getGoalMemo()`가 **다른 row**를 참조
- `getGoalTime()` → `GET_USER_GOAL_TIME` SQL: `ORDER BY target_time ASC LIMIT 1` (가장 이른 미래 goal)
- `getGoalMemo()` → `findFirstByUserSqnoOrderByCreatedAtDesc()` (가장 최근 저장된 goal)
- 여러 개의 goal이 있을 때 두 메서드가 서로 다른 row를 반환할 수 있음

**수정 파일**:
- `domain/time/domain/GoalSettingRepository.java` — `getGoalTime()`과 동일 기준 메서드 추가
  ```java
  GoalSetting findFirstByUserSqnoAndStatusIsNullAndTargetTimeGreaterThanEqualOrderByTargetTimeAsc(
          Long userSqno, LocalDateTime startOfDay);
  ```
- `domain/time/service/GoalTimeQueryService.java` — `getGoalMemo()`를 동일 기준으로 수정
  ```java
  LocalDateTime startOfToday = LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay();
  GoalSetting goal = goalSettingRepository
          .findFirstByUserSqnoAndStatusIsNullAndTargetTimeGreaterThanEqualOrderByTargetTimeAsc(
                  userSqno, startOfToday);
  ```

---

### 버그 2: EC2/브라우저 환경에서 카카오 알림 미발송

**증상**: 로컬 Docker(Windows KST)에서는 카카오 메시지 발송되지만, EC2 서버(UTC)에서는 미발송

**원인**: 타임존 불일치
- `GoalTimeController.saveGoalTime()` → 항상 KST로 변환 후 `LocalDateTime`으로 저장
  ```java
  finalTargetTime = ZonedDateTime.parse(targetTimeStr)
          .withZoneSameInstant(ZoneId.of("Asia/Seoul")).toLocalDateTime();  // KST 기준 저장
  ```
- `AppointmentNotificationScheduler` → `LocalDateTime.now()` 사용
  - 로컬 Windows(KST): `now` = KST → DB 값과 일치 → 알림 발송 ✓
  - EC2 서버(UTC): `now` = UTC → DB 값(KST)과 9시간 차이 → 알림 창 불일치 → 미발송 ✗

**수정 파일**: `domain/kakao/scheduler/AppointmentNotificationScheduler.java`
```java
// 변경 전
LocalDateTime now = LocalDateTime.now();
// 변경 후
LocalDateTime now = LocalDateTime.now(ZoneId.of("Asia/Seoul"));
```

**근본 원인**: DB에 타임존 정보 없는 `LocalDateTime`을 KST 기준으로 저장하는 방식의 한계. 향후 개선 시 `TIMESTAMP WITH TIME ZONE` (UTC 저장) 방식 권장.

---

## AI 도메인 백엔드 설계 (2026-03-11, .ai2 병합)

> 원본: `.ai2/backend_engineer/research.md`

### 신규 패키지 구조
```
SDUI-server/src/main/java/com/domain/demo_backend/
├── domain/
│   ├── ai/          # STT, Chat, Interview (AiSttController, AiChatController 등)
│   └── membership/  # Membership, UserMembership
└── global/config/
    └── AsyncConfig.java  # SseEmitter용 ThreadPool
```

### OpenAI RestClient 패턴

```java
// Chat Completions SSE 스트리밍
restClient.post()
    .uri("/chat/completions")
    .body(requestBody)
    .exchange((request, response) -> {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.getBody()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("data: ") && !line.equals("data: [DONE]")) {
                    String chunk = extractContent(line.substring(6));
                    onChunk.accept(chunk);
                }
            }
            onComplete.run();
        }
        return null;
    });
```

### SseEmitter 패턴
```java
@PostMapping(value = "/api/ai/chat/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter chat(@RequestBody ChatRequest req) {
    SseEmitter emitter = new SseEmitter(30_000L);
    executor.execute(() -> chatService.stream(req, emitter));
    return emitter;
}
```

### 멤버십 DB 스키마

| 테이블 | 주요 컬럼 |
|--------|-----------|
| `memberships` | id, name, can_learn, can_converse, can_analyze, duration_days, price_cents |
| `user_memberships` | id, user_id, membership_id, started_at, expires_at, status, granted_by |

### build.gradle 추가
```groovy
implementation 'org.apache.pdfbox:pdfbox:3.0.2'  // PDF 파싱
// RestClient는 Spring Boot 내장, 별도 추가 불필요
```

### 분석 히스토리

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-11 | OpenAI SDK vs RestClient | RestClient 채택 (의존성 최소화) |
| 2026-03-11 | SseEmitter vs WebFlux | SseEmitter 채택 (기존 MVC 유지) |
| 2026-03-11 | pronounce-api 역할 재정의 | 발음 채점만 유지, STT/TTS → OpenAI |


---

## Slack 웹훅 알림 연동 (2026-03-19)

### 개요
카카오톡 약속 알림과 동일한 이벤트(30/90/180분 전)에 Slack 웹훅으로 동시 발송.
`slack.webhook-url` 미설정 시 자동 skip → 개발/테스트 환경에서 부작용 없음.

### 신규 파일

| 파일 | 역할 |
|------|------|
| `domain/kakao/service/SlackNotificationService.java` | 웹훅 POST 발송, 내부 예외 처리 (caller에 전파 안 함) |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `domain/kakao/scheduler/AppointmentNotificationScheduler.java` | `SlackNotificationService` 필드 추가, `sendAndMark()` 안에서 Kakao 직후 Slack 호출 |
| `src/test/.../AppointmentNotificationSchedulerTest.java` | `@Mock SlackNotificationService slackNotifService` 추가 |
| `src/main/resources/application.yml` | `slack.webhook-url: ${SLACK_WEBHOOK_URL:<default>}` 추가 |

### 설정

```yaml
# application.yml
slack:
  webhook-url: ${SLACK_WEBHOOK_URL:https://hooks.slack.com/services/...}
```

**GitHub Actions Secret**: `SLACK_WEBHOOK_URL` 으로 등록 → EC2 배포 시 환경변수로 주입.
`application.yml` 기본값은 로컬 개발용. 프로덕션에서는 환경변수가 우선 적용됨.

### 발송 흐름 (sendAndMark)

```
카카오 sendReminder() ──→ 성공
                        ↓
                Slack sendReminder() ──→ 성공/실패(내부 처리)
                        ↓
               notifSent 플래그 저장 (goalRepo.save)
```
- 카카오 실패 → 예외 catch → Slack도 미발송 → 플래그 미저장 → 1분 후 재시도
- Slack 실패 → 로그만 기록 → 플래그 정상 저장 (재발송 없음)

### 분석 히스토리 추가

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-19 | Slack 웹훅 채널 선택 | 웹훅(Incoming Webhook) 채택 — Bot API 불필요 |

---

## 일일 LeetCode 문제 Slack 발송 — Phase 2.5 (2026-03-19)

### 개요
취업 준비생 코딩 인터뷰 습관 형성을 위해 매일 09:00 KST에 LeetCode Top Interview 문제를 Slack으로 발송.
FastAPI 불필요 — Spring Boot + DB로 모든 로직 처리.

### 신규 파일

| 파일 | 역할 |
|------|------|
| `domain/leetcode/domain/LeetcodeProblem.java` | JPA 엔티티 — `id, title, slug, difficulty, category, displayOrder, sentDate` |
| `domain/leetcode/domain/LeetcodeProblemRepository.java` | `findFirstBySentDateIsNullOrderByDisplayOrderAsc()` 파생 쿼리 |
| `domain/leetcode/scheduler/DailyLeetcodeScheduler.java` | `@Scheduled(cron="0 0 9 * * *", zone="Asia/Seoul")`, sent_date 마킹 |
| `resources/db/migration/V28__add_leetcode_problems.sql` | `leetcode_problems` 테이블 + 부분 인덱스 + 57문제 시드 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `domain/kakao/service/SlackNotificationService.java` | `sendDailyLeetcode(LeetcodeProblem)` 추가 — 이모지 난이도(🟢🟡🔴) + 제목 + URL |

### DB 스키마 (V28)

```sql
CREATE TABLE leetcode_problems (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    slug          VARCHAR(200) NOT NULL UNIQUE,
    difficulty    VARCHAR(10)  NOT NULL,
    category      VARCHAR(50)  NOT NULL,
    display_order INT          NOT NULL,
    sent_date     DATE                      -- NULL = 미발송
);
CREATE INDEX idx_leetcode_unsent ON leetcode_problems (display_order)
    WHERE sent_date IS NULL;
```

시드: Array·Strings·Linked List·Trees·Sorting·DP·Design·Math·Others 카테고리 57문제.

### 중복 방지 전략
- `sent_date IS NULL` 인 문제만 조회 → 발송 직후 `LocalDate.now(ZoneId.of("Asia/Seoul"))` 마킹
- 57문제 전부 발송 완료 시 로그만 출력 (`전체 문제 발송 완료 (57/57)`)

### 빌드 결과
`./gradlew build` — BUILD SUCCESSFUL (3m 10s)

### 분석 히스토리 추가

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-19 | LeetCode 공식 API 부재 | slug + URL 조합 방식 채택 (ToS 위반 없음) |
| 2026-03-19 | FastAPI vs Spring Boot | Spring Boot 직접 관리 — AI 불필요, 스케줄러 책임 단일화 |
| 2026-03-19 | Slack 실패 시 retry 정책 | Kakao 성공 기준으로 플래그 저장, Slack은 best-effort |

---

## 운영 모니터링 Slack 알림 — Phase 1-A (2026-03-19)

### 개요
서비스 운영 중 발생하는 주요 이벤트를 Slack으로 실시간 알림.

| 알림 종류 | 트리거 조건 | 발송 내용 |
|-----------|------------|-----------|
| 신규 가입 | 추가정보 입력 완료 (`/api/auth/update-profile`) | 🎉 가입 이메일 + 누적 회원수 |
| 5xx 서버 오류 | NPE, 기타 Exception (전역 핸들러) | 🔴 예외 타입 + 경로 + 메시지 |
| OpenAI 비용 초과 | 일일 추정 비용 >= 임계값 (`$5.0` 기본) | 💸 일일 비용 + 임계값 |

### 신규 파일

#### `domain/kakao/service/OperationAlertService.java`
- `sendNewUser(String email, long totalCount)` — 신규 가입 알림
- `sendError(String exceptionType, String message, String path)` — 5xx 오류 알림
- `sendCostAlert(double dailyCost, double threshold)` — OpenAI 비용 임계 알림
- `SlackNotificationService.sendAlert()` 위임 구조

### 수정 파일

#### `domain/kakao/service/SlackNotificationService.java`
`sendAlert(String text)` 메서드 추가 — 임의 텍스트를 Slack으로 발송

#### `global/exception/GlobalExceptionHandler.java`
- `OperationAlertService` 생성자 주입
- `handleNullPointerException` + `handleGenericException` (5xx)에만 `sendError()` 호출
- 400 계열 (`BusinessException`, `Validation`, `DataIntegrity`, `IllegalArgument`) 은 알림 제외

#### `domain/user/controller/AuthController.java`
- `OperationAlertService` 생성자 주입
- `updateAdditionalInfo()` 완료 후 `sendNewUser(email, userRepository.count())`

#### `domain/ai/client/OpenAiClient.java`
- `@Value("${openai.cost.threshold:5.0}")` — application.yml 수정 없이 기본값 사용
- `AtomicLong dailyMicroDollars` — 쓰레드 안전 누적 카운터
- `@Scheduled(cron="0 0 0 * * *", zone="Asia/Seoul") resetDailyCost()` — KST 자정 초기화
- `trackCost(int inputChars, int outputChars)` — GPT-4o 단가로 추정 비용 계산
  - 입력: $2.5/1M tokens × (chars/4)
  - 출력: $10/1M tokens × (chars/4)
  - 단위: 마이크로달러(μ$), 임계 초과 시 알림 발송 후 카운터 초기화
- `streamChat()` / `streamChatObjects()` — `trackCost()` 호출 추가
  - 입력 chars: `messages` 스트림으로 사전 집계
  - 출력 chars: `AtomicLong outputChars`로 청크 누적, `onComplete.run()` 직후 trackCost 호출

### 아키텍처 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 비용 추적 대상 | `OpenAiClient` V1만 (V2 제외) | V2는 테스트 복사본, 실 트래픽은 V1 경유 |
| 알림 중복 방지 | 임계 초과 후 카운터 0 초기화 | 알림 폭탄 방지, 최소 $5 간격으로 재알림 |
| Token 추정 방식 | 4자 = 1 token 근사 | 한국어 포함 범용 근사, 정확 집계는 API usage 필드 필요 |
| 5xx 알림 범위 | NPE + 기타 Exception만 | 400은 비즈니스 정상 흐름, Slack 노이즈 방지 |

### 빌드 결과
`./gradlew test --no-build-cache` — BUILD SUCCESSFUL (3m 8s)

### 분석 히스토리 추가

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-19 | OpenAI SSE는 토큰 수 미반환 | char 수로 근사 추정, 추후 non-streaming 전환 시 usage 필드 활용 가능 |
| 2026-03-19 | OperationAlertService 위치 | `domain/kakao/service/` — Slack 알림 모듈과 동일 패키지 |
| 2026-03-19 | 400 vs 5xx 알림 범위 | 400은 제외, 5xx (NPE + 미처리 Exception)만 알림 |

---

## 일일 면접 질문 Slack 발송 — Phase ⭐2 (2026-03-19)

### 개요
매일 09:10 KST에 미발송 면접 질문 1개를 랜덤 선택하여 Slack으로 발송한다.

### 발송 흐름

```
매일 09:10 KST (DailyInterviewQuestionScheduler)
    │
    ├─ DB: interview_questions WHERE sent_date IS NULL ORDER BY RANDOM() LIMIT 1
    └─ Slack: 🎯 오늘의 면접 질문 [카테고리]
                'question text'
                → 바로 연습하기: https://yerin.duckdns.org/view/INTERVIEW_PAGE
```

> LeetCode(09:00)와 시간을 10분 다르게 하여 Slack 메시지 타이밍 분리

### 신규 파일

| 파일 | 역할 |
|------|------|
| `domain/interview/domain/InterviewQuestion.java` | JPA 엔티티 (id, question, category, sentDate) |
| `domain/interview/domain/InterviewQuestionRepository.java` | `findRandomUnsent()` native query |
| `domain/interview/scheduler/DailyInterviewQuestionScheduler.java` | `@Scheduled(cron="0 10 9 * * *")` |
| `resources/db/migration/V29__add_interview_questions.sql` | 테이블 + 30문제 시드 |

### DB 스키마 (V29)

```sql
CREATE TABLE interview_questions (
    id        SERIAL PRIMARY KEY,
    question  TEXT        NOT NULL,
    category  VARCHAR(50) NOT NULL,  -- 공통/경험역량/가치관/직무/상황대처/마무리
    sent_date DATE                   -- NULL = 미발송
);
```

### 수정 파일

#### `domain/kakao/service/SlackNotificationService.java`
`sendDailyInterviewQuestion(InterviewQuestion)` 메서드 추가

### 시드 데이터 구성 (30문제)

| 카테고리 | 문제 수 |
|---------|--------|
| 공통 | 6 |
| 경험역량 | 6 |
| 가치관 | 5 |
| 직무 | 5 |
| 상황대처 | 5 |
| 마무리 | 3 |

### 아키텍처 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 선택 방식 | `ORDER BY RANDOM()` (글로벌 랜덤) | 매일 새로운 질문, 편향 없음 |
| 발신 채널 | 전체 공용 Slack webhook (단일) | 개인 채널 연동은 Phase 2 이후 |
| 질문 풀 | 정적 30문제 시드 | FastAPI 불필요, LeetCode 패턴 재사용 |
| 전체 발송 완료 시 | 로그만 출력 (정지) | 30일 후 재활용 로직은 추후 추가 |
| 스케줄 시간 | 09:10 KST | LeetCode(09:00)와 구분 |

### 빌드 결과
`./gradlew test` — BUILD SUCCESSFUL (3m 59s)

### 분석 히스토리 추가

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-19 | 개인화 vs 공유 채널 | 1개 Slack webhook → 공유 채널 발송; 개인화는 Phase 2 |
| 2026-03-19 | 랜덤 vs 순서 | ORDER BY RANDOM() — 매일 다른 카테고리 질문 노출 효과 |

---

## Phase ⭐3 — 면접 D-1 리마인더 (2026-03-20)

### 구현 범위

사용자가 면접 날짜를 등록하면 전날 09:00 KST에 Slack D-1 리마인더를 발송.

### 신규 파일

| 파일 | 역할 |
|------|------|
| `resources/db/migration/V30__create_interview_schedule.sql` | `interview_schedule` 테이블 생성 + 부분 인덱스 |
| `domain/interview/domain/InterviewSchedule.java` | JPA 엔티티 (id, userSqno, interviewDate, company, notifSentD1, createdAt) |
| `domain/interview/domain/InterviewScheduleRepository.java` | `findAllByInterviewDateAndNotifSentD1False()` / `findAllByUserSqnoOrderByInterviewDateAsc()` |
| `domain/interview/service/InterviewScheduleService.java` | create / findByUser / delete |
| `domain/interview/controller/InterviewScheduleController.java` | POST / GET / DELETE `/api/interview-schedule` |
| `domain/interview/scheduler/InterviewReminderScheduler.java` | `@Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")` D-1 체크 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `domain/kakao/service/SlackNotificationService.java` | `sendInterviewReminder(InterviewSchedule)` 추가 |

### Slack 메시지 포맷

```
📋 내일 면접이 있습니다! 파이팅!
📅 날짜: 3월 21일 (토)
🏢 회사: 카카오
→ 면접 연습하기: https://yerin.duckdns.org/view/INTERVIEW_PAGE
```

### 아키텍처 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 스케줄 시간 | 09:00 KST (매일) | LeetCode(09:00)와 동일 — 실제로는 순서 비결정적이나 문제 없음 |
| notifSentD1 플래그 | 발송 성공 후 즉시 마킹 | 스케줄러 재실행 시 중복 방지 |
| 삭제 RBAC | 본인 일정만 삭제 가능 | `userSqno` 비교로 소유권 확인 |

### API 엔드포인트

| 메서드 | URL | 설명 |
|--------|-----|------|
| POST | `/api/interview-schedule` | 면접 일정 등록 (`interviewDate`, `company`) |
| GET | `/api/interview-schedule` | 내 일정 목록 (날짜 오름차순) |
| DELETE | `/api/interview-schedule/{id}` | 일정 삭제 (본인 소유 확인) |

### 빌드 결과

`./gradlew test` — BUILD SUCCESSFUL (4m 44s)
`interview_schedule` 테이블 Hibernate drop/create 확인

### 분석 히스토리 추가

| 날짜 | 분석 내용 | 결론 |
|------|-----------|------|
| 2026-03-20 | GoalSetting 확장 vs 신규 테이블 | 신규 `interview_schedule` 테이블 — 관심사 분리, 독립 CRUD |
| 2026-03-20 | 운영자 입력 vs 사용자 직접 | REST API 사용자 직접 등록 — 확장성 우선 |

---

## 콘텐츠 "나만 보기" (is_private) 기능 (2026-03-20)

### 개요

콘텐츠 작성 시 "나만 보기" 체크박스를 추가하여 비공개 처리. 공개 목록에서 완전 제거, 상세 조회는 작성자·어드민만 허용.

### DB 변경 (V31)

| 변경 | 내용 |
|------|------|
| `content.is_private` 컬럼 | `BOOLEAN NOT NULL DEFAULT FALSE` |
| `GET_CONTENT_LIST_PAGE` 쿼리 | `AND d.is_private = FALSE` 조건 추가 — 공개 목록에서 비공개 완전 제외 |
| `COUNT_CONTENT_LIST` 쿼리 | 동일하게 `AND d.is_private = FALSE` 추가 |
| `ui_metadata` | CONTENT_WRITE 화면에 CHECKBOX 컴포넌트(`is_private`, sort_order=65) 추가 |

### role_nm / role_cd 분석 결과

| 컬럼 | 역할 |
|------|------|
| `role_nm` | 콘텐츠 작성 시점 사용자 역할 기록 (`ROLE_USER`, `ROLE_ADMIN`) — 감사 이력. `addContent()`에서 `user.getRole()` 복사 |
| `role_cd` | 현재 **미사용** (모두 NULL). 향후 역할 코드 체계 예약 컬럼 |

사용자 식별 기준: `user_sqno`(Long FK) 주 식별자, `user_id`(String) 보조.

### 가시성 정책

| 상황 | 동작 |
|------|------|
| 공개 목록(`GET_CONTENT_LIST_PAGE`) | `is_private = false`만 노출 — 타인에게 완전 숨김 |
| 내 콘텐츠 목록(`GET_MEMBER_CONTENT_LIST`) | 본인의 비공개 글 포함 전체 표시 (필터 없음) |
| 상세 조회(`viewContentItem`) | 비공개면 작성자 또는 `ROLE_ADMIN`만 허용, 타인은 404 |

### 수정된 파일

| 파일 | 변경 내용 |
|------|----------|
| `Content.java` | `isPrivate boolean` 필드 (`@Builder.Default = false`) |
| `ContentRequest.java` | `@JsonProperty("is_private") Boolean isPrivate` |
| `ContentRepository.java` | `findByContentIdAndDelYn()` 추가 |
| `ContentService.java` | `addContent()` isPrivate 저장 + `viewContentItem()` 권한 체크 + `Authentication` 파라미터 추가 |
| `ContentController.java` | `viewContentItem()`에 `Authentication` 주입 → 서비스로 전달 |

### 빌드 결과

`./gradlew build -x test` — BUILD SUCCESSFUL
| 2026-03-20 | Slack plain text → Block Kit 포맷 | Block Kit 전환 (header/section/context) + WebClient 교체 — Phase 1-B 완료 |

---

## Slack 알림 대상 멘션 처리 설계 (2026-03-22)

### 1. 개요
백엔드 `SlackNotificationService`에서 발생하는 모든 슬랙 알림(예: 약속 리마인더, LeetCode, 면접 질문, 가입 알림 등) 발송 시, 특정 사용자의 슬랙 ID(`U0AM4840JFR`)를 멘션(`<@U0AM4840JFR>`)하여 알림이 직접 도달하도록 개선한다.

### 2. 구현 계획 (Plan)
- **application.yml**: `slack.target-user-id: ${SLACK_TARGET_USER_ID:U0AM4840JFR}` 속성을 추가하여 환경변수를 통한 주입 또는 기본값 하드코딩 지원.
- **SlackNotificationService 수정**: `@Value("${slack.target-user-id:U0AM4840JFR}")` 값 스캔.
- **발송 로직 업데이트**: 멘션 구문(`<@USER_ID> `)을 알림 텍스트 또는 Block Kit의 `mrkdwn` 텍스트 앞/뒤에 결합하여 발송하도록 반영.

### 3. 작업 과정 (Process)
1. `application.yml`에 `target-user-id` 프로퍼티 추가.
2. `SlackNotificationService.java` 내 각종 발송 메서드(`sendReminder`, `sendDailyLeetcode`, `sendDailyInterviewQuestion`, `sendInterviewReminder`, `sendAlert`)의 메시지 조합부에 멘션 문자열 주입 추가.
3. 빌드를 통한 검증 수행.
