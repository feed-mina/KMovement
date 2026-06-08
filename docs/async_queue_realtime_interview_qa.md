# 비동기 큐와 실시간 최적화 면접 답변 정리

## 문서 목적

이 문서는 K-Ride 프로젝트에서 비동기 큐 작업이 어떻게 구성되어 있는지, 그리고 웹캠처럼 저사양 또는 실시간성이 중요한 환경에서 연산 속도를 최적화하기 위해 어떤 노력을 했는지 설명하기 위한 면접/발표용 정리 문서입니다.

핵심은 두 가지입니다.

- 무거운 AI 작업을 사용자 요청 흐름에서 분리했다.
- 상황에 따라 무거운 모델 대신 가벼운 fallback 경로를 사용할 수 있게 했다.

---

## 질문 1. 현재 프로젝트에서 비동기 큐 작업이 어떻게 이루어지고 있나요?

### 한 문장 답변

K-Ride 프로젝트에서는 무거운 AI 추론이나 영상 생성 작업을 사용자의 요청 안에서 바로 처리하지 않고, 작업 ID를 먼저 반환한 뒤 백그라운드 워커나 외부 GPU 작업 큐에서 처리하도록 구성했습니다.

### 비개발자도 이해하기 쉬운 설명

식당으로 비유하면, 사용자가 영상 생성을 요청하는 것은 손님이 음식을 주문하는 것과 같습니다.

음식이 완성될 때까지 손님을 카운터 앞에 세워두면 불편합니다. 그래서 카운터는 먼저 주문번호를 줍니다. 손님은 자리에서 기다리고, 주방은 뒤에서 순서대로 요리를 합니다. 음식이 완성되면 주문번호로 상태를 확인하거나 알림을 받을 수 있습니다.

이 프로젝트의 비동기 구조도 비슷합니다.

- 사용자가 영상 생성 요청을 보낸다.
- 서버는 무거운 AI 모델을 바로 실행하지 않는다.
- 대신 RunPod 또는 Celery worker 쪽에 작업을 넘긴다.
- 서버는 `jobId` 또는 `runpodJobId`를 먼저 반환한다.
- 작업 상태는 `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`처럼 관리된다.
- Spring Scheduler가 주기적으로 작업 상태를 확인하고 DB를 갱신한다.

### 코드 기반 설명

#### 1. Celery + Redis 큐 구조

FastAPI 쪽에는 Celery 기반 비동기 큐 설정이 있습니다.

관련 파일:

- `src/api/celery_app.py`
- `src/api/tasks.py`
- `docker-compose.gpu.yml`
- `docker-compose.local.yml`
- `Dockerfile.worker`

상세 진단과 연결 작업 계획은 `docs/celery_redis_current_state_and_plan.md`에 별도로 정리했습니다. 이 문서에서는 면접/발표에 필요한 핵심 흐름만 요약합니다.

`src/api/celery_app.py`에서는 Redis를 Celery의 broker와 result backend로 사용합니다.

```python
REDIS_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/1")

celery = Celery("kride", broker=REDIS_URL, backend=REDIS_URL)
```

여기서 Redis는 작업 대기열 역할을 합니다. FastAPI가 작업을 큐에 넣으면, Celery worker가 Redis에서 작업을 꺼내 처리하는 구조입니다.

또한 큐는 작업 성격에 따라 `ml`, `media`로 나뉩니다.

```python
task_routes={
    "src.api.tasks.task_embed_texts": {"queue": "ml"},
    "src.api.tasks.task_predict_weather": {"queue": "ml"},
    "src.api.tasks.task_generate_tts": {"queue": "media"},
    "src.api.tasks.task_generate_video": {"queue": "media"},
}
```

`src/api/tasks.py`에는 실제 Celery 태스크가 정의되어 있습니다.

```python
@celery.task(bind=True, max_retries=3, default_retry_delay=5)
def task_embed_texts(self, texts: list[str]) -> list:
    resp = httpx.post(
        f"{TORCHSERVE_URL}/predictions/embedder",
        json={"text": texts},
        timeout=15.0,
    )
```

이 태스크들은 직접 모델을 실행하기보다 TorchServe에 HTTP 요청을 보내는 방식입니다. 실패하면 `max_retries=3` 설정에 따라 재시도합니다.

Docker Compose에서도 Redis와 Celery worker가 함께 실행되도록 구성되어 있습니다.

```yaml
celery-worker:
  command: celery -A src.api.celery_app worker -l info -c 2 -Q ml,media
  depends_on:
    redis:
      condition: service_healthy
```

여기서 `-c 2`는 worker 동시 실행 수를 2로 제한한다는 의미입니다. GPU 메모리 과부하를 줄이기 위한 설정입니다.

현재는 FastAPI에 Celery ML task 제출 API와 상태 조회 API가 추가되어 실제 `apply_async()` 제출이 가능합니다. 다만 기존 추천·날씨·이벤트 API는 호환성을 위해 동기 TorchServe 호출을 유지하고 있으며, 사용자-facing 영상 생성은 아래 RunPod 구조가 여전히 중심입니다.

추가로 현재 `task_routes`에는 `task_rerank`, `task_classify_event`가 빠져 있습니다. worker는 `ml,media` 큐만 소비하도록 실행되므로, 이 두 task를 실제로 Celery로 호출하려면 먼저 route를 `ml` 큐에 명시적으로 추가해야 합니다.

향후 FastAPI와 Celery를 실제 사용자 흐름에 연결하려면 다음 작업이 필요합니다.

1. Redis DB 번호와 책임을 분리한다. 예: Spring cache/token은 DB 0, FastAPI Celery는 DB 1.
2. `CELERY_BROKER_URL`과 `CELERY_RESULT_BACKEND`를 명확히 설정한다.
3. 누락된 task route를 추가하고, `result_expires`로 결과 만료 시간을 정한다.
4. FastAPI에 `POST /jobs/celery/...` 작업 제출 API와 `GET /jobs/celery/{task_id}` 상태 조회 API를 추가한다.
5. Spring Boot는 기존 RunPod job 저장 방식처럼 `task_id`, `status`, `result`를 DB에 저장하거나, FastAPI status API를 proxy한다.
6. 긴 미디어 작업에는 `self.update_state(...)`로 진행률을 업데이트해 향후 SSE/WebSocket UI와 연결할 수 있게 한다.
7. Docker Compose smoke test로 Redis, worker, task roundtrip을 검증한다.

#### 2. RunPod + DB 상태 폴링 구조

커뮤니티 애니메이션/영상 생성 기능은 RunPod Serverless를 이용합니다.

관련 파일:

- `src/api/fastapi_server.py`
- `subproject/SDUI/SDUI-server/src/main/java/.../AnimationController.java`
- `subproject/SDUI/SDUI-server/src/main/java/.../AnimationService.java`
- `subproject/SDUI/SDUI-server/src/main/java/.../AnimationJob.java`
- `subproject/SDUI/SDUI-server/src/main/java/.../AnimationJobPollingScheduler.java`
- `subproject/SDUI/SDUI-server/src/main/resources/db/migration/V55__community_animation_jobs.sql`

Spring Controller는 사용자의 애니메이션 생성 요청을 받습니다.

```java
@PostMapping
public ResponseEntity<ApiResponse<Map<String, Object>>> submitAnimation(
        @PathVariable("postId") Long postId,
        @RequestBody Map<String, String> body) {
```

`AnimationService`는 FastAPI의 `/jobs/runpod`으로 요청을 보냅니다.

```java
response = gatewayClient.post()
        .uri("/jobs/runpod")
        .bodyValue(payload)
        .retrieve()
        .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
        .block();
```

FastAPI는 RunPod Serverless API의 `/run` 엔드포인트로 작업을 넘깁니다.

```python
url = f"https://api.runpod.ai/v2/{RUNPOD_ENDPOINT_ID}/run"
resp = httpx.post(url, headers=headers, json=payload, timeout=30)
```

RunPod는 작업 ID를 반환합니다. Spring 서버는 이 ID를 DB에 저장합니다.

```java
AnimationJob job = AnimationJob.builder()
        .post(post)
        .runpodJobId(runpodJobId)
        .status("QUEUED")
        .build();
```

DB에는 작업 상태를 저장하기 위한 테이블이 있습니다.

```sql
CREATE TABLE IF NOT EXISTS community_animation_jobs (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL REFERENCES community_post(post_id) ON DELETE CASCADE,
    runpod_job_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'QUEUED',
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

이후 Scheduler가 60초마다 RunPod 상태를 확인합니다.

```java
@Scheduled(fixedDelay = 60000)
public void pollRunPodJobs() {
    List<AnimationJob> pendingJobs = animationJobRepository
            .findByStatusInAndNotifSentFalse(List.of("QUEUED", "RUNNING"));
```

RunPod가 `COMPLETED`를 반환하면 DB 상태를 완료로 바꾸고 결과 URL을 저장합니다.

```java
case "COMPLETED" -> {
    job.setStatus("COMPLETED");
    job.setResultUrl(String.valueOf(resultUrl));
    animationJobRepository.save(job);
    sendNotification(job, true);
}
```

### 면접용 답변 예시

K-Ride 프로젝트에서는 무거운 AI 작업을 사용자 요청 안에서 바로 실행하지 않도록 비동기 구조를 적용했습니다. 예를 들어 커뮤니티 영상 생성 요청이 들어오면 Spring 서버가 FastAPI의 `/jobs/runpod` 엔드포인트로 작업을 제출하고, RunPod Serverless에서 실제 GPU 작업을 처리합니다. 서버는 RunPod가 반환한 작업 ID를 DB에 저장하고 상태를 `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`로 관리합니다. 이후 Scheduler가 주기적으로 상태를 폴링해 DB를 갱신하고 완료 시 알림을 보냅니다.

또한 FastAPI 쪽에는 Celery와 Redis 기반의 비동기 큐 구조가 구현되어 있습니다. Redis를 broker와 result backend로 사용하고, `ml`, `media` 큐를 나누어 AI 추론 작업과 미디어 생성 작업을 분리했습니다. ML task 제출/상태 조회 API는 연결됐으며, 실제 사용자-facing 영상 생성 기능은 RunPod와 DB 폴링 구조가 중심입니다.

---

## 질문 2. 웹캠 등 저사양 환경이나 실시간 환경에서 연산 속도를 최적화하기 위해 어떤 노력을 했나요?

### 한 문장 답변

저사양 또는 실시간 환경에서는 무거운 AI 모델을 요청 흐름에서 분리하고, 상황에 따라 가벼운 fallback 모델이나 worker route를 선택하도록 설계했습니다.

### 비개발자도 이해하기 쉬운 설명

실시간 환경에서는 사용자가 버튼을 눌렀을 때 화면이 멈추면 안 됩니다. 특히 영상 생성, 음성 합성, 고해상도 이미지 처리 같은 작업은 시간이 오래 걸립니다.

그래서 이 프로젝트에서는 무거운 일을 사용자가 기다리는 화면에서 바로 처리하지 않고 뒤쪽 작업 공간으로 넘겼습니다. 사용자는 먼저 작업이 접수되었다는 응답을 받고, 서버는 뒤에서 영상을 생성합니다.

또한 모든 상황에서 가장 무거운 모델을 사용하지 않았습니다. 고품질 결과가 필요하면 무거운 모델을 쓰고, 빠른 결과나 저사양 환경이 중요하면 가벼운 방식으로 대체할 수 있게 했습니다.

쉽게 말하면 다음과 같습니다.

- 고급 렌더링이 가능하면 무거운 모델 사용
- 빠른 응답이 필요하면 가벼운 fallback 경로 사용
- 서버가 멈추지 않도록 worker 동시성 제한
- 작업이 오래 걸리면 상태를 폴링하는 방식으로 전환

### 코드 기반 설명

#### 1. 무거운 작업을 사용자 요청 흐름에서 분리

Spring 서버는 영상 생성이 끝날 때까지 기다리는 구조가 아니라, 먼저 작업을 제출하고 job ID를 저장합니다.

```java
AnimationJob job = AnimationJob.builder()
        .post(post)
        .runpodJobId(runpodJobId)
        .status("QUEUED")
        .build();
```

이렇게 하면 사용자는 바로 응답을 받을 수 있고, 실제 영상 생성은 RunPod worker가 처리합니다.

#### 2. 작업 상태를 폴링하여 화면 멈춤 방지

작업이 오래 걸릴 수 있기 때문에 결과를 즉시 반환하려고 하지 않습니다. 대신 상태 조회 API와 Scheduler를 사용합니다.

```java
@GetMapping("/status")
public ResponseEntity<ApiResponse<Map<String, Object>>> getAnimationStatus(
        @PathVariable("postId") Long postId) {
```

그리고 백그라운드에서는 60초마다 상태를 확인합니다.

```java
@Scheduled(fixedDelay = 60000)
public void pollRunPodJobs() {
```

이 구조 덕분에 사용자의 화면은 멈추지 않고, 서버도 장시간 HTTP 연결을 붙잡고 있지 않습니다.

#### 3. 무거운 모델과 가벼운 fallback 경로 분리

RunPod handler에는 여러 route가 정의되어 있습니다.

```python
SUPPORTED_ROUTES = {
    "cogvideox_real",
    "3d_photo_light",
    "3d_photo_inpainting_real",
    "cogvideo_fallback",
    "gpt_sovits_tts",
    "musicgen",
    "animated_drawings_worker",
    "batch_video",
}
```

이 중 `cogvideox_real`은 상대적으로 무거운 고품질 영상 생성 route입니다. 반면 `3d_photo_light`, `cogvideo_fallback`, `animated_drawings_worker`는 더 가볍거나 fallback으로 사용할 수 있는 경로입니다.

즉 실시간성이나 안정성이 중요한 상황에서는 가장 무거운 모델만 고집하지 않고, 더 빠르게 처리할 수 있는 경로를 선택할 수 있게 했습니다.

#### 4. worker 동시성 제한

Celery worker는 한 번에 너무 많은 작업을 처리하지 않도록 설정되어 있습니다.

```yaml
command: celery -A src.api.celery_app worker -l info -c 2 -Q ml,media
```

또한 Celery 설정에는 다음 옵션이 들어가 있습니다.

```python
task_acks_late=True
worker_prefetch_multiplier=1
```

이 설정은 worker가 작업을 너무 많이 미리 가져가서 GPU 메모리를 과도하게 점유하는 상황을 줄이는 데 도움이 됩니다.

### 면접용 답변 예시

웹캠이나 실시간 환경에서는 사용자가 요청한 순간 무거운 모델을 바로 실행하면 화면이 멈추거나 타임아웃이 발생할 수 있다고 봤습니다. 그래서 영상 생성 같은 긴 작업은 RunPod 또는 Celery 기반 백그라운드 작업 구조로 분리했습니다. 서버는 먼저 job ID를 반환하고, 실제 AI 생성은 GPU worker가 처리하도록 했습니다.

또한 모든 상황에서 가장 무거운 모델만 사용하지 않고, `cogvideox_real`, `3d_photo_light`, `cogvideo_fallback`, `animated_drawings_worker`처럼 route를 나눴습니다. 고품질이 중요할 때는 무거운 모델을 사용하고, 빠른 응답이나 저사양 환경이 중요할 때는 가벼운 fallback 경로를 선택할 수 있게 했습니다.

마지막으로 worker 동시성을 제한하고 작업 상태를 DB에 저장해 `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`로 관리했습니다. 이를 통해 GPU 메모리 과부하를 줄이고, 사용자의 요청 화면이 멈추지 않도록 했습니다.

### 더 짧은 답변

저사양이나 실시간 환경에서는 무거운 연산을 사용자 요청 안에서 바로 처리하지 않는 것이 중요하다고 생각했습니다. 그래서 영상 생성 작업은 RunPod/Celery 같은 백그라운드 worker에 넘기고, 서버는 job ID를 먼저 반환하도록 구성했습니다. 또 상황에 따라 무거운 CogVideoX 대신 `3d_photo_light`나 fallback worker를 사용할 수 있게 route를 나누어 응답성과 안정성을 확보했습니다.

---

## 답변할 때 주의할 점

과장해서 말하지 않는 것이 좋습니다.

현재 코드 기준으로 FastAPI의 Celery task 제출과 상태 조회 연결까지 구현되어 있습니다. 다만 기존 사용자-facing 영상 생성은 RunPod 구조가 중심이므로, 면접에서는 두 흐름의 역할을 구분해 말하는 것이 자연스럽습니다.

> Celery/Redis 기반 ML task 제출과 상태 조회 API를 구현했고, 실제 커뮤니티 영상 생성 기능은 RunPod Serverless와 DB 상태 폴링 구조로 비동기 처리했습니다.

이렇게 말하면 구현한 부분과 준비한 부분을 정확히 구분할 수 있습니다.
