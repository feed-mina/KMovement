package com.domain.demo_backend.domain.celery.service;

import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.domain.CeleryJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class CeleryJobService {

    private static final Set<String> ALLOWED_TASK_TYPES = Set.of(
            "embed", "rerank", "weather", "event"
    );
    private static final List<String> ACTIVE_STATUSES = List.of("QUEUED", "PENDING", "STARTED", "RETRY");
    private static final Set<String> TERMINAL_STATUSES = Set.of("SUCCESS", "FAILURE");

    private final CeleryJobRepository celeryJobRepository;
    private final WebClient gatewayClient;

    public CeleryJobService(
            CeleryJobRepository celeryJobRepository,
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl,
            @Value("${fastapi.internal-api-key:sdui-internal-dev-key}") String internalApiKey
    ) {
        this.celeryJobRepository = celeryJobRepository;
        WebClient.Builder builder = WebClient.builder().baseUrl(fastApiUrl);
        if (internalApiKey != null && !internalApiKey.isBlank()) {
            builder.defaultHeader("X-Internal-Api-Key", internalApiKey);
        }
        this.gatewayClient = builder.build();
    }

    @Transactional
    public CeleryJob submitJob(String taskType, Map<String, Object> payload, Long requestedBy) {
        if (!ALLOWED_TASK_TYPES.contains(taskType)) {
            throw new IllegalArgumentException("지원하지 않는 작업 유형: " + taskType);
        }

        try {
            Map<String, Object> response = gatewayClient.post()
                    .uri("/jobs/celery/{taskType}", taskType)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

            String taskId = response != null ? text(response.get("task_id")) : null;
            if (taskId == null) {
                return saveFailedJob(taskType, requestedBy, "FastAPI가 task_id를 반환하지 않았습니다.");
            }

            return celeryJobRepository.save(CeleryJob.builder()
                    .celeryTaskId(taskId)
                    .taskType(taskType)
                    .status("QUEUED")
                    .requestedBy(requestedBy)
                    .build());
        } catch (Exception e) {
            log.error("Celery 작업 제출 실패. taskType={}, error={}", taskType, e.getMessage());
            return saveFailedJob(taskType, requestedBy, "Celery 작업 제출 실패: " + e.getMessage());
        }
    }

    @Transactional
    public CeleryJob refreshJob(CeleryJob job) {
        if (TERMINAL_STATUSES.contains(job.getStatus()) || job.getCeleryTaskId() == null) {
            return job;
        }

        try {
            Map<String, Object> statusResponse = gatewayClient.get()
                    .uri("/jobs/celery/{taskId}", job.getCeleryTaskId())
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

            applyCeleryStatus(job, statusResponse);
        } catch (Exception e) {
            log.warn("Celery 상태 조회 실패. taskId={}, error={}",
                    job.getCeleryTaskId(), e.getMessage());
        }
        return celeryJobRepository.save(job);
    }

    @Transactional(readOnly = true)
    public CeleryJob getJobStatus(String celeryTaskId) {
        return celeryJobRepository.findByCeleryTaskId(celeryTaskId)
                .orElseThrow(() -> new IllegalArgumentException("작업을 찾을 수 없습니다."));
    }

    public List<CeleryJob> getActiveJobs() {
        return celeryJobRepository.findByStatusInAndNotifSentFalse(ACTIVE_STATUSES);
    }

    private void applyCeleryStatus(CeleryJob job, Map<String, Object> statusResponse) {
        if (statusResponse == null) return;

        String status = text(statusResponse.get("status"));
        if (status == null) return;

        switch (status) {
            case "SUCCESS":
                job.setStatus("SUCCESS");
                Object result = statusResponse.get("result");
                if (result != null) {
                    job.setResultJson(result.toString());
                }
                job.setErrorMessage(null);
                break;
            case "FAILURE":
                job.setStatus("FAILURE");
                job.setErrorMessage(text(statusResponse.get("error")));
                break;
            case "STARTED":
            case "RETRY":
                job.setStatus(status);
                break;
            default:
                // Custom states from update_state (CAPTIONING, TTS_RUNNING, etc.)
                job.setStatus(status);
                Object meta = statusResponse.get("meta");
                if (meta instanceof Map<?, ?> metaMap) {
                    String step = text(metaMap.get("step"));
                    if (step != null) job.setProgressStep(step);
                    Object progress = metaMap.get("progress");
                    if (progress instanceof Number n) job.setProgressPct(n.intValue());
                }
                break;
        }
    }

    private CeleryJob saveFailedJob(String taskType, Long requestedBy, String errorMessage) {
        return celeryJobRepository.save(CeleryJob.builder()
                .taskType(taskType)
                .status("FAILURE")
                .requestedBy(requestedBy)
                .errorMessage(errorMessage)
                .build());
    }

    private String text(Object value) {
        if (value == null) return null;
        String t = String.valueOf(value).trim();
        return t.isEmpty() || "null".equalsIgnoreCase(t) ? null : t;
    }
}
