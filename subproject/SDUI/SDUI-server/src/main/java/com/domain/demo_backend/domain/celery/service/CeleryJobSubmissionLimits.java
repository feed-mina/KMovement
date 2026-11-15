package com.domain.demo_backend.domain.celery.service;

import com.domain.demo_backend.domain.celery.domain.CeleryJobRepository;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.exception.KpopRateLimitException;
import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Set;

/**
 * 미디어·K-POP 분석 작업 제출 한도(동시 실행, 하루, 짧은 시간 창)를 검사한다.
 * CeleryJobService 에서 떼어 낸 부분이며 동작은 같다.
 */
class CeleryJobSubmissionLimits {

    static final Set<String> MEDIA_TASK_TYPES = Set.of("tts", "video", "KPOP_OUTFIT_ANALYSIS");
    static final Set<String> TERMINAL_STATUSES = Set.of(
            "SUCCESS", "FAILURE", "REVOKED", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"
    );
    private static final String KPOP_TASK_TYPE = "KPOP_OUTFIT_ANALYSIS";
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final String KPOP_REDIS_PREFIX = "kpop:v1:";

    private final CeleryJobRepository celeryJobRepository;
    private final UserRepository userRepository;
    private final StringRedisTemplate redis;
    private final BackendOperationalTelemetry telemetry;
    private final int maxActiveMediaJobs;
    private final int maxDailyMediaJobs;
    private final int analysisWindowCapacity;
    private final Duration analysisWindow;
    private final long activeRetrySeconds;

    CeleryJobSubmissionLimits(
            CeleryJobRepository celeryJobRepository,
            UserRepository userRepository,
            StringRedisTemplate redis,
            BackendOperationalTelemetry telemetry,
            int maxActiveMediaJobs,
            int maxDailyMediaJobs,
            int analysisWindowCapacity,
            long analysisWindowSeconds,
            long activeRetrySeconds
    ) {
        this.celeryJobRepository = celeryJobRepository;
        this.userRepository = userRepository;
        this.redis = redis;
        this.telemetry = telemetry;
        this.maxActiveMediaJobs = Math.max(1, maxActiveMediaJobs);
        this.maxDailyMediaJobs = Math.max(this.maxActiveMediaJobs, maxDailyMediaJobs);
        this.analysisWindowCapacity = Math.max(1, analysisWindowCapacity);
        this.analysisWindow = Duration.ofSeconds(Math.max(60, analysisWindowSeconds));
        this.activeRetrySeconds = Math.max(1, activeRetrySeconds);
    }

    void enforceMediaSubmissionLimit(String taskType, Long requestedBy) {
        if (!MEDIA_TASK_TYPES.contains(taskType)) {
            return;
        }
        lockSubmissionUser(requestedBy);
        enforceMediaSubmissionCounts(taskType, requestedBy);
    }

    void lockSubmissionUser(Long requestedBy) {
        if (requestedBy == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }

        userRepository.findByUserSqnoForCeleryLimit(requestedBy)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED,
                        "Authenticated user was not found."
                ));
    }

    void enforceMediaSubmissionCounts(String taskType, Long requestedBy) {
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

    void enforceAnalysisWindowLimit(Long requestedBy, Instant now) {
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
}
