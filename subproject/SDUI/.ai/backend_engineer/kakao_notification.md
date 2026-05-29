# 카카오톡 약속 알림 기능 (KakaoTalk Appointment Notification)

작성일: 2026-03-18
브랜치: `feature/addAIChore`

---

## 기능 개요

`SET_TIME_PAGE`에서 약속 시간 + 메모를 저장하면, 해당 약속 **3시간 전 / 1시간 30분 전 / 30분 전** 총 3회에 걸쳐 카카오톡 "나에게 보내기" 메시지를 자동 발송한다.

- 메모(각오) 입력 시 → **모든 알림(30/90/180분)에 메모 포함**
- 카카오 로그인 유저 전용 (이메일 로그인 유저는 자동 skip)

---

## 메시지 포맷

| 시점 | 메모 있음 | 메모 없음 |
|------|-----------|-----------|
| 3시간 전 | ⏰ 3시간 뒤에 약속이 있습니다!<br>목표 시간: HH:mm<br>각오: {메모} | ⏰ 3시간 뒤에 약속이 있습니다!<br>목표 시간: HH:mm |
| 1시간 30분 전 | ⏰ 1시간 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm<br>각오: {메모} | ⏰ 1시간 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm |
| 30분 전 | ⏰ 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm<br>각오: {메모} | ⏰ 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm |

API: `POST https://kapi.kakao.com/v2/api/talk/memo/default/send`

---

## 아키텍처

### 방식 선택: DB 폴링 (1분 주기)

| 방식 | 서버 재시작 후 | 구현 복잡도 |
|------|--------------|------------|
| **DB 폴링 (채택)** | ✅ notifSent 플래그로 복구 | 낮음 |
| 인메모리 큐 (TaskScheduler) | ❌ 재시작 시 큐 소멸 | 중간 |
| Redis Sorted Set | ✅ 영속 큐 | 높음 |

DB 폴링은 서버 재시작 후에도 `notif_sent_*` 플래그가 남아있어 안전하게 복구된다.

### 확장성 로드맵

- **~1만 유저**: 현재 구현 (DB 폴링 + 부분 인덱스) 충분
- **1만~10만 유저**: 쿼리 통합 (이미 적용됨)
- **10만 이상**: Redis Sorted Set 도입 고려

---

## 주요 파일

| 파일 | 역할 |
|------|------|
| `domain/kakao/scheduler/AppointmentNotificationScheduler.java` | 1분 주기 스케줄러. 단일 쿼리로 3개 창 동시 조회 |
| `domain/kakao/service/KakaoNotificationService.java` | 토큰 갱신 + 메시지 구성 + 카카오 API 호출 |
| `domain/time/domain/GoalSettingRepository.java` | `findAllPendingNotifications()` — 통합 JPQL 쿼리 |
| `domain/user/service/KakaoService.java` | `refreshKakaoToken()` — 토큰 만료 시 갱신 |
| `resources/db/migration/V27__add_kakao_tokens_and_notif_flags.sql` | DB 스키마 변경 + 인덱스 |

---

## DB 스키마 변경 (V27)

### users 테이블

```sql
ALTER TABLE users
    ADD COLUMN kakao_access_token     TEXT,
    ADD COLUMN kakao_refresh_token    TEXT,
    ADD COLUMN kakao_token_expires_at TIMESTAMP;
```

### goal_settings 테이블

```sql
ALTER TABLE goal_settings
    ADD COLUMN notif_sent_30min  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN notif_sent_90min  BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN notif_sent_180min BOOLEAN NOT NULL DEFAULT FALSE;
```

### 인덱스 (PostgreSQL 부분 인덱스)

```sql
CREATE INDEX idx_goal_pending_30min  ON goal_settings (target_time)
    WHERE status IS NULL AND notif_sent_30min = false;

CREATE INDEX idx_goal_pending_90min  ON goal_settings (target_time)
    WHERE status IS NULL AND notif_sent_90min = false;

CREATE INDEX idx_goal_pending_180min ON goal_settings (target_time)
    WHERE status IS NULL AND notif_sent_180min = false;
```

발송 완료된 행은 부분 인덱스에서 제외되므로, 시간이 지나도 인덱스 크기가 늘어나지 않는다.

---

## 쿼리 통합 (3쿼리 → 1쿼리)

기존에는 30/90/180분 창마다 별도 쿼리 3회 실행 → 1회로 통합:

```java
// GoalSettingRepository
@Query("SELECT g FROM GoalSetting g WHERE g.status IS NULL AND (" +
       "  (g.targetTime BETWEEN :w30s AND :w30e AND g.notifSent30min = false) OR" +
       "  (g.targetTime BETWEEN :w90s AND :w90e AND g.notifSent90min = false) OR" +
       "  (g.targetTime BETWEEN :w180s AND :w180e AND g.notifSent180min = false)" +
       ")")
List<GoalSetting> findAllPendingNotifications(...);
```

각 창은 최소 **154분 간격** (32~88, 92~178)이므로 동일 goal이 두 창에 동시 매칭되지 않는다.

---

## 카카오 토큰 생명주기

| 토큰 | 유효기간 | 저장 위치 |
|------|---------|---------|
| access_token | 6시간 | `users.kakao_access_token` |
| refresh_token | 60일 | `users.kakao_refresh_token` |

발송 전 만료 5분 여유를 두고 자동 갱신:
```java
if (user.getKakaoTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
    token = kakaoService.refreshKakaoToken(user); // refresh_token으로 갱신
}
```

---

## 카카오 개발자 콘솔 설정

| 항목 | 설정 내용 |
|------|----------|
| 카카오 로그인 활성화 | ON |
| 동의항목 | `talk_message` ("카카오톡 메시지 전송") 추가 |
| Redirect URI | `https://yerin.duckdns.org/api/kakao/callback` 등록 |
| 권한 검수 | 개인 테스트: 불필요 / 타 사용자 서비스: 검수 필요 |

**주의**: `talk_message` 스코프 추가 후 기존 로그인 유저는 **재로그인(재동의)** 필요.

---

## 검증 방법

```sql
-- 1. V27 Flyway 정상 적용 확인
SELECT version, description, success FROM flyway_schema_history ORDER BY version;

-- 2. 인덱스 존재 확인
SELECT indexname FROM pg_indexes WHERE tablename = 'goal_settings';
-- idx_goal_pending_30min, idx_goal_pending_90min, idx_goal_pending_180min 표시되어야 함

-- 3. 카카오 로그인 후 토큰 저장 확인
SELECT user_id, kakao_access_token IS NOT NULL AS has_token FROM users WHERE social_type = 'K';

-- 4. 약속 + 31분 설정 후 1분 대기, 알림 발송 여부 확인
SELECT notif_sent_30min, todays_message FROM goal_settings ORDER BY id DESC LIMIT 1;
```

1. `./gradlew bootRun` → V27 Flyway 적용 (컬럼 6개 + 인덱스 3개)
2. 카카오 로그인 → 토큰 저장 확인
3. SET_TIME_PAGE에서 **현재 + 31분** 약속 + 메모 작성 후 저장
4. 1분 대기 → `notif_sent_30min = true` 확인
5. 카카오톡 수신 → **메모가 본문에 포함**됐는지 확인
6. `./gradlew build -x test` 빌드 성공

---

## 버그 수정 이력 (2026-03-18)

### BUG-1: EC2에서 카카오 알림 미발송 (타임존 불일치)

| 항목 | 내용 |
|------|------|
| **현상** | 로컬(Docker/Windows)에서는 알림이 오지만 EC2 배포 환경에서는 미발송 |
| **원인** | `saveGoalTime()`은 KST 기준으로 `LocalDateTime` 저장, 스케줄러는 `LocalDateTime.now()` (JVM 기본 타임존) 사용 → EC2 서버가 UTC이면 9시간 차이 발생, 알림 창 불일치 |
| **수정** | `AppointmentNotificationScheduler.java`: `LocalDateTime.now()` → `LocalDateTime.now(ZoneId.of("Asia/Seoul"))` |
| **파일** | `domain/kakao/scheduler/AppointmentNotificationScheduler.java` |

### BUG-2: 메시지 포맷 메모 표시 — 이전 goal 메모 표시 문제

| 항목 | 내용 |
|------|------|
| **현상** | 새 약속 저장 후 RecordTimeComponent에 이전 메모가 표시됨 |
| **원인** | `getGoalMemo()`가 `created_at DESC` (최신 생성 row) 기준 → `getGoalTime()`의 `target_time ASC` (가장 이른 미래 goal) 기준과 불일치, 다른 row를 참조 |
| **수정** | `getGoalMemo()`를 `status IS NULL AND target_time >= 오늘 00:00 ORDER BY target_time ASC` 기준으로 변경 |
| **파일** | `domain/time/domain/GoalSettingRepository.java`, `domain/time/service/GoalTimeQueryService.java` |

### 메시지 포맷 최종 (버그 수정 후)

| 시점 | 메모 있음 | 메모 없음 |
|------|-----------|-----------|
| 3시간 전 | ⏰ 3시간 뒤에 약속이 있습니다!<br>목표 시간: HH:mm<br>각오: {메모} | ⏰ 3시간 뒤에 약속이 있습니다!<br>목표 시간: HH:mm |
| 1시간 30분 전 | ⏰ 1시간 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm<br>각오: {메모} | ⏰ 1시간 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm |
| 30분 전 | ⏰ 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm<br>각오: {메모} | ⏰ 30분 뒤에 약속이 있습니다!<br>목표 시간: HH:mm |
