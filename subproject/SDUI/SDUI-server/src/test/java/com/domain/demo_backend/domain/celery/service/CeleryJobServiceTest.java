package com.domain.demo_backend.domain.celery.service;

import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.domain.CeleryJobRepository;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.exception.CodedResponseStatusException;
import com.domain.demo_backend.global.exception.KpopRateLimitException;
import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;


class CeleryJobServiceTest {

    private static final String INTERNAL_KEY = "unit-test-internal-key";
    private static final String TASK_ID = "85a9f8bb-e57b-4b8d-a1ca-5a1f34cb764a";

    @Test
    void ownedLookupDoesNotFallBackToAnotherUsersTask() {
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        when(repository.findByCeleryTaskIdAndRequestedBy(TASK_ID, 7L))
                .thenReturn(Optional.empty());
        CeleryJobService service = new CeleryJobService(
                repository,
                mock(UserRepository.class),
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.getOwnedJobStatus(TASK_ID, 7L)
        );

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        verify(repository).findByCeleryTaskIdAndRequestedBy(TASK_ID, 7L);
        verify(repository, never()).findByCeleryTaskId(any());
    }

    @Test
    void refreshSendsInternalKeyAndTaskScopedHmac() throws Exception {
        AtomicReference<String> internalHeader = new AtomicReference<>();
        AtomicReference<String> jobHeader = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/jobs/celery/" + TASK_ID, exchange -> {
            internalHeader.set(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            jobHeader.set(exchange.getRequestHeaders().getFirst("X-Celery-Job-Token"));
            byte[] body = "{\"status\":\"SUCCESS\",\"result\":{\"result_url\":\"https://example.com/result.mp4\"}}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        try {
            CeleryJobRepository repository = mock(CeleryJobRepository.class);
            when(repository.save(any(CeleryJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
            CeleryJobService service = new CeleryJobService(
                    repository,
                    mock(UserRepository.class),
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    INTERNAL_KEY
            );
            CeleryJob job = CeleryJob.builder()
                    .celeryTaskId(TASK_ID)
                    .taskType("video")
                    .status("QUEUED")
                    .requestedBy(7L)
                    .build();

            CeleryJob refreshed = service.refreshJob(job);

            assertEquals("SUCCESS", refreshed.getStatus());
            assertEquals(INTERNAL_KEY, internalHeader.get());
            assertEquals(hmacSha256(INTERNAL_KEY, TASK_ID), jobHeader.get());
        } finally {
            server.stop(0);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"tts", "video"})
    void mediaTaskTypesCanBeSubmitted(String taskType) throws Exception {
        AtomicReference<String> requestPath = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/jobs/celery/", exchange -> {
            requestPath.set(exchange.getRequestURI().getPath());
            byte[] body = ("{\"task_id\":\"" + TASK_ID + "\"}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        try {
            CeleryJobRepository repository = mock(CeleryJobRepository.class);
            when(repository.save(any(CeleryJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
            UserRepository userRepository = mock(UserRepository.class);
            when(userRepository.findByUserSqnoForCeleryLimit(7L))
                    .thenReturn(Optional.of(User.builder().userSqno(7L).build()));
            CeleryJobService service = new CeleryJobService(
                    repository,
                    userRepository,
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    INTERNAL_KEY
            );

            CeleryJob submitted = service.submitJob(taskType, Map.of("input", "value"), 7L);

            assertEquals("/jobs/celery/" + taskType, requestPath.get());
            assertEquals(TASK_ID, submitted.getCeleryTaskId());
            assertEquals(7L, submitted.getRequestedBy());
            assertTrue(!"FAILURE".equals(submitted.getStatus()));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void numericOwnedLookupDoesNotLeakAnotherUsersJob() {
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        when(repository.findByIdAndRequestedBy(91L, 7L)).thenReturn(Optional.empty());
        CeleryJobService service = new CeleryJobService(
                repository,
                mock(UserRepository.class),
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.getOwnedJobStatus(91L, 7L)
        );

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
        verify(repository).findByIdAndRequestedBy(91L, 7L);
    }

    @Test
    void kpopTaskUsesGatewayAliasAndPersistsConsentAudit() throws Exception {
        AtomicReference<String> requestPath = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/jobs/celery/", exchange -> {
            requestPath.set(exchange.getRequestURI().getPath());
            byte[] body = ("{\"task_id\":\"" + TASK_ID + "\"}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        server.start();

        try {
            CeleryJobRepository repository = mock(CeleryJobRepository.class);
            when(repository.save(any(CeleryJob.class))).thenAnswer(invocation -> invocation.getArgument(0));
            UserRepository userRepository = mock(UserRepository.class);
            when(userRepository.findByUserSqnoForCeleryLimit(7L))
                    .thenReturn(Optional.of(User.builder().userSqno(7L).build()));
            CeleryJobService service = new CeleryJobService(
                    repository,
                    userRepository,
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    INTERNAL_KEY
            );

            CeleryJob submitted = service.submitJob("KPOP_OUTFIT_ANALYSIS", Map.of(
                    "sourceKey", "kpop-analysis/7/image.webp",
                    "contentType", "image/webp",
                    "consentScope", "user-owned-image-analysis",
                    "idempotencyKey", "upload-7-1"
            ), 7L);

            assertEquals("/jobs/celery/kpop-outfit-analysis", requestPath.get());
            assertEquals("kpop-analysis/7/image.webp", submitted.getSourceObjectKey());
            assertEquals("image/webp", submitted.getSourceContentType());
            assertEquals("user-owned-image-analysis", submitted.getConsentScope());
            assertEquals("upload-7-1", submitted.getIdempotencyKey());
            assertTrue(submitted.getConsentedAt() != null);
            assertTrue(submitted.getExpiresAt() != null);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void kpopIdempotencyKeyReturnsExistingJobWithoutGatewaySubmission() {
        CeleryJob existing = CeleryJob.builder()
                .id(91L)
                .celeryTaskId(TASK_ID)
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .requestedBy(7L)
                .idempotencyKey("upload-7-1")
                .sourceObjectKey("kpop-analysis/7/image.webp")
                .sourceContentType("image/webp")
                .consentScope("user-owned-image-analysis")
                .build();
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        when(repository.findByRequestedByAndIdempotencyKey(7L, "upload-7-1"))
                .thenReturn(Optional.of(existing));
        CeleryJobService service = new CeleryJobService(
                repository,
                mock(UserRepository.class),
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        CeleryJob result = service.submitJob("KPOP_OUTFIT_ANALYSIS", Map.of(
                "sourceKey", "kpop-analysis/7/image.webp",
                "contentType", "image/webp",
                "consentScope", "user-owned-image-analysis",
                "idempotencyKey", "upload-7-1"
        ), 7L);

        assertSame(existing, result);
        verify(repository).findByRequestedByAndIdempotencyKey(7L, "upload-7-1");
        verify(repository, never()).save(any(CeleryJob.class));
        verify(repository, never()).countByRequestedByAndTaskTypeInAndStatusNotIn(
                any(Long.class), anyCollection(), anyCollection()
        );
    }

    @Test
    void kpopIdempotencyKeyRejectsDifferentPayloadWithoutDuplicateWork() {
        CeleryJob existing = CeleryJob.builder()
                .id(91L)
                .celeryTaskId(TASK_ID)
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .requestedBy(7L)
                .idempotencyKey("upload-7-1")
                .sourceObjectKey("kpop-analysis/7/original.webp")
                .sourceContentType("image/webp")
                .consentScope("user-owned-image-analysis")
                .build();
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        when(repository.findByRequestedByAndIdempotencyKey(7L, "upload-7-1"))
                .thenReturn(Optional.of(existing));
        CeleryJobService service = new CeleryJobService(
                repository,
                userRepository,
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        CodedResponseStatusException error = assertThrows(
                CodedResponseStatusException.class,
                () -> service.submitJob("KPOP_OUTFIT_ANALYSIS", Map.of(
                        "sourceKey", "kpop-analysis/7/different.webp",
                        "contentType", "image/webp",
                        "consentScope", "user-owned-image-analysis",
                        "idempotencyKey", "upload-7-1"
                ), 7L)
        );

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        assertEquals("IDEMPOTENCY_CONFLICT", error.getCode());
        verify(repository, never()).save(any(CeleryJob.class));
        verify(userRepository, never()).findByUserSqnoForCeleryLimit(any(Long.class));
    }

    @Test
    void redisIdempotencyFailureFallsBackToUserScopedDatabaseLookup() {
        CeleryJob existing = CeleryJob.builder()
                .id(91L)
                .celeryTaskId(TASK_ID)
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .requestedBy(7L)
                .idempotencyKey("upload-7-1")
                .sourceObjectKey("kpop-analysis/7/image.webp")
                .sourceContentType("image/webp")
                .consentScope("user-owned-image-analysis")
                .build();
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        when(repository.findByRequestedByAndIdempotencyKey(7L, "upload-7-1"))
                .thenReturn(Optional.of(existing));
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> values = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(anyString())).thenThrow(new IllegalStateException("redis unavailable"));
        CeleryJobService service = hardenedService(
                repository, mock(UserRepository.class), redis, 2, 10, 3, 600, 60
        );

        Optional<CeleryJob> result = service.findReusableKpopJob(Map.of(
                "sourceKey", "kpop-analysis/7/image.webp",
                "contentType", "image/webp",
                "consentScope", "user-owned-image-analysis",
                "idempotencyKey", "upload-7-1"
        ), 7L);

        assertTrue(result.isPresent());
        assertSame(existing, result.orElseThrow());
        verify(repository).findByRequestedByAndIdempotencyKey(7L, "upload-7-1");
        verify(repository, never()).findByRequestedByAndIdempotencyKey(eq(8L), anyString());
    }

    @Test
    void ownedLookupIsDatabaseOnly() throws Exception {
        AtomicInteger gatewayRequests = new AtomicInteger();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            gatewayRequests.incrementAndGet();
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });
        server.start();

        try {
            CeleryJob ownedJob = CeleryJob.builder()
                    .celeryTaskId(TASK_ID)
                    .taskType("video")
                    .status("TTS_RUNNING")
                    .requestedBy(7L)
                    .build();
            CeleryJobRepository repository = mock(CeleryJobRepository.class);
            when(repository.findByCeleryTaskIdAndRequestedBy(TASK_ID, 7L))
                    .thenReturn(Optional.of(ownedJob));
            CeleryJobService service = new CeleryJobService(
                    repository,
                    mock(UserRepository.class),
                    "http://127.0.0.1:" + server.getAddress().getPort(),
                    INTERNAL_KEY
            );

            CeleryJob result = service.getOwnedJobStatus(TASK_ID, 7L);

            assertSame(ownedJob, result);
            assertEquals(0, gatewayRequests.get());
            verify(repository).findByCeleryTaskIdAndRequestedBy(TASK_ID, 7L);
        } finally {
            server.stop(0);
        }
    }

    @Test
    void mediaSubmissionRejectsWhenActiveJobLimitIsReached() {
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUserSqnoForCeleryLimit(7L))
                .thenReturn(Optional.of(User.builder().userSqno(7L).build()));
        when(repository.countByRequestedByAndTaskTypeInAndStatusNotIn(
                eq(7L), anyCollection(), anyCollection()
        )).thenReturn(2L);
        CeleryJobService service = new CeleryJobService(
                repository,
                userRepository,
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        KpopRateLimitException error = assertThrows(
                KpopRateLimitException.class,
                () -> service.submitJob("video", Map.of("input", "value"), 7L)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
        assertEquals("KPOP_ANALYSIS_ACTIVE_LIMIT", error.getCode());
        assertEquals(60L, error.getRetryAfterSeconds());
        verify(userRepository).findByUserSqnoForCeleryLimit(7L);
        verify(repository, never()).save(any(CeleryJob.class));
        verify(repository, never()).countByRequestedByAndTaskTypeInAndCreatedAtGreaterThanEqual(
                any(Long.class), anyCollection(), any(LocalDateTime.class)
        );
    }

    @Test
    void mediaSubmissionRejectsWhenDailyJobLimitIsReached() {
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUserSqnoForCeleryLimit(7L))
                .thenReturn(Optional.of(User.builder().userSqno(7L).build()));
        when(repository.countByRequestedByAndTaskTypeInAndCreatedAtGreaterThanEqual(
                eq(7L), anyCollection(), any(LocalDateTime.class)
        )).thenReturn(10L);
        CeleryJobService service = new CeleryJobService(
                repository,
                userRepository,
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        KpopRateLimitException error = assertThrows(
                KpopRateLimitException.class,
                () -> service.submitJob("tts", Map.of("text", "hello"), 7L)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
        assertEquals("KPOP_ANALYSIS_DAILY_LIMIT", error.getCode());
        assertTrue(error.getRetryAfterSeconds() >= 1L);
        assertTrue(error.getRetryAfterSeconds() <= 86_400L);
        verify(userRepository).findByUserSqnoForCeleryLimit(7L);
        verify(repository, never()).save(any(CeleryJob.class));
    }

    @Test
    void kpopAnalysisRejectsShortWindowFromDatabaseWhenRedisIsUnavailable() {
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findByUserSqnoForCeleryLimit(7L))
                .thenReturn(Optional.of(User.builder().userSqno(7L).build()));
        when(repository.findByRequestedByAndIdempotencyKey(7L, "upload-7-4"))
                .thenReturn(Optional.empty());
        when(repository.countByRequestedByAndTaskTypeAndCreatedAtGreaterThanEqual(
                eq(7L), eq("KPOP_OUTFIT_ANALYSIS"), any(LocalDateTime.class)
        )).thenReturn(3L);
        CeleryJobService service = hardenedService(
                repository, userRepository, null, 2, 10, 3, 600, 60
        );

        KpopRateLimitException error = assertThrows(
                KpopRateLimitException.class,
                () -> service.submitJob("KPOP_OUTFIT_ANALYSIS", Map.of(
                        "sourceKey", "kpop-analysis/7/image.webp",
                        "contentType", "image/webp",
                        "consentScope", "user-owned-image-analysis",
                        "idempotencyKey", "upload-7-4"
                ), 7L)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
        assertEquals("KPOP_ANALYSIS_WINDOW_LIMIT", error.getCode());
        assertTrue(error.getRetryAfterSeconds() >= 1L);
        assertTrue(error.getRetryAfterSeconds() <= 600L);
        verify(repository, never()).save(any(CeleryJob.class));
    }

    @Test
    void retryAfterCalculationsRespectFixedWindowAndKstMidnight() {
        CeleryJobService service = hardenedService(
                mock(CeleryJobRepository.class),
                mock(UserRepository.class),
                null,
                2,
                10,
                3,
                600,
                60
        );

        assertEquals(600L, service.shortWindowRetryAfter(Instant.ofEpochSecond(1_200L)));
        assertEquals(599L, service.shortWindowRetryAfter(Instant.ofEpochSecond(1_201L)));
        assertEquals(30L, service.dailyRetryAfter(Instant.parse("2026-07-23T14:59:30Z")));
        assertEquals(86_400L, service.dailyRetryAfter(Instant.parse("2026-07-23T15:00:00Z")));
    }

    @Test
    void activePollingExcludesOnlyTerminalStates() {
        CeleryJob customStateJob = CeleryJob.builder()
                .celeryTaskId(TASK_ID)
                .taskType("video")
                .status("UPLOADING")
                .requestedBy(7L)
                .build();
        CeleryJobRepository repository = mock(CeleryJobRepository.class);
        when(repository.findByStatusNotInAndNotifSentFalse(anyCollection()))
                .thenReturn(List.of(customStateJob));
        CeleryJobService service = new CeleryJobService(
                repository,
                mock(UserRepository.class),
                "http://127.0.0.1:1",
                INTERNAL_KEY
        );

        List<CeleryJob> activeJobs = service.getActiveJobs();

        assertEquals(List.of(customStateJob), activeJobs);
        verify(repository).findByStatusNotInAndNotifSentFalse(
                Set.of("SUCCESS", "FAILURE", "REVOKED", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED")
        );
    }

    private static String hmacSha256(String secret, String taskId) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(taskId.getBytes(StandardCharsets.UTF_8)));
    }

    private static CeleryJobService hardenedService(
            CeleryJobRepository repository,
            UserRepository userRepository,
            StringRedisTemplate redis,
            int maxActive,
            int maxDaily,
            int windowCapacity,
            long windowSeconds,
            long activeRetrySeconds
    ) {
        return new CeleryJobService(
                repository,
                userRepository,
                "http://127.0.0.1:1",
                INTERNAL_KEY,
                redis,
                BackendOperationalTelemetry.noop(),
                maxActive,
                maxDaily,
                windowCapacity,
                windowSeconds,
                activeRetrySeconds
        );
    }
}
