# Google Calendar 연동 계획 (goal_settings)

작성일: 2026-03-20
브랜치: feature/addAIChore

---

## 요구사항 정리 (사용자 답변 기반)

| 항목 | 결정 |
|------|------|
| 연동 방식 | 사용자별 Google OAuth2 (각자 계정 연결) |
| 이벤트 생성 시점 | `saveGoalTime()` 호출 즉시 생성 |
| 알림 전략 | 3채널 병행 (Kakao + Slack + Google Calendar) |
| 토큰 저장 | 별도 `google_oauth_tokens` 테이블 + Redis 캐싱 |
| 이벤트 내용 | targetTime + todaysMessage + 도착 결과 업데이트 |
| 연결 UI | SET_TIME_PAGE 버튼 → 추후 프로필/설정 페이지 통합 |

---

## 아키텍처 설계

### 전체 흐름

```
[SET_TIME_PAGE]
    │
    ├─ "구글 캘린더 연결" 버튼 클릭
    │       └─ GET /api/google/auth-url → 구글 OAuth 동의 화면
    │                └─ callback: GET /api/google/callback?code=...
    │                        └─ 토큰 교환 → google_oauth_tokens 저장 + Redis 캐시
    │
    └─ 목표 저장 (saveGoalTime)
            ├─ goal_settings DB 저장 (기존)
            ├─ Kakao 알림 예약 (기존 스케줄러)
            ├─ Slack 알림 예약 (기존 스케줄러)
            └─ Google Calendar 이벤트 생성 (신규, 비동기)
                    └─ google_calendar_event_id → goal_settings에 저장

[도착 기록 (arrival API)]
    └─ updateGoalResult()
            └─ 구글 캘린더 이벤트 제목 업데이트
                    ✅ 도착 성공 → "✅ [성공] 목표 도착: 09:00"
                    ❌ 지각 → "❌ [지각] 목표 도착: 09:00"
```

### Google Calendar 이벤트 구조

```json
{
  "summary": "⏰ 목표 도착: 오전 9:00",
  "description": "각오: 오늘은 꼭 일찍 도착하자",
  "start": { "dateTime": "2026-03-20T09:00:00+09:00", "timeZone": "Asia/Seoul" },
  "end":   { "dateTime": "2026-03-20T09:30:00+09:00", "timeZone": "Asia/Seoul" },
  "reminders": {
    "useDefault": false,
    "overrides": [
      { "method": "popup", "minutes": 180 },
      { "method": "popup", "minutes": 90  },
      { "method": "popup", "minutes": 30  }
    ]
  }
}
```

---

## 구현 완료 현황 (2026-03-20) — 전체 완료 + 테스트 통과

| Phase | 상태 | 주요 파일 |
|-------|------|-----------|
| 0 — 기반 설정 | ✅ 완료 | `application.yml` (google.oauth 설정), `V34__add_google_calendar.sql` |
| 1 — OAuth 흐름 | ✅ 완료 | `domain/google/` 전체 패키지 신설 |
| 2 — Calendar API | ✅ 완료 | `GoogleCalendarService.java`, `GoalTimeQueryService.java` 수정 |
| 3 — Frontend | ✅ 완료 | `useBusinessActions.tsx`, `screenMap.ts`, `page.tsx` |
| 버그 수정 | ✅ 완료 | `GoogleOAuthService`, `GoogleCalendarService` WebClient.Builder 패턴 수정 |

### 버그 수정 이력 (2026-03-20)
- **원인**: `@RequiredArgsConstructor` + `private final WebClient webClient` → Spring이 `WebClient` 빈을 찾지 못함 (`NoSuchBeanDefinitionException`) → 전체 테스트 13개 실패
- **수정**: 기존 `KakaoService`, `SlackFileService`와 동일한 패턴으로 명시적 생성자에서 `WebClient.Builder`를 받아 `.build()` 호출
- **추가**: `@Value` 필드에 `:` 기본값 추가 (`${google.oauth.client-id:}`) → 테스트 환경에서 환경변수 없어도 안전
- **결과**: `./gradlew test` BUILD SUCCESSFUL (57 tests, 0 failed)

---

## 구현 단계

### Phase 0 — 기반 설정

#### Step 1. build.gradle 의존성 추가
```groovy
// Google API 클라이언트
implementation 'com.google.apis:google-api-services-calendar:v3-rev20220715-2.0.0'
implementation 'com.google.auth:google-auth-library-oauth2-http:1.19.0'
implementation 'com.google.http-client:google-http-client-jackson2:1.43.3'
```

#### Step 2. application.yml 설정 추가
```yaml
google:
  oauth:
    client-id: ${GOOGLE_CLIENT_ID:}
    client-secret: ${GOOGLE_CLIENT_SECRET:}
    redirect-uri: ${GOOGLE_REDIRECT_URI:http://localhost:3000/view/GOOGLE_CALLBACK}
    scopes:
      - https://www.googleapis.com/auth/calendar.events
```

#### Step 3. V34 Flyway 마이그레이션
```sql
-- google_oauth_tokens 테이블 (별도 관리)
CREATE TABLE google_oauth_tokens (
    id            BIGSERIAL    PRIMARY KEY,
    user_sqno     BIGINT       NOT NULL UNIQUE REFERENCES users(user_sqno),
    access_token  TEXT         NOT NULL,
    refresh_token TEXT         NOT NULL,
    token_expiry  TIMESTAMPTZ  NOT NULL,
    created_at    TIMESTAMPTZ  DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX idx_google_tokens_user ON google_oauth_tokens (user_sqno);

-- goal_settings에 이벤트 ID 컬럼 추가
ALTER TABLE goal_settings
    ADD COLUMN google_calendar_event_id VARCHAR(200);
```

---

### Phase 1 — Backend OAuth + Calendar API

#### 파일 구조
```
domain/google/
├── controller/
│   └── GoogleOAuthController.java
├── domain/
│   ├── GoogleOAuthToken.java         (JPA 엔티티)
│   └── GoogleOAuthTokenRepository.java
├── dto/
│   └── GoogleConnectStatusResponse.java
└── service/
    ├── GoogleOAuthService.java       (OAuth 흐름)
    └── GoogleCalendarService.java    (Calendar API)
```

#### GoogleOAuthController.java 엔드포인트

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/google/auth-url` | 구글 OAuth 동의 URL 반환 (인증 필요) |
| GET | `/api/google/callback?code=...&state=...` | 인증 코드 → 토큰 교환 + DB 저장 |
| DELETE | `/api/google/disconnect` | 연결 해제 (토큰 삭제) |
| GET | `/api/google/status` | 연결 여부 확인 |

#### GoogleOAuthService.java 메서드

```java
String buildAuthorizationUrl(Long userSqno);   // state에 userSqno 포함
void exchangeCode(String code, String state);  // 토큰 교환 → DB 저장
String getValidAccessToken(Long userSqno);     // Redis 확인 → 만료 시 refresh → 반환
void revokeToken(Long userSqno);               // 연결 해제
boolean isConnected(Long userSqno);            // 연결 여부
```

#### GoogleCalendarService.java 메서드

```java
// goal_setting 저장 후 호출 (비동기)
String createEvent(Long userSqno, LocalDateTime targetTime, String message);

// arrival API 호출 후 이벤트 업데이트
void updateEventResult(Long userSqno, String eventId, String status);
```

#### 토큰 캐싱 전략
- Redis key: `GOOGLE_TOKEN:{userSqno}`
- TTL: token_expiry - 5분 (만료 직전 재발급 방지)
- DB fallback: Redis miss 시 DB 조회 → refresh → Redis 재저장

---

### Phase 2 — GoalSetting 통합

#### GoalTimeQueryService 수정

**saveGoalTime()** 끝에 추가:
```java
// 구글 캘린더 이벤트 생성 (best-effort, 비동기)
try {
    if (googleOAuthService.isConnected(userSqno)) {
        String eventId = googleCalendarService.createEvent(userSqno, finalTargetTime, message);
        goalSetting.setGoogleCalendarEventId(eventId);
        goalSettingRepository.save(goalSetting);
    }
} catch (Exception e) {
    log.warn("Google Calendar event creation failed for user {}: {}", userSqno, e.getMessage());
}
```

**updateGoalResult()** 끝에 추가:
```java
// 도착 결과 이벤트 업데이트
try {
    String eventId = currentGoalSetting.getGoogleCalendarEventId();
    if (eventId != null && googleOAuthService.isConnected(userSqno)) {
        googleCalendarService.updateEventResult(userSqno, eventId, status);
    }
} catch (Exception e) {
    log.warn("Google Calendar event update failed: {}", e.getMessage());
}
```

#### GoalSetting.java 수정
```java
@Column(name = "google_calendar_event_id")
private String googleCalendarEventId;
```

---

### Phase 3 — Frontend

#### V34 Flyway 마이그레이션에 통합 (ui_metadata)
SET_TIME_PAGE에 구글 캘린더 연결 버튼 추가 (V35 별도 파일 대신 V34에 병합):
```sql
-- 구글 캘린더 연결/해제 토글 버튼
INSERT INTO ui_metadata (screen_id, component_type, label_text, action_type, css_class, ...)
VALUES ('SET_TIME_PAGE', 'BUTTON', '구글 캘린더 연결', 'GOOGLE_CALENDAR_CONNECT', 'google-calendar-btn', ...);
```

#### useBusinessActions.tsx — 신규 액션 추가
```typescript
case 'GOOGLE_CALENDAR_CONNECT': {
    const res = await axios.get('/api/google/status');
    if (res.data.connected) {
        // 연결 해제 확인 후 DELETE /api/google/disconnect
    } else {
        // GET /api/google/auth-url → window.location.href = authUrl
    }
    break;
}
```

#### Google OAuth Callback 처리
- 구글이 리다이렉트하는 URL: `/view/GOOGLE_CALLBACK`
- `screenMap.ts`에 `GOOGLE_CALLBACK` 추가
- `app/view/[...slug]/page.tsx` — `screenId === 'GOOGLE_CALLBACK'`이면 `?code`를 추출해 백엔드 콜백 API 호출 후 SET_TIME_PAGE로 리다이렉트

---

## 환경 변수 (GitHub Secrets 추가 필요)

| 변수명 | 설명 |
|--------|------|
| `GOOGLE_CLIENT_ID` | Google Cloud Console OAuth 2.0 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | OAuth 클라이언트 시크릿 |
| `GOOGLE_REDIRECT_URI` | 인증 후 리다이렉트 URL (Vercel 도메인) |

### Google Cloud Console 설정 체크리스트
- [ ] Google Calendar API 활성화
- [ ] OAuth 2.0 클라이언트 생성 (웹 애플리케이션 타입)
- [ ] 승인된 리다이렉트 URI 등록:
  - `http://localhost:3000/view/GOOGLE_CALLBACK` (로컬)
  - `https://yerin.duckdns.org/view/GOOGLE_CALLBACK` (프로덕션)
- [ ] OAuth 동의 화면 설정 (테스트 계정 추가)

---

## 구현 우선순위

| 단계 | 내용 | 의존성 |
|------|------|--------|
| 0 | build.gradle + application.yml + V34 마이그레이션 | Google Cloud 콘솔 설정 필요 |
| 1 | Backend OAuth 흐름 (GoogleOAuthService + Controller) | Phase 0 |
| 2 | GoogleCalendarService (이벤트 생성/업데이트) | Phase 1 |
| 3 | GoalTimeQueryService 통합 | Phase 2 |
| 4 | Frontend (V35 + useBusinessActions + Callback 페이지) | Phase 1~3 |

---

## 발송 정책 (Slack과 동일한 best-effort 패턴)

| 시나리오 | 결과 |
|---------|------|
| 구글 미연결 | 캘린더 이벤트 생성 skip (Kakao/Slack만 동작) |
| 구글 연결 + Calendar API 성공 | event_id 저장 |
| 구글 연결 + Calendar API 실패 | 로그 warn, goal_setting 저장은 정상 완료 |
| 토큰 만료 | getValidAccessToken()이 자동 refresh 후 재시도 |
