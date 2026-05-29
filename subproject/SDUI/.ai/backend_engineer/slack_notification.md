# Slack 알림 모듈 (Slack Notification Module)

작성일: 2026-03-19
브랜치: `feature/addAIChore`
담당 파일: `domain/kakao/service/SlackNotificationService.java`

---

## 목적 및 배경

카카오톡 알림과 동일한 이벤트에 **Slack 웹훅**으로 병행 발송.
단기적으로는 운영자 모니터링 채널로 쓰고, 장기적으로 FastAPI 연계를 통해
AI 면접 피드백·주간 학습 리포트 등으로 확장한다.

### 타깃 페르소나
| 페르소나 | 핵심 니즈 | Slack 가치 |
|---------|----------|-----------|
| **취업 준비생** | AI 면접 연습 습관화 | 매일 아침 Slack으로 예상 질문 수신 → 앱 열기 전 자연스러운 연습 |
| **자기 계발 직장인** | 목표·학습 관리 | 직장 Slack과 통합 → 알림을 놓치지 않음 |

---

## 현재 구현 상태 (Phase 0 — 완료)

### 발송 흐름

```
약속 저장 (SET_TIME_PAGE)
    │
    ▼ 1분 주기 스케줄러 (AppointmentNotificationScheduler)
    │
    ├─ KakaoNotificationService.sendReminder()   ← 카카오 API
    └─ SlackNotificationService.sendReminder()   ← Slack 웹훅 (신규)
```

### 주요 파일

| 파일 | 역할 |
|------|------|
| `domain/kakao/service/SlackNotificationService.java` | 웹훅 POST 발송. 내부 예외 처리 — caller에 전파 안 함 |
| `domain/kakao/scheduler/AppointmentNotificationScheduler.java` | `sendAndMark()` 안에서 Kakao 직후 Slack 호출 |

### 발송 정책

| 시나리오 | 결과 |
|---------|------|
| Kakao 성공 + Slack 성공 | notifSent 플래그 저장 |
| Kakao 성공 + Slack 실패 | notifSent 플래그 저장 (Slack은 best-effort) |
| Kakao 실패 | notifSent 미저장 → 1분 후 재시도 (Slack도 skip) |

### 메시지 포맷 (현재: 텍스트)

```
⏰ 30분 뒤에 약속이 있습니다!
목표 시간: 14:00
각오: 오늘은 꼭 일찍 도착하자
```

---

## 설정

### application.yml

```yaml
slack:
  webhook-url: ${SLACK_WEBHOOK_URL:https://hooks.slack.com/services/T0AMG8W1X8D/B0AM49BDXLP/...}
```

- 환경변수 `SLACK_WEBHOOK_URL` 미설정 시 yml 기본값 사용 (로컬 개발용)
- **`slack.webhook-url`이 빈 문자열이면 발송 자동 skip** → 개발/테스트 환경 안전

### GitHub Actions Secret 설정

```
Repository → Settings → Secrets and variables → Actions → New repository secret
  Name:  SLACK_WEBHOOK_URL
  Value: https://hooks.slack.com/services/T0AMG8W1X8D/B0AM49BDXLP/...
```

EC2 배포 스크립트에서 환경변수로 주입:
```bash
# deploy.yml (예시)
- name: Deploy
  run: |
    ssh ec2 "SLACK_WEBHOOK_URL=${{ secrets.SLACK_WEBHOOK_URL }} ./deploy.sh"
```

---

## 로드맵

### Phase 1 — 운영 모니터링 + Block Kit 전환
> 상태: **구현 예정** | 기간: 1-2주 | FastAPI 불필요

#### 1-A. 운영 모니터링 (`OperationAlertService` 신규)

```
신규 가입       → "🎉 새 사용자: user@example.com 가입 (총 N명)"
5xx 예외        → "🔴 서버 오류: NullPointerException @ POST /api/ai/chat"
OpenAI 비용 초과→ "💸 OpenAI 일일 비용 $N 초과 (임계: $5)"
주간 리포트     → 매주 월 09:00 KST, DAU·면접 수·학습 수 요약
```

구현 포인트:
- `GlobalExceptionHandler` — 5xx 응답 시 `OperationAlertService.sendError()` 호출
- `AuthController.updateProfile()` — 가입 완료 이벤트 (`ApplicationEventPublisher`)
- `OpenAiClient` — 응답 후 누적 토큰 카운트 → 임계 초과 시 알림
- `WeeklyReportScheduler` — `@Scheduled(cron = "0 0 9 * * MON", zone = "Asia/Seoul")`

---
//[메모]
OpenAI 비용 임계 알림: @Value("${openai.cost.threshold:5.0}") — 일일 $5 초과 시
 
    ---
#### 1-B. Block Kit 전환 (`SlackNotificationService` 수정)

```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "⏰ 30분 뒤 약속 리마인더" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*목표 시간*\n14:00" },
        { "type": "mrkdwn", "text": "*이번 주 도착 성공률*\n4/6 (67%)" }
      ]
    },
    {
      "type": "context",
      "elements": [
        { "type": "mrkdwn", "text": "각오: 오늘은 꼭 일찍 도착하자" }
      ]
    }
  ]
}
```

`GoalSettingRepository`에 주간 성공률 집계 쿼리 추가 필요.

---

### Phase 2 — AI 면접 피드백 루프 (FastAPI 재활성화)
> 상태: **기획 완료** | 기간: 3-4주 | FastAPI 필요

#### FastAPI 역할 전환

```
기존: pronounce-api (발음 채점)  →  신규: interview-analysis-api
```
//[메모] 면접 세션 완료
면접 세션 완료
    └→ Spring Boot: InterviewService.finishSession()
           └→ FastAPI /analyze-interview (POST)
                  • 대화 로그 + 이력서 텍스트 전달
                  • 점수, 강점, 약점, 핵심 개선점 반환
           └→ SlackNotificationService.sendInterviewResult()
• Block Kit 카드: 종합 점수 / 강점 / 다음 연습 질문
interview_results 테이블에 FastAPI 채점 결과 저장
이력서 PDF 분석 완료 → Slack 링크 (/view/INTERVIEW_RESULT/{id})
D-1 리마인더: GoalSetting 확장 or 별도 interview_schedule 테이블
---

#### 면접 완료 흐름

```
InterviewService.finishSession()
    │
    ├─ POST /api/fastapi/analyze-interview
    │    { "transcript": [...], "resumeText": "..." }
    │    → 반환: { "score": 75, "strengths": [...], "improvements": [...], "nextQuestions": [...] }
    │
    └─ SlackNotificationService.sendInterviewResult()
         Block Kit 카드:
         ┌──────────────────────────────────┐
         │ 📋 AI 면접 채점 완료              │
         │ ─────────────────────────────── │
         │ 종합 점수: 75/100               │
         │ 논리성 ★★★★☆  구체성 ★★★☆☆    │
         │ ─────────────────────────────── │
         │ 개선 포인트: STAR 기법 활용도↑   │
         │ 다음 연습 추천: "강점과 약점..."  │
         └──────────────────────────────────┘
```

#### 이력서 PDF 분석 완료 알림

```
ResumeService.analyzeResume()
    └─ FastAPI 분석 완료 (비동기)
           └─ Slack: "📄 이력서 분석 완료! 예상 질문 30개 준비됨 → [면접 시작]"
                     링크: https://yerin.duckdns.org/view/INTERVIEW_PAGE
```

#### 면접 D-1 리마인더

```
// 기존 AppointmentNotificationScheduler 확장 또는 별도 InterviewReminderScheduler
// interview_schedule 테이블: user_sqno, interview_date, notif_sent_d1
@Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")  // 매일 09:00 체크
```

#### 일일 면접 질문 발송 (핵심 습관 형성 기능)

```
매일 09:00 (KST)
    │
    ├─ 면접 준비 중인 유저 조회 (interview_resume.status = 'ACTIVE')
    └─ 각 유저의 예상 질문 중 미발송 질문 1개 랜덤 선택
           └─ Slack: "🎯 오늘의 면접 질문
                      '5년 후 본인의 모습을 말씀해주세요'
                      → [바로 연습하기]"
```

DB 변경 필요:
```sql
-- interview_questions 테이블 (Phase 2에서 추가)
ALTER TABLE interview_resume
    ADD COLUMN daily_notif_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN slack_webhook_url   TEXT;  -- 사용자별 개인 채널 (추후)
```

---

### Phase 2.5 — 일일 LeetCode 문제 Slack 발송
> 상태: **✅ 완료 (2026-03-20, 배포 검증 완료)** | FastAPI 불필요

#### 선택 이유

취업 준비생 페르소나의 코딩 인터뷰 습관 형성. FastAPI 불필요 — 모든 로직이 Spring Boot + DB로 충분.

#### 발송 흐름

```
매일 09:00 KST (DailyLeetcodeScheduler)
    │
    ├─ DB: leetcode_problems WHERE sent_date IS NULL ORDER BY display_order LIMIT 1
    └─ Slack: 문제 제목 + 난이도 + LeetCode 링크
```

#### DB 스키마 (V28)

```sql
CREATE TABLE leetcode_problems (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(200) NOT NULL,
    slug          VARCHAR(200) NOT NULL UNIQUE,   -- LeetCode URL slug
    difficulty    VARCHAR(10)  NOT NULL,           -- Easy / Medium / Hard
    category      VARCHAR(50)  NOT NULL,           -- Array, Strings, Trees, ...
    display_order INT          NOT NULL,
    sent_date     DATE                             -- NULL = 미발송
);

CREATE INDEX idx_leetcode_unsent ON leetcode_problems (display_order)
    WHERE sent_date IS NULL;
```

시드 데이터: Top Interview Questions 57문제 (Array·Strings·Linked List·Trees·Sorting·DP·Design·Math·Others).

#### Slack 메시지 포맷

```
🧩 오늘의 LeetCode 문제
*Two Sum*
🟢 Easy | Array
https://leetcode.com/problems/two-sum/
```

#### 주요 파일

| 파일 | 역할 |
|------|------|
| `domain/leetcode/domain/LeetcodeProblem.java` | JPA 엔티티 |
| `domain/leetcode/domain/LeetcodeProblemRepository.java` | `findFirstBySentDateIsNullOrderByDisplayOrderAsc()` |
| `domain/leetcode/scheduler/DailyLeetcodeScheduler.java` | 매일 07:00 / 12:00 / 17:00 KST 발송 (3회), sent_date 마킹 |
| `domain/kakao/service/SlackNotificationService.java` | `sendDailyLeetcode()` 메서드 추가 |
| `resources/db/migration/V28__add_leetcode_problems.sql` | 테이블 생성 + 57문제 시드 |

---

### Phase 2.7 — 정보처리기사 PDF 일일 Slack 발송
> 상태: **✅ 완료 (2026-03-20, 배포 검증 완료)** | FastAPI 불필요

#### 발송 흐름

```
매일 19:00 KST (DailyStudyScheduler)
    │
    ├─ DB: study_materials WHERE sent_date IS NULL ORDER BY display_order LIMIT 1
    ├─ Slack Files API v2: getUploadURLExternal → PUT binary → completeUploadExternal
    └─ sent_date 마킹
```

#### DB 스키마 (V33)

```sql
CREATE TABLE study_materials (
    id            BIGSERIAL    PRIMARY KEY,
    filename      VARCHAR(300) NOT NULL,
    display_name  VARCHAR(300) NOT NULL,
    display_order INT          NOT NULL,
    sent_date     DATE
);
CREATE INDEX idx_study_unsent ON study_materials (display_order) WHERE sent_date IS NULL;
-- 33개 시드: 기출해설특강 10개, 실기특강 3개, 끝짱 모의고사 20개
```

#### 주요 파일

| 파일 | 역할 |
|------|------|
| `domain/study/domain/StudyMaterial.java` | JPA 엔티티 |
| `domain/study/domain/StudyMaterialRepository.java` | `findFirstBySentDateIsNullOrderByDisplayOrderAsc()` |
| `domain/study/service/SlackFileService.java` | Slack Files API v2 3단계 업로드 |
| `domain/study/scheduler/DailyStudyScheduler.java` | 매일 19:00 KST 발송 |
| `resources/db/migration/V33__add_study_materials.sql` | 테이블 생성 + 33개 시드 |

#### 설정

- `SLACK_BOT_TOKEN` (GitHub Secret) — `files:write` 스코프 필요
- `SLACK_CHANNEL_ID` (GitHub Secret) — 봇이 해당 채널에 `/invite @SDUINotiBot` 완료
- EC2 볼륨 마운트: `/home/ubuntu/study-materials:/app/assets/study:ro`
- PDF 파일 업로드: `scp -i "SDUI.pem" -r assets/정보처리기사/. ubuntu@{IP}:/home/ubuntu/study-materials/`

#### 테스트 엔드포인트

```bash
curl -X POST http://{EC2_IP}:8080/api/admin/slack/test/study \
  -H "Authorization: Bearer $TOKEN"
```

---

### Phase 3 — 주간 학습 리포트 (Spring Boot 텍스트 리포트)
> 상태: **구현 예정** | FastAPI 없이 Spring Boot만으로 텍스트 리포트 구현 (차트 이미지는 나중에)

#### 리포트 발송 흐름

```
매주 월요일 09:00 KST
    │
    └─ WeeklyReportScheduler
           ├─ UserRepository.countNewUsersThisWeek(weekStart)
           ├─ UserRepository.countActiveUsers()
           ├─ GoalSettingRepository.countAllWeeklyTotal(weekStart)
           ├─ GoalSettingRepository.countAllWeeklySuccess(weekStart)
           ├─ ContentRepository.countNewContentsThisWeek(weekStart)
           └─ SlackNotificationService.sendWeeklyReport(...)
```

#### 리포트 포맷 (Block Kit)
```
📊 SDUI 주간 리포트 (2026-W12)
---
👥 신규 가입: 3명 (전체 활성: 47명)
⏰ 약속 도착: 12회 성공 / 15회 시도 (80%)
📝 일기: 8편 작성
🧩 LeetCode: 7문제 발송
```

#### 신규 추가 쿼리

| Repository | 메서드 | JPQL |
|-----------|--------|------|
| `UserRepository` | `countNewUsersThisWeek(weekStart)` | `COUNT u WHERE u.delYn='N' AND u.createdAt >= :weekStart` |
| `UserRepository` | `countActiveUsers()` | `COUNT u WHERE u.delYn='N'` |
| `GoalSettingRepository` | `countAllWeeklyTotal(weekStart)` | `COUNT g WHERE g.status IS NOT NULL AND g.targetTime >= :weekStart` |
| `GoalSettingRepository` | `countAllWeeklySuccess(weekStart)` | `COUNT g WHERE g.status IN ('success','safe') AND g.targetTime >= :weekStart` |
| `ContentRepository` | `countNewContentsThisWeek(weekStart)` | `COUNT d WHERE d.delYn='N' AND d.regDt >= :weekStart` |
| `LeetcodeProblemRepository` | `countBySentDateGreaterThanEqual(weekStart)` | Spring Data 명명 규칙 |

#### 신규 파일
- `domain/kakao/scheduler/WeeklyReportScheduler.java` — `@Scheduled(cron = "0 0 9 * * MON", zone = "Asia/Seoul")`
- `SlackNotificationService.sendWeeklyReport()` 메서드 추가

> **V32 마이그레이션 불필요** — 스키마 변경 없음, JPQL 쿼리만 추가

---

#### AI 채팅 세션 종료 후 즉시 피드백 (자기 계발 직장인용)

```
AI 채팅 세션 종료
    │
    ├─ FastAPI /analyze-chat
    │    { "messages": [...], "sessionMinutes": 18 }
    │    → { "summary": "오늘 학습 주제: 비즈니스 이메일 표현",
    │        "errors": ["'I have been' vs 'I had'"],
    │        "nextTopic": "회의 진행 표현" }
    │
    └─ Slack: "📚 18분 학습 완료!
               자주 틀린 표현: 'I have been' vs 'I had'
               내일 추천 주제: 회의 진행 표현"
```

---

### Phase 4 — Block Kit 고도화 + Slackbot (추후 고려)
> 상태: **보류** | Slackbot 양방향 인터랙션은 추후 결정

- Block Kit 인터랙티브 버튼: "오늘 완료 체크" → Spring Boot `/api/slack/action` webhook
- Slash command: `/interview-question`, `/my-stats`, `/weekly-goal`
- Slack App 등록 필요 (현재는 Incoming Webhook만 사용)

---

## 단계별 구현 우선순위

| 우선순위 | Phase | 기능 | 복잡도 | 의존성 |
|---------|-------|------|--------|--------|
| ⭐ 1 | 1-A | 운영 모니터링 (오류·가입·비용) | 낮음 | 없음 |
| ⭐ 2 | 1-A | 매일 면접 질문 Slack 발송 | 낮음 | interview_resume 테이블 |
| ⭐ 3 | 1-A | 면접 D-1 리마인더 | 낮음 | interview_schedule |
| ⭐⭐ 4 | 2.5 | 일일 LeetCode 문제 발송 | 낮음 | leetcode_problems 테이블 |
| ⭐⭐ 5 | 1-B | 약속 알림 Block Kit 전환 | 중간 | 주간 성공률 쿼리 |
| ⭐⭐ 6 | 2 | FastAPI 면접 채점 → Slack | 중간 | FastAPI 재활성화 |
| ⭐⭐ 7 | 2 | 이력서 분석 완료 알림 | 중간 | FastAPI |
| ⭐⭐⭐ 8 | 3 | AI 채팅 세션 요약 피드백 | 높음 | FastAPI |
| ⭐⭐⭐ 9 | 3 | 주간 리포트 (차트 포함) | 높음 | FastAPI |
| — | 4 | Slackbot 양방향 | 높음 | Slack App 등록 |

---
// [메모] fastAPI 기능 리스트

알림 대상: 운영자 모니터링 + 팀/그룹 공유 채널
FastAPI×Slack: AI 면접 채점 + 주간 학습 리포트 + 자연어 알림 필터링
메시지 포맷: 단계별 고도화
개발 우선순위: 단계별 고도화
면접×Slack: 4가지 모두 (채점 결과 즉시, PDF 분석 완료, D-1 리마인더, 일일 질문)
모니터링: 4가지 모두 (오류, AI 비용 임계, 신규 가입, 주간 리포트)
양방향: 나중에 고려


---
//[메모] FastAPI 기능구현에 무국적(Stateless) 아키텍처, APScheduler , AsyncIOScheduler 사용하는건 어떨까?




## AWS 배포 및 검증 이력 (2026-03-20)

### 배포 문제 해결 과정

| 문제 | 원인 | 해결 |
|------|------|------|
| `sdui-backend` 기동 실패 | V28/V29/V30의 `SERIAL(int4)` vs JPA `Long(bigint)` Hibernate schema-validation 불일치 | V32 마이그레이션으로 `ALTER COLUMN id TYPE BIGINT` 적용 |
| SLACK_WEBHOOK_URL 미주입 | `deploy.yml` docker run 명령에 `-e SLACK_WEBHOOK_URL` 누락 | `deploy.yml` 수정 후 재배포 |
| `docker-compose` 없음 | EC2에 compose 파일 없음 — deploy.yml이 SSH + `docker run` 직접 사용 | 정상 동작 확인 (compose 불필요) |

### 검증 완료 항목 (2026-03-20)

| 항목 | 방법 | 결과 |
|------|------|------|
| Flyway V28~V33 전체 적용 | `docker exec sdui-db psql -U mina -d SDUI_TD -c "SELECT count(*) FROM study_materials;"` | ✅ 33개 확인 |
| Slack 웹훅 연결 | `POST /api/admin/slack/test` (ROLE_ADMIN JWT) | ✅ `{"sent":true}` |
| 약속 알림 (Slack+카카오) | SET_TIME_PAGE에서 목표시간 설정 후 스케줄러 대기 | ✅ 정상 발송 확인 |
| LeetCode 일일 발송 | `POST /api/admin/slack/test/leetcode` | ✅ Slack 채널에 문제 발송 확인 |
| 정보처리기사 PDF 발송 | `POST /api/admin/slack/test/study` | ✅ PDF 파일 첨부 발송 확인 (not_in_channel 오류 → `/invite @SDUINotiBot` 후 해결) |

### 로그인 API 참고 (EC2 테스트용)
```bash
# LoginRequest 필드명: @JsonProperty("user_email"), @JsonProperty("user_pw")
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_email":"admin@test.com","user_pw":"Test1234!"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
```

---

## 기술 결정 이력

| 날짜 | 결정 | 이유 |
|------|------|------|
| 2026-03-19 | Incoming Webhook 채택 | Bot API 불필요, 발송 전용으로 충분 |
| 2026-03-19 | Slack 실패는 best-effort | Kakao 성공 기준으로 플래그 저장, Slack 재발송 불필요 |
| 2026-03-19 | FastAPI 역할 전환 확정 | 발음 채점 → 면접 채점/리포트 집계로 전환 예정 |
| 2026-03-19 | 단계별 고도화 결정 | 텍스트 → Block Kit → 차트 순서로 포맷 고도화 |
| 2026-03-19 | Slackbot 보류 | 현재는 발송 전용으로 충분, 추후 필요 시 추가 |
| 2026-03-19 | LeetCode → Spring Boot 직접 관리 | AI 불필요, 스케줄러 책임 단일화 (FastAPI는 AI 채점 전용) |
| 2026-03-20 | V32 긴급 패치 | SERIAL→BIGINT 타입 불일치로 서버 기동 불가, ALTER COLUMN으로 수정 |
| 2026-03-20 | LeetCode 발송 시각 07/12/17시 3회로 변경 | 하루 1회 09:00 → 학습 습관 강화 목적으로 3회 분산 |
| 2026-03-20 | 정보처리기사 PDF → Slack Files API v2 직접 첨부 | 웹훅 텍스트 대신 파일 첨부, 3단계 업로드 (getUploadURL→PUT→complete) |
| 2026-03-20 | PDF EC2 볼륨 마운트 방식 채택 | 파일이 Docker 이미지에 포함되지 않으므로 EC2 SCP + volume mount로 분리 |
