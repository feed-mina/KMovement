package com.domain.demo_backend.domain.celery.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.domain.CeleryJobRepository;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class CeleryJobService {

    private static final Set<String> ALLOWED_TASK_TYPES = Set.of(
            "embed", "rerank", "weather", "event", "tts", "video", "KPOP_OUTFIT_ANALYSIS"
    );
    private static final Set<String> MEDIA_TASK_TYPES = Set.of("tts", "video", "KPOP_OUTFIT_ANALYSIS");
    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "SUCCESS", "FAILURE", "REVOKED", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"
    );
    private static final int MAX_ACTIVE_MEDIA_JOBS_PER_USER = 2;
    private static final int MAX_DAILY_MEDIA_JOBS_PER_USER = 10;
    private static final Duration GATEWAY_TIMEOUT = Duration.ofSeconds(10);

    private final CeleryJobRepository celeryJobRepository;
    private final UserRepository userRepository;
    private final WebClient gatewayClient;
    private final String internalApiKey;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public CeleryJobService(
            CeleryJobRepository celeryJobRepository,
            UserRepository userRepository,
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl,
            @Value("${fastapi.internal-api-key:}") String internalApiKey
    ) {
        this.celeryJobRepository = celeryJobRepository;
        this.userRepository = userRepository;
        this.internalApiKey = internalApiKey == null ? "" : internalApiKey.strip();
        WebClient.Builder builder = WebClient.builder().baseUrl(fastApiUrl);
        if (!this.internalApiKey.isBlank()) {
            builder.defaultHeader("X-Internal-Api-Key", this.internalApiKey);
        }
        this.gatewayClient = builder.build();
    }

    @Transactional
    public CeleryJob submitJob(String taskType, Map<String, Object> payload, Long requestedBy) {
        if (!ALLOWED_TASK_TYPES.contains(taskType)) {
            throw new IllegalArgumentException("지원하지 않는 작업 유형: " + taskType);
        }

        if ("KPOP_OUTFIT_ANALYSIS".equals(taskType)) {
            String idempotencyKey = text(payload.get("idempotencyKey"));
            if (idempotencyKey != null) {
                CeleryJob existing = celeryJobRepository
                        .findByRequestedByAndIdempotencyKey(requestedBy, idempotencyKey)
                        .orElse(null);
                if (existing != null) {
                    return existing;
                }
            }
        }

        enforceMediaSubmissionLimit(taskType, requestedBy);

        try {
            Map<String, Object> response = gatewayClient.post()
                    .uri("/jobs/celery/{taskType}", gatewayTaskType(taskType))
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block(GATEWAY_TIMEOUT);

            String taskId = response != null ? text(response.get("task_id")) : null;
            if (taskId == null) {
                return saveFailedJob(taskType, requestedBy, "FastAPI가 task_id를 반환하지 않았습니다.", payload);
            }

            CeleryJob.CeleryJobBuilder builder = CeleryJob.builder()
                    .celeryTaskId(taskId)
                    .taskType(taskType)
                    .status("QUEUED")
                    .progressStep("QUEUED")
                    .progressPct(5)
                    .requestedBy(requestedBy);
            if ("KPOP_OUTFIT_ANALYSIS".equals(taskType)) {
                builder.sourceObjectKey(text(payload.get("sourceKey")))
                        .sourceContentType(text(payload.get("contentType")))
                        .consentScope(text(payload.get("consentScope")))
                        .consentedAt(LocalDateTime.now())
                        .expiresAt(LocalDateTime.now().plusHours(24))
                        .idempotencyKey(text(payload.get("idempotencyKey")));
            }
            return celeryJobRepository.save(builder.build());
        } catch (Exception e) {
            log.error("Celery 작업 제출 실패. taskType={}, error={}", taskType, e.getMessage());
            return saveFailedJob(taskType, requestedBy, "Celery 작업 제출 실패: " + e.getMessage(), payload);
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
                    .header("X-Celery-Job-Token", celeryJobToken(job.getCeleryTaskId()))
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block(GATEWAY_TIMEOUT);

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

    @Transactional(readOnly = true)
    public CeleryJob getOwnedJobStatus(String celeryTaskId, Long requestedBy) {
        if (requestedBy == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        return celeryJobRepository.findByCeleryTaskIdAndRequestedBy(celeryTaskId, requestedBy)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Celery job was not found."
                ));
    }

    @Transactional(readOnly = true)
    public CeleryJob getOwnedJobStatus(Long jobId, Long requestedBy) {
        if (requestedBy == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        return celeryJobRepository.findByIdAndRequestedBy(jobId, requestedBy)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "K-POP analysis job was not found."
                ));
    }

    @Transactional
    public CeleryJob saveJob(CeleryJob job) {
        return celeryJobRepository.save(job);
    }

    public List<CeleryJob> getActiveJobs() {
        return celeryJobRepository.findByStatusNotInAndNotifSentFalse(TERMINAL_STATUSES);
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
                    job.setResultJson(toJson(result));
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

    private CeleryJob saveFailedJob(
            String taskType,
            Long requestedBy,
            String errorMessage,
            Map<String, Object> payload
    ) {
        CeleryJob.CeleryJobBuilder builder = CeleryJob.builder()
                .taskType(taskType)
                .status("FAILURE")
                .requestedBy(requestedBy)
                .errorMessage(errorMessage);
        if ("KPOP_OUTFIT_ANALYSIS".equals(taskType)) {
            builder.sourceObjectKey(text(payload.get("sourceKey")))
                    .sourceContentType(text(payload.get("contentType")))
                    .consentScope(text(payload.get("consentScope")))
                    .consentedAt(LocalDateTime.now())
                    .expiresAt(LocalDateTime.now().plusHours(24))
                    .idempotencyKey(text(payload.get("idempotencyKey")));
        }
        return celeryJobRepository.save(builder.build());
    }

    private String gatewayTaskType(String taskType) {
        return "KPOP_OUTFIT_ANALYSIS".equals(taskType) ? "kpop-outfit-analysis" : taskType;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Unable to serialize Celery result JSON: {}", e.getMessage());
            return String.valueOf(value);
        }
    }

    private void enforceMediaSubmissionLimit(String taskType, Long requestedBy) {
        if (!MEDIA_TASK_TYPES.contains(taskType)) {
            return;
        }
        if (requestedBy == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }

        userRepository.findByUserSqnoForCeleryLimit(requestedBy)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user was not found."
                ));

        long activeJobs = celeryJobRepository.countByRequestedByAndTaskTypeInAndStatusNotIn(
                requestedBy,
                MEDIA_TASK_TYPES,
                TERMINAL_STATUSES
        );
        if (activeJobs >= MAX_ACTIVE_MEDIA_JOBS_PER_USER) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "At most 2 media jobs may be active at the same time."
            );
        }

        long dailyJobs = celeryJobRepository.countByRequestedByAndTaskTypeInAndCreatedAtGreaterThanEqual(
                requestedBy,
                MEDIA_TASK_TYPES,
                LocalDate.now().atStartOfDay()
        );
        if (dailyJobs >= MAX_DAILY_MEDIA_JOBS_PER_USER) {
            throw new ResponseStatusException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "The daily media job limit of 10 has been reached."
            );
        }
    }

    private String celeryJobToken(String taskId) {
        if (internalApiKey.isBlank()) {
            throw new IllegalStateException("fastapi.internal-api-key is not configured");
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(internalApiKey.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(taskId.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Unable to sign Celery job token", e);
        }
    }

    private String text(Object value) {
        if (value == null) return null;
        String t = String.valueOf(value).trim();
        return t.isEmpty() || "null".equalsIgnoreCase(t) ? null : t;
    }
}
