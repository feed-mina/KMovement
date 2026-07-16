package com.domain.demo_backend.domain.celery.service;

import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.domain.CeleryJobRepository;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
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

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.submitJob("video", Map.of("input", "value"), 7L)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
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

        ResponseStatusException error = assertThrows(
                ResponseStatusException.class,
                () -> service.submitJob("tts", Map.of("text", "hello"), 7L)
        );

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatusCode());
        verify(userRepository).findByUserSqnoForCeleryLimit(7L);
        verify(repository, never()).save(any(CeleryJob.class));
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
                Set.of("SUCCESS", "FAILURE", "REVOKED")
        );
    }

    private static String hmacSha256(String secret, String taskId) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(taskId.getBytes(StandardCharsets.UTF_8)));
    }
}
