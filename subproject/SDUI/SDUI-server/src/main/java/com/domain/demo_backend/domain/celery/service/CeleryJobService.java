package com.domain.demo_backend.domain.celery.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.domain.CeleryJobRepository;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.exception.CodedResponseStatusException;
import com.domain.demo_backend.global.exception.KpopRateLimitException;
import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Objects;
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
    private static final Duration GATEWAY_TIMEOUT = Duration.ofSeconds(10);
    private static final String KPOP_TASK_TYPE = "KPOP_OUTFIT_ANALYSIS";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final String KPOP_REDIS_PREFIX = "kpop:v1:";

    private final CeleryJobRepository celeryJobRepository;
    private final UserRepository userRepository;
    private final WebClient gatewayClient;
    private final String internalApiKey;
    private final StringRedisTemplate redis;
    private final BackendOperationalTelemetry telemetry;
    private final int maxActiveMediaJobs;
    private final int maxDailyMediaJobs;
    private final int analysisWindowCapacity;
    private final Duration analysisWindow;
    private final long activeRetrySeconds;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    public CeleryJobService(
            CeleryJobRepository celeryJobRepository,
            UserRepository userRepository,
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl,
            @Value("${fastapi.internal-api-key:}") String internalApiKey,
            StringRedisTemplate redis,
            BackendOperationalTelemetry telemetry,
            @Value("${kpop.analysis.rate.max-active:2}") int maxActiveMediaJobs,
            @Value("${kpop.analysis.rate.max-daily:10}") int maxDailyMediaJobs,
            @Value("${kpop.analysis.rate.window-capacity:3}") int analysisWindowCapacity,
            @Value("${kpop.analysis.rate.window-seconds:600}") long analysisWindowSeconds,
            @Value("${kpop.analysis.rate.active-retry-seconds:60}") long activeRetrySeconds
    ) {
        this.celeryJobRepository = celeryJobRepository;
        this.userRepository = userRepository;
        this.internalApiKey = internalApiKey == null ? "" : internalApiKey.strip();
        this.redis = redis;
        this.telemetry = telemetry;
        this.maxActiveMediaJobs = Math.max(1, maxActiveMediaJobs);
        this.maxDailyMediaJobs = Math.max(this.maxActiveMediaJobs, maxDailyMediaJobs);
        this.analysisWindowCapacity = Math.max(1, analysisWindowCapacity);
        this.analysisWindow = Duration.ofSeconds(Math.max(60, analysisWindowSeconds));
        this.activeRetrySeconds = Math.max(1, activeRetrySeconds);
        WebClient.Builder builder = WebClient.builder().baseUrl(fastApiUrl);
        if (!this.internalApiKey.isBlank()) {
            builder.defaultHeader("X-Internal-Api-Key", this.internalApiKey);
        }
        this.gatewayClient = builder.build();
    }

    public CeleryJobService(
            CeleryJobRepository celeryJobRepository,
            UserRepository userRepository,
            String fastApiUrl,
            String internalApiKey
    ) {
        this(celeryJobRepository, userRepository, fastApiUrl, internalApiKey,
                null, BackendOperationalTelemetry.noop(), 2, 10, 3, 600, 60);
    }

    @Transactional
    public CeleryJob submitJob(String taskType, Map<String, Object> payload, Long requestedBy) {
        if (!ALLOWED_TASK_TYPES.contains(taskType)) {
            throw new IllegalArgumentException("지원하지 않는 작업 유형: " + taskType);
        }

        String requestFingerprint = null;
        if (KPOP_TASK_TYPE.equals(taskType)) {
            Optional<CeleryJob> existing = findReusableKpopJob(payload, requestedBy);
            if (existing.isPresent()) return existing.get();
            lockSubmissionUser(requestedBy);
            existing = findReusableKpopJob(payload, requestedBy);
            if (existing.isPresent()) return existing.get();
            enforceMediaSubmissionCounts(taskType, requestedBy);
            enforceAnalysisWindowLimit(requestedBy, Instant.now());
            requestFingerprint = requestFingerprint(payload);
        } else {
            enforceMediaSubmissionLimit(taskType, requestedBy);
        }

        try {
            Map<String, Object> response = gatewayClient.post()
                    .uri("/jobs/celery/{taskType}", gatewayTaskType(taskType))
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block(GATEWAY_TIMEOUT);

            String taskId = response != null ? text(response.get("task_id")) : null;
            if (taskId == null) {
                return saveFailedJob(taskType, requestedBy,
                        "The analysis gateway returned an invalid response.", payload, requestFingerprint);
            }

            CeleryJob.CeleryJobBuilder builder = CeleryJob.builder()
                    .celeryTaskId(taskId)
                    .taskType(taskType)
                    .status("QUEUED")
                    .progressStep("QUEUED")
                    .progressPct(5)
                    .requestedBy(requestedBy);
            if (KPOP_TASK_TYPE.equals(taskType)) {
                builder.sourceObjectKey(text(payload.get("sourceKey")))
                        .sourceContentType(text(payload.get("contentType")))
                        .consentScope(text(payload.get("consentScope")))
                        .consentedAt(LocalDateTime.now())
                        .expiresAt(LocalDateTime.now().plusHours(24))
                        .idempotencyKey(text(payload.get("idempotencyKey")))
                        .requestFingerprint(requestFingerprint);
            }
            CeleryJob saved = celeryJobRepository.save(builder.build());
            cacheIdempotency(saved);
            telemetry.record("kpop_analysis_submit", "accepted", taskType, Set.of());
            return saved;
        } catch (Exception e) {
            log.error("audit_event=celery_submit_failed taskType={} requestedBy={}", taskType, requestedBy);
            telemetry.record("kpop_analysis_submit", "gateway_failure", taskType, Set.of());
            return saveFailedJob(taskType, requestedBy,
                    "The analysis gateway could not accept the job.", payload, requestFingerprint);
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

    @Transactional(readOnly = true)
    public Optional<CeleryJob> findReusableKpopJob(Map<String, Object> payload, Long requestedBy) {
        if (requestedBy == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
        String idempotencyKey = text(payload.get("idempotencyKey"));
        if (idempotencyKey == null) return Optional.empty();
        String fingerprint = requestFingerprint(payload);
        String redisKey = idempotencyRedisKey(requestedBy, idempotencyKey);
        if (redis != null) {
            try {
                String cached = redis.opsForValue().get(redisKey);
                if (cached != null) {
                    String[] parts = cached.split(":", 2);
                    if (parts.length == 2) {
                        Optional<CeleryJob> cachedJob = celeryJobRepository.findByIdAndRequestedBy(
                                Long.parseLong(parts[0]), requestedBy);
                        if (cachedJob.isPresent()
                                && idempotencyKey.equals(cachedJob.get().getIdempotencyKey())) {
                            return validateIdempotentPayload(cachedJob.get(), fingerprint);
                        }
                    }
                }
            } catch (RuntimeException redisFailure) {
                telemetry.record("kpop_idempotency", "redis_fallback", KPOP_TASK_TYPE, Set.of());
            }
        }
        Optional<CeleryJob> existing = celeryJobRepository
                .findByRequestedByAndIdempotencyKey(requestedBy, idempotencyKey);
        if (existing.isEmpty()) return Optional.empty();
        Optional<CeleryJob> validated = validateIdempotentPayload(existing.get(), fingerprint);
        cacheIdempotency(existing.get());
        return validated;
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
            Map<String, Object> payload,
            String requestFingerprint
    ) {
        CeleryJob.CeleryJobBuilder builder = CeleryJob.builder()
                .taskType(taskType)
                .status("FAILURE")
                .requestedBy(requestedBy)
                .errorMessage(errorMessage);
        if (KPOP_TASK_TYPE.equals(taskType)) {
            builder.sourceObjectKey(text(payload.get("sourceKey")))
                    .sourceContentType(text(payload.get("contentType")))
                    .consentScope(text(payload.get("consentScope")))
                    .consentedAt(LocalDateTime.now())
                    .expiresAt(LocalDateTime.now().plusHours(24))
                    .idempotencyKey(text(payload.get("idempotencyKey")))
                    .requestFingerprint(requestFingerprint);
        }
        CeleryJob saved = celeryJobRepository.save(builder.build());
        cacheIdempotency(saved);
        return saved;
    }

    private Optional<CeleryJob> validateIdempotentPayload(CeleryJob existing, String fingerprint) {
        String existingFingerprint = existing.getRequestFingerprint();
        if (existingFingerprint == null && KPOP_TASK_TYPE.equals(existing.getTaskType())) {
            existingFingerprint = requestFingerprint(Map.of(
                    "sourceKey", Objects.toString(existing.getSourceObjectKey(), ""),
                    "contentType", Objects.toString(existing.getSourceContentType(), ""),
                    "consentScope", Objects.toString(existing.getConsentScope(), "")
            ));
        }
        boolean same = KPOP_TASK_TYPE.equals(existing.getTaskType())
                && existingFingerprint != null
                && MessageDigest.isEqual(
                        existingFingerprint.getBytes(StandardCharsets.UTF_8),
                        fingerprint.getBytes(StandardCharsets.UTF_8));
        if (!same) {
            telemetry.record("kpop_idempotency", "conflict", KPOP_TASK_TYPE, Set.of());
            throw new CodedResponseStatusException(
                    HttpStatus.CONFLICT,
                    "IDEMPOTENCY_CONFLICT",
                    "The idempotency key was already used for a different analysis payload.");
        }
        telemetry.record("kpop_idempotency", "reused", KPOP_TASK_TYPE, Set.of());
        return Optional.of(existing);
    }

    private void cacheIdempotency(CeleryJob job) {
        if (redis == null || job == null || job.getId() == null
                || job.getRequestedBy() == null || job.getIdempotencyKey() == null
                || job.getRequestFingerprint() == null) return;
        try {
            redis.opsForValue().set(
                    idempotencyRedisKey(job.getRequestedBy(), job.getIdempotencyKey()),
                    job.getId() + ":" + job.getRequestFingerprint(),
                    Duration.ofHours(24));
        } catch (RuntimeException redisFailure) {
            telemetry.record("kpop_idempotency", "cache_write_fallback", KPOP_TASK_TYPE, Set.of());
        }
    }

    private String requestFingerprint(Map<String, Object> payload) {
        return sha256(String.join("\n",
                Objects.toString(text(payload.get("sourceKey")), ""),
                Objects.toString(text(payload.get("contentType")), ""),
                Objects.toString(text(payload.get("consentScope")), "")));
    }

    private String idempotencyRedisKey(Long requestedBy, String idempotencyKey) {
        return KPOP_REDIS_PREFIX + "idempotency:" + sha256(requestedBy + "\n" + idempotencyKey);
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
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
        lockSubmissionUser(requestedBy);
        enforceMediaSubmissionCounts(taskType, requestedBy);
    }

    private void lockSubmissionUser(Long requestedBy) {
        if (requestedBy == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }

        userRepository.findByUserSqnoForCeleryLimit(requestedBy)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user was not found."
                ));
    }

    private void enforceMediaSubmissionCounts(String taskType, Long requestedBy) {
        long activeJobs = celeryJobRepository.countByRequestedByAndTaskTypeInAndStatusNotIn(
                requestedBy,
                MEDIA_TASK_TYPES,
                TERMINAL_STATUSES
        );
        if (activeJobs >= maxActiveMediaJobs) {
            telemetry.record("kpop_analysis_rate", "active_limited", taskType, Set.of());
            throw new KpopRateLimitException(
                    "KPOP_ANALYSIS_ACTIVE_LIMIT",
                    "Too many media jobs are active.",
                    activeRetrySeconds);
        }

        long dailyJobs = celeryJobRepository.countByRequestedByAndTaskTypeInAndCreatedAtGreaterThanEqual(
                requestedBy,
                MEDIA_TASK_TYPES,
                LocalDate.now(KST).atStartOfDay()
        );
        if (dailyJobs >= maxDailyMediaJobs) {
            telemetry.record("kpop_analysis_rate", "daily_limited", taskType, Set.of());
            throw new KpopRateLimitException(
                    "KPOP_ANALYSIS_DAILY_LIMIT",
                    "The daily media job limit has been reached.",
                    dailyRetryAfter(Instant.now()));
        }
    }

    private void enforceAnalysisWindowLimit(Long requestedBy, Instant now) {
        long retryAfter = shortWindowRetryAfter(now);
        long windowSeconds = analysisWindow.getSeconds();
        String key = KPOP_REDIS_PREFIX + "rate:analysis:" + requestedBy + ":"
                + now.getEpochSecond() / windowSeconds;
        if (redis != null) {
            try {
                Long count = redis.opsForValue().increment(key);
                if (count != null && count == 1L) {
                    redis.expire(key, Duration.ofSeconds(retryAfter + 5));
                }
                if (count != null && count > analysisWindowCapacity) {
                    telemetry.record("kpop_analysis_rate", "window_limited", KPOP_TASK_TYPE, Set.of());
                    throw new KpopRateLimitException(
                            "KPOP_ANALYSIS_WINDOW_LIMIT",
                            "Too many analysis submissions were made in a short period.",
                            retryAfter);
                }
            } catch (KpopRateLimitException limited) {
                throw limited;
            } catch (RuntimeException redisFailure) {
                telemetry.record("kpop_analysis_rate", "redis_fallback", KPOP_TASK_TYPE, Set.of());
            }
        }
        LocalDateTime windowStart = LocalDateTime.ofInstant(now.minus(analysisWindow), KST);
        long persisted = celeryJobRepository.countByRequestedByAndTaskTypeAndCreatedAtGreaterThanEqual(
                requestedBy, KPOP_TASK_TYPE, windowStart);
        if (persisted >= analysisWindowCapacity) {
            telemetry.record("kpop_analysis_rate", "window_db_limited", KPOP_TASK_TYPE, Set.of());
            throw new KpopRateLimitException(
                    "KPOP_ANALYSIS_WINDOW_LIMIT",
                    "Too many analysis submissions were made in a short period.",
                    retryAfter);
        }
    }

    long shortWindowRetryAfter(Instant now) {
        long windowSeconds = analysisWindow.getSeconds();
        return Math.max(1, windowSeconds - Math.floorMod(now.getEpochSecond(), windowSeconds));
    }

    long dailyRetryAfter(Instant now) {
        ZonedDateTime current = now.atZone(KST);
        ZonedDateTime nextMidnight = current.toLocalDate().plusDays(1).atStartOfDay(KST);
        return Math.max(1, Duration.between(current, nextMidnight).getSeconds());
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
