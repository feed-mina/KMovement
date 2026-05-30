# GitHub Secrets 설정 체크리스트

## 2026-05-30 확인 결과

### 설정됨 (정상)

| Secret | 용도 | 마지막 업데이트 |
|--------|------|-----------------|
| `GOOGLE_CLIENT_ID` | Google OAuth 로그인 | 2026-05-24 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 토큰 교환 | 2026-05-24 |
| `GOOGLE_REDIRECT_URI` | Google OAuth 콜백 URL | 2026-05-24 |
| `KAKAO_CLIENT_ID` | 카카오 로그인 | 2026-05-30 |
| `KAKAO_REDIRECT_URI` | 카카오 콜백 URL | 2026-05-30 |
| `GCP_FASTAPI_URL` | RunPod/AI 모델링 FastAPI URL | 2026-05-26 |
| `FASTAPI_INTERNAL_API_KEY` | FastAPI 인증 키 | 2026-05-29 |

### 미설정 (주의)

| Secret | 용도 | 영향 |
|--------|------|------|
| `SLACK_WEBHOOK_URL` | Slack 알림 전송 | Slack 알림 비활성 (서버 정상 동작, SlackNotificationService에서 graceful skip) |
| `SLACK_BOT_TOKEN` | Slack 파일 업로드 | Slack 파일 업로드 비활성 |
| `SLACK_CHANNEL_ID` | Slack 채널 지정 | Slack 채널 지정 비활성 |

### Slack 미설정 시 서버 안전성

- `SlackNotificationService.sendAlert()` → webhook URL 비어있으면 `log.debug("Slack-webhook URL 미설정, 운영 알림 skip")` 후 return
- `OperationAlertService.sendError()` → SlackNotificationService를 통해 호출하므로 위와 동일하게 안전 skip
- `GlobalExceptionHandler` → NullPointerException 발생 시 `operationAlertService.sendError()` 호출 → Slack skip → **NPE 전파 없음**

### goalTime 500 에러 관련

- Slack/Google Secrets 미설정이 500 에러의 원인은 아님 (graceful skip 확인됨)
- 실제 원인 조사: EC2에서 `docker logs sdui-backend 2>&1 | grep -i "goalTime\|NullPointer" | tail -30` 실행 필요
- `ea69a38f` 커밋에서 try-catch 추가됨 → 배포 후 재확인 필요

### 커뮤니티 모델링 파이프라인

- `KRIDE_FASTAPI_URL` → `deploy-ec2.yml`에서 `GCP_FASTAPI_URL` secret으로 주입됨 (line 240)
- `GCP_FASTAPI_URL` secret 설정됨 (2026-05-26 업데이트)
- FastAPI `/jobs/runpod` 엔드포인트 연결 정상

### 확인 명령어

```bash
# Secrets 목록 확인
gh secret list --repo feed-mina/KMovement

# Slack secrets 설정 (필요 시)
gh secret set SLACK_WEBHOOK_URL --repo feed-mina/KMovement
gh secret set SLACK_BOT_TOKEN --repo feed-mina/KMovement
gh secret set SLACK_CHANNEL_ID --repo feed-mina/KMovement
```
