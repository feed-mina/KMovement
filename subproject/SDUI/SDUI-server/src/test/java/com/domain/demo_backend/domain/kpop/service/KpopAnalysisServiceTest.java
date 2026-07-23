package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.domain.ai.service.S3Service;
import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.service.CeleryJobService;
import com.domain.demo_backend.global.exception.CodedResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KpopAnalysisServiceTest {

    private final S3Service s3Service = mock(S3Service.class);
    private final CeleryJobService celeryJobService = mock(CeleryJobService.class);
    private final KpopProductService productService = mock(KpopProductService.class);
    private final KpopAnalysisService service = new KpopAnalysisService(
            s3Service,
            celeryJobService,
            new ObjectMapper(),
            productService
    );

    @Test
    void createsUserScopedPresignedUpload() {
        when(s3Service.createKpopAnalysisUpload(42L, "image/webp", 1024L)).thenReturn(
                new S3Service.KpopAnalysisUpload(
                        "kpop-analysis/42/source.webp",
                        "https://upload.example/source.webp",
                        Map.of("Content-Type", "image/webp"),
                        Instant.parse("2026-07-23T01:00:00Z")
                )
        );

        Map<String, Object> response = service.createUpload(Map.of(
                "contentType", "image/webp",
                "fileSize", 1024
        ), 42L);

        assertThat(response)
                .containsEntry("sourceKey", "kpop-analysis/42/source.webp")
                .containsEntry("uploadUrl", "https://upload.example/source.webp");
        verify(s3Service).createKpopAnalysisUpload(42L, "image/webp", 1024L);
    }

    @Test
    void submitRequiresExplicitConsentBeforeTouchingStorage() {
        assertThatThrownBy(() -> service.submit(Map.of(
                "consented", false,
                "sourceKey", "kpop-analysis/42/source.webp",
                "contentType", "image/webp",
                "consentScope", "user-owned-image-analysis",
                "idempotencyKey", "request-1"
        ), 42L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);

        verify(s3Service, never()).validateKpopAnalysisObject(
                "kpop-analysis/42/source.webp", 42L, "image/webp"
        );
        verify(celeryJobService, never()).submitJob(eq("KPOP_OUTFIT_ANALYSIS"), anyMap(), eq(42L));
    }

    @Test
    void submitValidatesOwnerAndReturnsDatabaseAndCeleryIds() {
        CeleryJob job = CeleryJob.builder()
                .id(91L)
                .celeryTaskId("task-91")
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .status("QUEUED")
                .progressStep("QUEUED")
                .progressPct(5)
                .requestedBy(42L)
                .sourceObjectKey("kpop-analysis/42/source.webp")
                .build();
        when(celeryJobService.submitJob(eq("KPOP_OUTFIT_ANALYSIS"), anyMap(), eq(42L)))
                .thenReturn(job);
        when(celeryJobService.findReusableKpopJob(anyMap(), eq(42L)))
                .thenReturn(Optional.empty());

        Map<String, Object> response = service.submit(Map.of(
                "consented", true,
                "sourceKey", "kpop-analysis/42/source.webp",
                "contentType", "image/webp",
                "consentScope", "user-owned-image-analysis",
                "idempotencyKey", "request-1"
        ), 42L);

        verify(s3Service).validateKpopAnalysisObject(
                "kpop-analysis/42/source.webp", 42L, "image/webp"
        );
        assertThat(response)
                .containsEntry("jobId", 91L)
                .containsEntry("taskId", "task-91")
                .containsEntry("status", "QUEUED")
                .containsEntry("idempotentReplay", false);
    }

    @Test
    void idempotentReplayReturnsExistingJobBeforeTouchingStorage() {
        CeleryJob existing = CeleryJob.builder()
                .id(91L)
                .celeryTaskId("task-91")
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .status("QUEUED")
                .progressStep("QUEUED")
                .progressPct(5)
                .requestedBy(42L)
                .sourceObjectKey("kpop-analysis/42/source.webp")
                .sourceContentType("image/webp")
                .consentScope("user-owned-image-analysis")
                .idempotencyKey("request-1")
                .build();
        when(celeryJobService.findReusableKpopJob(anyMap(), eq(42L)))
                .thenReturn(Optional.of(existing));

        Map<String, Object> response = service.submit(validSubmission(), 42L);

        assertThat(response)
                .containsEntry("jobId", 91L)
                .containsEntry("taskId", "task-91")
                .containsEntry("status", "QUEUED")
                .containsEntry("idempotentReplay", true);
        verify(s3Service, never()).validateKpopAnalysisObject(
                "kpop-analysis/42/source.webp", 42L, "image/webp"
        );
        verify(celeryJobService, never()).submitJob(eq("KPOP_OUTFIT_ANALYSIS"), anyMap(), eq(42L));
    }

    @Test
    void idempotencyConflictIsReturnedBeforeStorageOrDuplicateSubmission() {
        when(celeryJobService.findReusableKpopJob(anyMap(), eq(42L)))
                .thenThrow(new CodedResponseStatusException(
                        HttpStatus.CONFLICT,
                        "IDEMPOTENCY_CONFLICT",
                        "The idempotency key was already used for a different analysis payload."
                ));

        assertThatThrownBy(() -> service.submit(validSubmission(), 42L))
                .isInstanceOfSatisfying(CodedResponseStatusException.class, error -> {
                    assertThat(error.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(error.getCode()).isEqualTo("IDEMPOTENCY_CONFLICT");
                });

        verify(s3Service, never()).validateKpopAnalysisObject(
                "kpop-analysis/42/source.webp", 42L, "image/webp"
        );
        verify(celeryJobService, never()).submitJob(eq("KPOP_OUTFIT_ANALYSIS"), anyMap(), eq(42L));
    }

    @Test
    void snapshotNormalizesCelerySuccessAndParsesEvidenceShell() {
        CeleryJob job = CeleryJob.builder()
                .id(91L)
                .celeryTaskId("task-91")
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .status("SUCCESS")
                .requestedBy(42L)
                .resultJson("{\"grade\":\"INSUFFICIENT_EVIDENCE\",\"confidence\":0,\"evidence\":[],\"candidates\":[]}")
                .build();
        when(celeryJobService.getOwnedJobStatus(91L, 42L)).thenReturn(job);
        when(celeryJobService.refreshJob(job)).thenReturn(job);
        when(productService.sanitizeAnalysisResult(eq(91L), anyMap())).thenAnswer(invocation -> invocation.getArgument(1));

        Map<String, Object> response = service.snapshot(91L, 42L, true);

        assertThat(response).containsEntry("status", "SUCCEEDED");
        assertThat(response.get("result")).isInstanceOf(Map.class);
        assertThat(((Map<?, ?>) response.get("result")).get("grade"))
                .isEqualTo("INSUFFICIENT_EVIDENCE");
        verify(celeryJobService).getOwnedJobStatus(91L, 42L);
    }

    @Test
    void deleteSourceDeletesStorageAndPersistsAuditTimestamp() {
        CeleryJob job = CeleryJob.builder()
                .id(91L)
                .taskType("KPOP_OUTFIT_ANALYSIS")
                .status("SUCCESS")
                .requestedBy(42L)
                .sourceObjectKey("kpop-analysis/42/source.webp")
                .build();
        when(celeryJobService.getOwnedJobStatus(91L, 42L)).thenReturn(job);
        when(celeryJobService.saveJob(job)).thenReturn(job);

        Map<String, Object> response = service.deleteSource(91L, 42L);

        verify(s3Service).deleteKpopAnalysisObject("kpop-analysis/42/source.webp", 42L);
        verify(celeryJobService).saveJob(job);
        assertThat(job.getSourceDeletedAt()).isBeforeOrEqualTo(LocalDateTime.now());
        assertThat(response).containsEntry("sourceDeleted", true);
    }

    private Map<String, Object> validSubmission() {
        return Map.of(
                "consented", true,
                "sourceKey", "kpop-analysis/42/source.webp",
                "contentType", "image/webp",
                "consentScope", "user-owned-image-analysis",
                "idempotencyKey", "request-1"
        );
    }
}
