# 이슈 및 수정 — 2026-05-30

## 범위
카카오 로그인 리다이렉트 문제 + KRIDE 챗봇 SSE 400 에러

---

## 1. 카카오 로그인 후 `sdui-delta.vercel.app`으로 리다이렉트되는 문제

### 현상
- `https://yerin.duckdns.org/`에서 카카오 로그인 성공 후 `https://sdui-delta.vercel.app/view/MAIN_PAGE`로 이동
- 카카오 개발자 콘솔 설정 문제로 추정했으나, 실제 원인은 백엔드 환경변수

### 원인
`KakaoController.java:211`에서 로그인 완료 후 `webUrl`로 302 리다이렉트:
```java
redirectHeaders.setLocation(URI.create(webUrl));  // webUrl = WEB_URL 환경변수
```

EC2 Docker 컨테이너의 `WEB_URL` 환경변수가 `https://sdui-delta.vercel.app`으로 설정되어 있음.

### 관련 파일
| 파일 | 역할 |
|------|------|
| `SDUI-server/.../user/controller/KakaoController.java:44-45,211` | `@Value("${app.url.web}")` → 302 리다이렉트 |
| `SDUI-server/src/main/resources/application-prod.yml:29` | `web: ${WEB_URL:https://yerin.duckdns.org}` (기본값 정상) |
| `.github/workflows/deploy-ec2.yml:235-236,303-304` | GitHub Secrets `WEB_URL`, `KAKAO_REDIRECT_URI` 주입 |
| `subproject/SDUI/.github/workflows/deploy.yml:123-124` | 하드코딩 `WEB_URL=https://yerin.duckdns.org` (정상) |

### 해결 방법 (사용자 수동 조치 필요)
1. **GitHub repo Settings → Secrets** → `WEB_URL` 값을 `https://yerin.duckdns.org`로 변경
2. **GitHub repo Settings → Secrets** → `KAKAO_REDIRECT_URI` 값을 `https://yerin.duckdns.org/api/kakao/callback`로 변경
3. 백엔드 재배포 (`Deploy K-Ride services to EC2` 워크플로우 실행)
4. **카카오 개발자 콘솔**: Redirect URI에 `https://yerin.duckdns.org/api/kakao/callback` 등록 확인 (구 `sdui-delta.vercel.app` URI 제거)

### 상태: ⏳ 사용자 조치 대기

---

## 2. KRIDE 챗봇 SSE 400 에러 — `credentials: 'include'` 누락 [수정 완료]

### 현상
- 로그인 성공 후 (카카오/일반 로그인 모두) KRIDE 챗봇에서 메시지 전송 시:
  ```
  SSE failed: 400
  죄송합니다. 답변 중 오류가 발생했어요. 다시 시도해주세요.
  ```

### 원인
`SecurityConfig.java:118`에서 KRIDE 챗봇 엔드포인트는 인증 필수:
```java
.requestMatchers("/api/v1/kride/chat/**").authenticated()
```

그런데 `useKrideChatStream.ts`의 fetch 호출에 `credentials: 'include'`가 누락 → JWT 쿠키 미전송 → 백엔드 403 Forbidden.

다른 SSE 훅(`useSSEStream.ts:21`, `useSSEStreamV2.ts:28`)은 모두 `credentials: 'include'` 사용 중이었으나,
`useKrideChatStream.ts`만 누락.

### 수정 내용
**파일**: `metadata-project/lib/hooks/useKrideChatStream.ts`

#### 변경 1 — SSE 스트리밍 fetch (line 83~91)
```diff
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    },
+   credentials: 'include',
    body: JSON.stringify(body),
    signal,
  });
```

#### 변경 2 — 일반 POST fetch (line 214~219)
```diff
  const res = await fetch(`${base}/api/v1/kride/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
+   credentials: 'include',
    body: JSON.stringify(req),
    signal: controller.signal,
  });
```

### 검증
- GCP FastAPI (`http://34.64.221.240:8000`) 직접 호출 → 정상 (stream, qa 모두 200)
- Spring Boot 프로덕션 (`https://yerin.duckdns.org/api/v1/kride/chat/stream`) → 쿠키 없이 403 확인
- `credentials: 'include'` 추가 후 JWT 쿠키 전송으로 인증 통과 예상

### 상태: ✅ 수정 완료 — 배포 필요

---

## 3. KRIDE 챗봇 일정 생성 500 에러 — GCP FastAPI 구버전 배포 [해결]

### 현상
Focus 페이지 챗봇에서 일정 관련 메시지("강남 데이트 코스 짜줘") 전송 시:
```
HTTP 500
{"status":"error","message":"서버 오류가 발생했습니다","error":"InternalError"}
```

### payload 예시
```json
{
  "message": "강남 데이트 코스 짜줘",
  "intent": "itinerary",
  "artists": ["EXO","BTS","BLACKPINK","NewJeans","ENHYPEN"],
  "regions": ["경주","인천"],
  "purposes": ["food"],
  "duration": 3,
  "budget": {"min":30000,"max":1530000}
}
```

### 에러 흐름
```
프론트 useKrideChatStream (intent: "itinerary")
  → POST /api/v1/kride/chat
  → Spring Boot KrideChatService.handleItinerary()
  → FastApiChatClient.generateItinerary()
  → GCP FastAPI POST /api/recommend/itinerary
  → 400 Bad Request (엔드포인트 미존재)
  → Spring Boot 500 InternalError로 전파
```

### 원인
GCP FastAPI 서버(`34.64.221.240:8000`)가 구버전 코드를 실행 중.
`/api/recommend/itinerary`, `/api/chat/qa`, `/api/chat/stream` 등 챗봇 관련 엔드포인트가 **등록되지 않은 상태**.

기존 엔드포인트(6개)만 존재: `/api/health`, `/api/recommend`, `/api/route`, `/api/course`, `/api/facilities`, `/api/pois`

### 해결
`gh workflow run deploy-gcp.yml --ref main`으로 수동 재배포:
- Docker 이미지 재빌드 + GCP VM에 pull & 컨테이너 재생성
- Run: https://github.com/feed-mina/KMovement/actions/runs/26676868243
- 배포 후 13개 엔드포인트 모두 등록 확인
- `/api/recommend/itinerary` 테스트 → reason 필드 포함 일정 JSON 정상 반환

### 상태: ✅ 해결 완료 (GCP 재배포)

---

## 4. KRIDE 챗봇 recommend intent 500 에러 — budget 타입 불일치 [수정 완료]

### 현상
Focus 페이지 챗봇에서 추천 관련 메시지 전송 시 (intent: "recommend"):
```
POST https://yerin.duckdns.org/api/v1/kride/chat 500 (Internal Server Error)
{"status":"error","message":"서버 오류가 발생했습니다","error":"InternalError"}
```

### 원인
프론트엔드가 `budget`을 **객체** 형태로 전송:
```json
{"budget": {"min": 30000, "max": 1030000}}
```

그러나 Spring Boot `ChatQueryRequest.java`에서 `budget` 필드가 `List<Integer>`로 선언:
```java
private List<Integer> budget;  // ← JSON 객체를 List로 역직렬화 불가
```

Jackson이 `{"min":30000,"max":1030000}` 객체를 `List<Integer>`로 변환할 수 없어 역직렬화 실패 → 컨트롤러 진입 전 500 에러.

추가로 `FastApiChatClient`가 `budget_min`/`budget_max` 별도 필드로 전송했으나, FastAPI의 `BudgetSchema`는 `budget: {min, max}` 중첩 객체를 기대.

### 수정 내용

**파일 1**: `ChatQueryRequest.java`
```diff
- private List<Integer> budget;
+ private Map<String, Integer> budget;
```

**파일 2**: `FastApiChatClient.java` — `recommendAi()`, `generateItinerary()` 모두
```diff
- List<Integer> budget
+ Map<String, Integer> budget

- body.put("budget_min", budget.get(0));
- body.put("budget_max", budget.get(1));
+ body.put("budget", budget);
```

### 상태: ✅ 수정 완료 — 백엔드 재배포 필요

---

## 우선순위 정리

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1 | 카카오 로그인 → sdui-delta 리다이렉트 | ⏳ | GitHub Secrets 변경 + 재배포 |
| 2 | KRIDE 챗봇 SSE 400 | ✅ | `credentials: 'include'` 추가 — 배포 필요 |
| 3 | KRIDE 챗봇 일정 생성 500 | ✅ | GCP FastAPI 수동 재배포로 해결 |
| 4 | KRIDE 챗봇 recommend 500 | ✅ | budget 타입 `List<Integer>` → `Map<String, Integer>` — 백엔드 재배포 필요 |

---

---

## 5. goalTime 500 에러 — `null` 직렬화 NPE [수정 완료]

### 원인
`GoalTimeController.java`에서 `result.put("goalTime", null)` → Kotlin Serialization `StringSerializer`가 null 처리 불가 → NPE

### 수정
`null` → `""` (빈 문자열)로 변경 (line 43, 53)

### 상태: ✅ 수정 완료

---

## 6. AnimationController 400 에러 — 작업 없는 게시글 [수정 완료]

### 현상
커뮤니티 글 작성/낙서 저장 후 상세페이지 진입 시 400 에러 + "애니메이션 작업을 찾을 수 없습니다"

### 원인
`AnimationService.getAnimationStatus()`가 해당 게시글에 animation job이 없으면 `IllegalArgumentException` throw

### 수정
`AnimationController.getAnimationStatus()`에 try-catch 추가, 예외 시 `{ status: "NONE", jobId: 0 }` 반환

### 상태: ✅ 수정 완료

---

## 7. "영상 만들기" 버튼 미표시 — NONE 상태 미처리 [수정 완료]

### 현상
AnimationController 수정 후 `{ status: "NONE" }` 반환 → 기존 조건 `(!animStatus || animStatus.status === 'FAILED')`에 해당하지 않아 버튼 숨김

### 수정
`CommunityPage.tsx` line 946: `animStatus.status === 'NONE'` 조건 추가

### 상태: ✅ 수정 완료

---

## 8. 카카오 로그인 NPE — properties/kakao_account null [수정 완료]

### 현상
카카오 로그인 시 500 에러. 카카오 API가 동의항목 미설정 시 `properties`/`kakao_account` 없이 반환

### 수정
- `KakaoService.getKakaoUserInfo()`: `properties != null` null guard 추가
- `KakaoUserInfo.fromMap()`: email 빈 값 시 `"kakao_" + kakaoId + "@noemail.kakao"` fallback

### 상태: ✅ 수정 완료

---

## 9. 챗봇 SSE 이중 래핑 — raw JSON 표시 [수정 완료]

### 현상
Focus 페이지 챗봇에서 메시지 전송 시 `{"content":"안"}{"content":"녕"}` 식으로 raw JSON 표시

### 원인
FastAPI가 `{"content":"안"}` 전송 → Spring `KrideChatService.streamChat()`이 `Map.of("content", chunk)`로 재래핑 → 프론트 파서가 이중 JSON 파싱 실패

### 수정
`emitter.send(SseEmitter.event().data(chunk))` — `Map.of("content", ...)` 래핑 제거

### 상태: ✅ 수정 완료

---

## 10. deploy-ec2.yml 변경 감지 실패 — fetch-depth [수정 완료]

### 원인
`actions/checkout@v4` 기본 `fetch-depth: 1` → shallow clone → `git diff HEAD~1` 실패 → `DEPLOY_BACKEND=false`

### 수정
`fetch-depth: 2` 추가

### 상태: ✅ 수정 완료

---

## 11. RunPod 연결 — FastAPI 프록시 엔드포인트 부재 [수정 완료]

### 현상
`AnimationService`가 `POST /jobs/runpod`으로 호출하지만 GCP FastAPI(`src/api/fastapi_server.py`)에 해당 엔드포인트 미존재. `deploy/cloud_gateway/app.py`에만 구현되어 있었음.

### 수정
`src/api/fastapi_server.py` 끝부분에 RunPod 프록시 라우트 추가:
- `POST /jobs/runpod` — RunPod Serverless에 작업 제출
- `GET /jobs/runpod/{job_id}` — 작업 상태 조회
- `JSONResponse` import 추가

### 상태: ✅ 수정 완료 — RunPod `IN_QUEUE` 응답 확인

---

## 12. deploy-gcp.yml RunPod 환경변수 미주입 [수정 완료]

### 현상
GCP FastAPI 컨테이너에 `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` 미주입 → `/jobs/runpod` 호출 시 501

### 수정
`deploy-gcp.yml`에 추가:
1. `env:` 섹션에 `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` GitHub Secrets 참조
2. docker-compose fastapi environment에 변수 추가
3. `.env` 파일에 값 추가
4. `sed` 치환 추가
5. 배포 전 디스크 정리 (`docker system prune -af --filter "until=24h"`) 추가

### 상태: ✅ 수정 완료

---

## 13. GCP VM 디스크 100% 사용 [해결]

### 현상
69GB 디스크가 100% 사용 → 배포 실패 (`No space left on device`)

### 수정
- `docker system prune -af` → 13.63GB 확보
- `deploy-gcp.yml`에 자동 정리 스크립트 추가 (매 배포 전 실행)

### 상태: ✅ 해결

---

## 14. 카카오톡 알림 기능 신규 구현 [완료]

### 구현 파일
| 파일 | 역할 |
|------|------|
| `AnimationJobPollingScheduler.java` (신규) | 60초 폴링, QUEUED/RUNNING job 상태 확인, 완료/실패 시 카카오톡 알림 |
| `V60__add_animation_notif_flag.sql` (신규) | `community_animation_jobs.notif_sent` 컬럼 추가 |
| `AnimationJob.java` | `notifSent` boolean 필드 추가 |
| `AnimationJobRepository.java` | `findByStatusInAndNotifSentFalse()` 쿼리 추가 |
| `KakaoNotificationService.java` | `sendAnimationComplete()`, `sendAnimationFailed()`, `sendKakaoMessage()` 메서드 추가 |

### 동작 흐름
```
@Scheduled(fixedDelay = 60000)
  → QUEUED/RUNNING job에서 notifSent=false 조회
  → RunPod 상태 API 호출
  → COMPLETED → resultUrl 저장 + 카카오톡 나에게 보내기 API
  → FAILED → errorMessage 저장 + 실패 알림
  → notifSent = true (중복 방지)
```

### 상태: ✅ 구현 완료 — 실제 카카오톡 발송은 RunPod 워커 처리 완료 후 테스트 필요

---

## 우선순위 정리 (업데이트)

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1 | 카카오 로그인 → sdui-delta 리다이렉트 | ✅ 해결 | GitHub Secrets WEB_URL 변경 |
| 2 | KRIDE 챗봇 SSE 400 | ✅ | `credentials: 'include'` 추가 |
| 3 | KRIDE 챗봇 일정 생성 500 | ✅ | GCP FastAPI 재배포 |
| 4 | KRIDE 챗봇 recommend 500 | ✅ | budget 타입 수정 |
| 5 | goalTime 500 | ✅ | null → "" |
| 6 | AnimationController 400 | ✅ | NONE 상태 반환 |
| 7 | 영상 만들기 버튼 미표시 | ✅ | NONE 조건 추가 |
| 8 | 카카오 로그인 NPE | ✅ | null guard |
| 9 | 챗봇 SSE raw JSON | ✅ | 이중 래핑 제거 |
| 10 | deploy-ec2.yml 감지 실패 | ✅ | fetch-depth: 2 |
| 11 | RunPod 프록시 미존재 | ✅ | fastapi_server.py에 병합 |
| 12 | deploy-gcp.yml RunPod 미주입 | ✅ | 환경변수 주입 추가 |
| 13 | GCP 디스크 부족 | ✅ | prune + 자동 정리 |
| 14 | 카카오톡 알림 | ✅ | 신규 구현 |
| 15 | 다중 이미지 배치 영상 파이프라인 | ✅ | 신규 구현 |
| 16 | RunPod 502 Bad Gateway | ✅ | Endpoint ID + API Key + deploy 스크립트 수정 |

---

## 16. RunPod 502 Bad Gateway — Endpoint ID/API Key 불일치 [해결]

### 현상
`POST http://34.64.221.240:8000/jobs/runpod` → `502 Bad Gateway`
실제 원인: RunPod API가 `404 Not Found` 반환 (`https://api.runpod.ai/v2/fi81pdhrdkc5z5/run`)

### 원인 (3단계)
1. **Endpoint ID 만료**: 기존 `fi81pdhrdkc5z5` endpoint가 RunPod에서 삭제/비활성화됨 → 404
2. **GitHub Secret 미반영**: Secret을 `tg97vn7mggcxkp`로 업데이트했으나 GCP VM의 쉘 환경변수가 `.env`보다 우선 적용되어 이전 값 유지
3. **API Key 불일치**: 새 endpoint에 대해 기존 API Key가 `401 Unauthorized` 반환

### 수정
1. GitHub Secret `RUNPOD_ENDPOINT_ID` → `tg97vn7mggcxkp` (CLI: `gh secret set`)
2. GitHub Secret `RUNPOD_API_KEY` → 새 키로 업데이트
3. `deploy-gcp.yml` 배포 스크립트에 `.env` 명시적 export 추가:
```bash
# .env 파일의 값을 쉘 환경에 export하여 docker-compose 변수 치환에 확실히 반영
set -a
source .env
set +a
```
이 수정으로 GCP VM에 이전 환경변수가 남아있어도 `.env` 값이 확실히 적용됨.

### 검증
```
$ curl -X POST http://34.64.221.240:8000/jobs/runpod -d '{"route":"3d_photo_light",...}'
→ {"ok":true,"id":"9dde3c23-...","status":"IN_QUEUE"}  (HTTP 200)
```

### 상태: ✅ 해결 — 커밋 `c1de884b`

---

---

## 15. 다중 이미지 배치 영상 생성 파이프라인 [구현 완료]

### 개요
커뮤니티 게시글의 다중 이미지(최대 10장)를 하나의 영상으로 합성하는 전체 파이프라인 신규 구현.
- 이미지별 TTS 나레이션 + BGM + 순차 연결
- 사진/낙서 자동 분류 (색상 수 기반 휴리스틱)
- 사진+낙서 혼합 시 GIF 오버레이 합성

### 변경 파일 (12개)

**Phase 1 — RunPod 워커:**
- `deploy/media_motion/ffmpeg_utils.py` — `concat_videos`, `overlay_gif_on_video`, `mix_video_tts`, `apply_bgm_to_video` 4개 함수 추가
- `deploy/media_motion/schemas.py` — `BatchImageItem`, `BatchTravelCase` 데이터클래스
- `deploy/media_motion/batch_video_worker.py` — **신규** 배치 오케스트레이션
- `deploy/media_motion/runpod_handler.py` — `batch_video` 라우트 + images[] 파싱

**Phase 2 — API 게이트웨이:**
- `deploy/cloud_gateway/app.py` — `POST /jobs/runpod/batch`
- `src/api/fastapi_server.py` — `POST /jobs/runpod/batch` 미러

**Phase 3 — Spring Boot:**
- `V62__animation_batch_columns.sql` — total_images, processed_images, route 컬럼
- `AnimationJob.java` — 3개 필드 추가
- `AnimationService.java` — `submitBatchAnimation()` + ALLOWED_ROUTES에 batch_video
- `AnimationController.java` — `POST /batch` 엔드포인트

**Phase 4 — 프론트엔드:**
- `communityService.ts` — `BatchImageInput`, `submitBatchAnimation()`
- `CommunityPage.tsx` — "전체 이미지 영상 만들기" 버튼 + TTS/타입 설정 모달

### 향후 확장
- 이미지 캡셔닝 (BLIP-2): 이미지→텍스트 자동 생성 → TTS + MusicGen description 자동 결정
- 현재는 사용자 직접 TTS 텍스트 입력 (비워두면 게시글 제목 사용)

### 상태: ✅ 구현 완료 — 배포 필요 (RunPod 이미지 재빌드 + GCP/EC2 재배포)

---

## 우선순위 정리 (최종 업데이트)

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1 | 카카오 로그인 → sdui-delta 리다이렉트 | ✅ 해결 | GitHub Secrets WEB_URL 변경 |
| 2 | KRIDE 챗봇 SSE 400 | ✅ | `credentials: 'include'` 추가 |
| 3 | KRIDE 챗봇 일정 생성 500 | ✅ | GCP FastAPI 재배포 |
| 4 | KRIDE 챗봇 recommend 500 | ✅ | budget 타입 수정 |
| 5 | goalTime 500 | ✅ | null → "" |
| 6 | AnimationController 400 | ✅ | NONE 상태 반환 |
| 7 | 영상 만들기 버튼 미표시 | ✅ | NONE 조건 추가 |
| 8 | 카카오 로그인 NPE | ✅ | null guard |
| 9 | 챗봇 SSE raw JSON | ✅ | 이중 래핑 제거 |
| 10 | deploy-ec2.yml 감지 실패 | ✅ | fetch-depth: 2 |
| 11 | RunPod 프록시 미존재 | ✅ | fastapi_server.py에 병합 |
| 12 | deploy-gcp.yml RunPod 미주입 | ✅ | 환경변수 주입 추가 |
| 13 | GCP 디스크 부족 | ✅ | prune + 자동 정리 |
| 14 | 카카오톡 알림 | ✅ | 신규 구현 |
| 15 | 다중 이미지 배치 영상 | ✅ | 12파일 신규/수정, 배포 필요 |

---

## 16. 챗봇 일정 카드 "0일 · 0 스팟" 렌더링 버그 [수정 완료]

### 현상
챗봇에서 일정 생성 시 ItineraryCard에 "0일 추천 일정 / 0일 · 0 스팟"으로 표시, 실제 일정 내용 미렌더링

### 원인
API 응답 구조와 프론트엔드 타입 불일치:
- 백엔드: `{ itinerary: { itinerary: [{day:1, morning:...}], mapData:..., source_pois:... } }`
- 프론트 `KrideItinerary` 타입: `{ days?: KrideDayPlan[] }` ← `days` 필드 기대
- `itinerary.days`가 `undefined` → `days.length === 0` → "0일 · 0 스팟"

### 수정
**파일**: `metadata-project/lib/hooks/useKrideChatStream.ts`
- `KrideItinerary` import 추가
- 응답 파싱 시 `rawIt.itinerary` → `normalizedItinerary.days`로 매핑
- `kride-chat-update` 이벤트에도 정규화된 itinerary 전달

### 상태: ✅ 수정 완료 — 프론트 재배포 필요

---

## 17. "강남 데이트 코스"에 에버랜드/고양시 추천되는 문제 [수정 완료]

### 현상
"강남 데이트 코스 짜줘" 입력 시 에버랜드(용인), 정와한옥마을(고양) 등 강남과 무관한 장소 추천

### 원인
`fastapi_server.py`의 `_KNOWN_REGIONS`에 "강남"이 없음 → 메시지에서 지역 추출 실패 → 폼의 `["서울", "경기"]`로 너무 넓게 필터링

### 수정
**파일**: `src/api/fastapi_server.py`
`_KNOWN_REGIONS`에 서울 구/동 단위 22개 추가:
```python
"강남", "서초", "송파", "마포", "홍대", "이태원", "용산", "종로",
"성수", "잠실", "여의도", "강서", "영등포", "동대문", "명동",
"강북", "노원", "은평", "관악", "광진", "성동", "중구",
```

### 상태: ✅ 수정 완료 — GCP FastAPI 재배포 필요

---

## 18. RunPod Dockerfile pip install 빌드 실패 [수정 완료]

### 현상
`Dockerfile.runpod` 빌드 시 단일 RUN 레이어에서 pip install 실패. `--quiet` 플래그로 에러 원인 불명확.

### 원인 후보
1. `mmcv-full==1.7.0` 프리빌트 휠 URL 제거 (OpenMMLab deprecated)
2. `chumpy` 빌드 실패 (Python 3.8 + 최신 setuptools)
3. `PyOpenGL-accelerate` 컴파일 실패

### 수정
**파일**: `deploy/media_motion/Dockerfile.runpod`
- 단일 RUN → 7개 레이어로 분리 (실패 지점 특정 + Docker 캐시 활용)
- `--quiet` 제거 (에러 메시지 노출)
- `chumpy` fallback: PyPI 실패 시 GitHub 소스 설치
- `mmcv-full` fallback: 프리빌트 휠 없으면 소스 빌드
- `PyOpenGL-accelerate` 선택적: 컴파일 실패해도 빌드 계속

### 상태: ✅ 수정 완료 — RunPod 이미지 재빌드 필요

---

## 우선순위 정리 (최종 업데이트 2026-05-31 #2)

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1 | 카카오 로그인 → sdui-delta 리다이렉트 | ✅ 해결 | GitHub Secrets WEB_URL 변경 |
| 2 | KRIDE 챗봇 SSE 400 | ✅ | `credentials: 'include'` 추가 |
| 3 | KRIDE 챗봇 일정 생성 500 | ✅ | GCP FastAPI 재배포 |
| 4 | KRIDE 챗봇 recommend 500 | ✅ | budget 타입 수정 |
| 5 | goalTime 500 | ✅ | null → "" |
| 6 | AnimationController 400 | ✅ | NONE 상태 반환 |
| 7 | 영상 만들기 버튼 미표시 | ✅ | NONE 조건 추가 |
| 8 | 카카오 로그인 NPE | ✅ | null guard |
| 9 | 챗봇 SSE raw JSON | ✅ | 이중 래핑 제거 |
| 10 | deploy-ec2.yml 감지 실패 | ✅ | fetch-depth: 2 |
| 11 | RunPod 프록시 미존재 | ✅ | fastapi_server.py에 병합 |
| 12 | deploy-gcp.yml RunPod 미주입 | ✅ | 환경변수 주입 추가 |
| 13 | GCP 디스크 부족 | ✅ | prune + 자동 정리 |
| 14 | 카카오톡 알림 | ✅ | 신규 구현 |
| 15 | 다중 이미지 배치 영상 | ✅ | 12파일 신규/수정, 배포 필요 |
| 16 | 챗봇 일정 카드 "0일" 버그 | ✅ | itinerary→days 정규화 |
| 17 | 강남 지역 필터링 누락 | ✅ | _KNOWN_REGIONS 구 단위 추가 |
| 18 | RunPod Dockerfile 빌드 실패 | ✅ | pip 레이어 분리 + fallback |

---

## 19. 배치 영상 품질 개선 + BGM/TTS 수정 + CSP Cloudinary 추가 [수정 완료] (2026-06-07)

### 현상 (3가지 문제)
1. **영상 품질 저하**: `photo_route` 기본값이 `3d_photo_light` (ffmpeg zoompan) → CogVideoX GPU 모델 미사용
2. **BGM 안 들림**: sine wave BGM이 `-18dB` 감쇠로 거의 무음
3. **CSP 차단**: `res.cloudinary.com`이 `media-src`에 미등록 → 브라우저에서 영상 재생 차단

### 수정 내용

#### (1) photoRoute 기본값 `3d_photo_light` → `cogvideox_real` (4파일)
- `communityService.ts:152` — `submitBatchAnimation()` 기본 파라미터
- `AnimationService.java:99` — fallback 기본값
- `AnimationController.java:63` — fallback 기본값
- `cloud_gateway/app.py:361` — `RunPodBatchJobRequest.photo_route` 기본값

#### (2) BGM 볼륨 조정 (`ffmpeg_utils.py`)
- `mix_video_tts_bgm()`: `-18dB` → `-8dB`
- `apply_bgm_to_video()`: `-18dB` → `-8dB`
- `make_sine_bgm()`: `-18dB/-22dB` → `-10dB/-14dB`

#### (3) 에러 로깅 강화 (`batch_video_worker.py`)
- `_generate_photo_segment()`: CogVideoX 실패 시 `print()` + `traceback.print_exc()`
- `_generate_sketch_segment()`: AnimatedDrawings 실패 시 동일
- `run_batch_video_case()`: segment 루프 try/except + 실패 이미지 건너뛰기

#### (5) CogVideoX 호출 버그 수정 (`batch_video_worker.py:77`)
- `create_cogvideox_real_video(case.image_path, ...)` → `create_cogvideox_real_video(case, ...)`
- 함수가 `TravelCase` 객체를 기대하는데 `PosixPath`를 전달하여 `AttributeError` 발생

#### (4) CSP Cloudinary 추가 (`next.config.ts`) — 이전 커밋에서 완료
- `connectSrc` + `media-src`에 `https://res.cloudinary.com`

### 상태: ✅ 수정 완료 — 배포 필요 (RunPod 이미지 재빌드 + EC2/GCP 재배포)

---

## 우선순위 정리 (최종 업데이트 2026-06-07)

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1~18 | (이전 이슈 모두) | ✅ | — |
| 19 | 배치 영상 품질/BGM/CSP | ✅ | photoRoute→cogvideox_real, BGM 볼륨 +10dB, 에러 로깅, CSP 추가 |

---

## 20. BLIP-2 자동 캡셔닝 → 한국어 TTS 연동 [구현 완료] (2026-06-07)

### 개요
배치 영상 생성 시 `tts_text`가 비어있는 이미지에 BLIP-2로 자동 캡셔닝 → 한국어 번역 → gTTS 나레이션 생성.

### 파이프라인
```
이미지 → BLIP-2 (영어 캡션) → MarianMT (영→한 번역) → gTTS(ko) → 영상 나레이션
```

### 모델
- `Salesforce/blip-image-captioning-base` (~1GB VRAM) — 이미지→영어 캡션
- `Helsinki-NLP/opus-mt-en-ko` (~300MB) — 영→한 번역

### 변경 파일 (4개)
| 파일 | 변경 |
|------|------|
| `deploy/media_motion/blip2_captioning.py` | **신규** — BLIP-2 캡셔닝 + MarianMT 번역 모듈 |
| `deploy/media_motion/worker_config.py` | `blip2_model_id`, `blip2_translation_model_id`, `blip2_enabled` 3개 필드 추가 |
| `deploy/media_motion/batch_video_worker.py` | Step 1.5 캡셔닝 호출 삽입 (tts_text 빈 경우만) |
| `deploy/media_motion/Dockerfile.runpod` | `sentencepiece` pip install + BLIP/MarianMT 모델 pre-download |

### 동작 조건
- `cfg.blip2_enabled=True` (기본값) + `tts_text.strip()`이 빈 문자열일 때만 실행
- 사용자가 TTS 텍스트를 입력한 이미지는 BLIP-2 건너뜀

### 메모리 관리
- BLIP-2 추론 후 `torch.cuda.empty_cache()` 호출 → CogVideoX VRAM 충돌 방지
- 번역 모델도 추론 후 즉시 해제

### Fallback
- BLIP-2 실패 → 파일명 기반 기본 텍스트 ("여행 사진: {파일명}")
- 번역 실패 → 영어 캡션 그대로 gTTS에 전달

### 상태: ✅ 구현 완료 — RunPod 이미지 재빌드 필요

---

## 우선순위 정리 (최종 업데이트 2026-06-07 #2)

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1~19 | (이전 이슈 모두) | ✅ | — |
| 20 | BLIP-2 자동 캡셔닝 + 한국어 TTS | ✅ | 신규 구현, RunPod 재빌드 필요 |

---

## 21. GPT-SoVITS TTS + MusicGen BGM + Celery/Redis 병렬화 [구현 완료] (2026-06-07)

### 개요
배치 영상 파이프라인의 TTS를 Celery group으로 병렬 처리하고, GPT-SoVITS/MusicGen 실제 모델을 연결.
RunPod 컨테이너 내부에 embedded Redis + Celery worker + supervisord 프로세스 관리 적용.

### 아키텍처
```
[RunPod Container]
├── redis-server (embedded, localhost:6379)
├── Celery Worker (media queue, concurrency=4)
│   ├── task_tts_segment(img0~N) ── parallel (group)
│   └── task_musicgen_bgm()       ── 별도 task
├── supervisord (redis → celery → handler 순서 관리)
└── RunPod Handler (batch_video 라우트)
```

### Fallback 전략
- **TTS**: GPT-SoVITS → gTTS (per-task fallback) → 순차 gTTS (Celery 연결 실패 시)
- **BGM**: MusicGen (bgm_description 있을 때) → sine-wave preset (bgm_key 기반)

### 신규 파일 (4개)
| 파일 | 역할 |
|------|------|
| `deploy/media_motion/celery_media.py` | Celery app 설정 (Redis localhost broker, media queue) |
| `deploy/media_motion/media_tasks.py` | `task_tts_segment`, `task_musicgen_bgm` Celery tasks |
| `deploy/media_motion/musicgen_bgm.py` | MusicGen 헬퍼 함수 (runpod_handler에서 추출) |
| `deploy/media_motion/supervisord.conf` | Redis→Celery→Handler 프로세스 관리 |

### 수정 파일 (6개)
| 파일 | 변경 |
|------|------|
| `deploy/media_motion/schemas.py` | `bgm_description`, `bgm_duration` 필드 추가 |
| `deploy/media_motion/batch_video_worker.py` | Step 2/3 분리, TTS Celery group 병렬화, BGM MusicGen 우선 |
| `deploy/media_motion/runpod_handler.py` | `bgm_description`, `bgm_duration` 파싱 |
| `deploy/media_motion/Dockerfile.runpod` | redis-server, supervisor, celery[redis], GPT-SoVITS deps, CMD→supervisord |
| `deploy/cloud_gateway/app.py` | `bgm_description`, `bgm_duration` 전달 |
| `src/api/fastapi_server.py` | `bgm_description`, `bgm_duration` 전달 |

### 핵심 변경: batch_video_worker.py
- **Step 2** (영상 생성): 기존 순차 유지 (GPU 메모리 집약적)
- **Step 3** (TTS): `celery.group`으로 병렬 디스패치 → 전체 완료 대기 → mix
- **Step 5** (BGM): `bgm_description` 있으면 MusicGen Celery task → 실패 시 sine-wave fallback

### 상태: ✅ 구현 완료 — RunPod 이미지 재빌드 + GCP/EC2 재배포 필요

---

---

## 22. 프론트엔드 + Spring Boot — MusicGen BGM 파라미터 연결 [구현 완료] (2026-06-07)

### 개요
#21에서 구현한 MusicGen BGM 생성을 프론트엔드 UI에서 제어할 수 있도록 `bgmDescription`, `bgmDuration` 파라미터를 전체 파이프라인에 연결.

### 변경 파일 (4개)

| 파일 | 변경 |
|------|------|
| `metadata-project/services/communityService.ts` | `submitBatchAnimation()`에 `bgmDescription`, `bgmDuration` 파라미터 + payload 전달 |
| `metadata-project/components/community/CommunityPage.tsx` | `batchBgmDescription`, `batchBgmDuration` state + 배치 모달에 BGM 설명 입력 필드 + 길이 설정 (5~30초) |
| `SDUI-server/.../dto/BatchAnimationRequest.java` | `bgmDescription` (String), `bgmDuration` (int, @Min(5) @Max(30)) 필드 추가 |
| `SDUI-server/.../service/AnimationService.java` | payload에 `bgm_description`, `bgm_duration` 전달 |

### 데이터 흐름
```
프론트 배치 모달 BGM 설명 입력
  → communityService.submitBatchAnimation(bgmDescription, bgmDuration)
  → Spring Boot BatchAnimationRequest → AnimationService payload
  → GCP FastAPI /jobs/runpod/batch → RunPod handler
  → batch_video_worker → MusicGen Celery task or sine-wave fallback
```

### UI 동작
- BGM 설명 입력 필드: 비워두면 기존 sine-wave BGM (bgm_key 기반)
- BGM 설명 입력 시 → MusicGen AI로 BGM 자동 생성
- BGM 길이 설정 (5~30초): BGM 설명 입력 시에만 표시

### 상태: ✅ 구현 완료 — EC2/GCP 재배포 필요

---

## 우선순위 정리 (최종 업데이트 2026-06-07 #4)

| # | 이슈 | 상태 | 조치 |
|---|------|------|------|
| 1~20 | (이전 이슈 모두) | ✅ | — |
| 21 | GPT-SoVITS + MusicGen + Celery 병렬화 | ✅ | 10파일 신규/수정, RunPod 재빌드 필요 |
| 22 | MusicGen BGM 프론트+백엔드 연결 | ✅ | 4파일 수정, EC2/GCP 재배포 필요 |
| 23 | RunPod Pod 시작 실패 | ⚠️ | Docker daemon timeout/호스트 리소스 상태 확인 필요 |

---

## 23. RunPod Pod 시작 실패 — `docker.sock` timeout (`context deadline exceeded`)

### 현상
RunPod Pod 생성 중 다음 오류가 발생했습니다:

```text
error creating container: container: create: container create: Post "http://%2Fvar%2Frun%2Fdocker.sock/v1.51/containers/create?name=bbtlsygauasmii-0": context deadline exceeded
```

### 원인 추정
- RunPod 호스트의 Docker 데몬이 과부하 또는 응답 불가 상태
- `/var/run/docker.sock`에 대한 접근 지연 또는 타임아웃
- 이미지 풀/컨테이너 생성 중 호스트 I/O나 네트워크 지연
- 호스트 디스크/메모리 리소스 부족 또는 Docker 데몬 재시작 중

### 조치
1. RunPod 호스트 상태 확인
   - Docker 데몬이 살아 있는지, `/var/run/docker.sock` 접근이 가능한지
   - 호스트의 디스크 사용량 및 I/O 대기 상태
   - 현재 컨테이너 생성 로그에서 Docker daemon 관련 오류
2. 동일 볼륨과 이미지로 Pod를 다시 생성해 봅니다.
3. 같은 에러가 반복되면 다른 호스트/리전의 RunPod 노드로 재배포를 시도합니다.
4. 필요 시 RunPod 지원팀에 로그와 함께 문의합니다.

### 해결 방법
- 일반적인 경우에는 동일한 `yerinmin/kride-tora-gpu:976947d` 이미지와 활성 `kride-tora-models` 볼륨을 그대로 재시도합니다.
- Pod 생성 과정에서 호스트 리소스 문제가 있을 수 있으므로, `docker.sock` timeout이 계속 발생하면 노드를 교체하거나 RunPod 측 서비스 상태를 점검해야 합니다.

### 상태
- ⚠️ 조사 중 — 재시도 및 호스트 상태 확인 필요

---

## 참조 문서
- `.ai/issues_0529.md` — 이전 미해결 이슈 (구글 캘린더 + BTS 광화문)
- `.ai/code_review_0527.md` — K5 (Security 인증 설정) 관련
- `.ai/llm_graphrag_route_optimization_0530.md` — LLM + GraphRAG + 동선 최적화 구현 및 배포 상세
- `subproject/SDUI/.ai/maintenance/kakao_login_error_history.md` — 카카오 로그인 디버깅 이력
- `.ai/github_secrets_checklist.md` — GitHub Secrets 전체 목록 및 상태
