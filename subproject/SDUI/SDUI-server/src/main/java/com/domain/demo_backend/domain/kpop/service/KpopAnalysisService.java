package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.domain.ai.service.S3Service;
import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.service.CeleryJobService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class KpopAnalysisService {

    private static final String TASK_TYPE = "KPOP_OUTFIT_ANALYSIS";
    private static final String CONSENT_SCOPE = "user-owned-image-analysis";
    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED"
    );

    private final S3Service s3Service;
    private final CeleryJobService celeryJobService;
    private final ObjectMapper objectMapper;

    public Map<String, Object> createUpload(Map<String, Object> payload, Long userSqno) {
        String contentType = requiredText(payload, "contentType");
        long fileSize = requiredPositiveLong(payload, "fileSize");
        try {
            S3Service.KpopAnalysisUpload upload = s3Service.createKpopAnalysisUpload(
                    userSqno,
                    contentType,
                    fileSize
            );
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("sourceKey", upload.key());
            response.put("uploadUrl", upload.url());
            response.put("headers", upload.headers());
            response.put("expiresAt", upload.expiresAt());
            return response;
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }
    }

    public Map<String, Object> submit(Map<String, Object> payload, Long userSqno) {
        if (!Boolean.TRUE.equals(payload.get("consented"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload consent is required.");
        }
        String consentScope = requiredText(payload, "consentScope");
        if (!CONSENT_SCOPE.equals(consentScope)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported upload consent scope.");
        }
        String sourceKey = requiredText(payload, "sourceKey");
        String contentType = requiredText(payload, "contentType");
        String idempotencyKey = requiredText(payload, "idempotencyKey");
        if (idempotencyKey.length() > 120) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Idempotency key is too long.");
        }

        try {
            s3Service.validateKpopAnalysisObject(sourceKey, userSqno, contentType);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, e.getMessage());
        }

        CeleryJob job = celeryJobService.submitJob(TASK_TYPE, Map.of(
                "sourceKey", sourceKey,
                "contentType", contentType,
                "consentScope", consentScope,
                "idempotencyKey", idempotencyKey
        ), userSqno);
        return snapshot(job, false);
    }

    public Map<String, Object> snapshot(Long jobId, Long userSqno, boolean refresh) {
        CeleryJob job = celeryJobService.getOwnedJobStatus(jobId, userSqno);
        if (hasExpired(job)) {
            job.setStatus("EXPIRED");
            job.setProgressStep("EXPIRED");
            job = celeryJobService.saveJob(job);
        } else if (refresh) {
            job = celeryJobService.refreshJob(job);
        }
        return snapshot(job, true);
    }

    public Map<String, Object> deleteSource(Long jobId, Long userSqno) {
        CeleryJob job = celeryJobService.getOwnedJobStatus(jobId, userSqno);
        if (job.getSourceDeletedAt() == null) {
            String sourceKey = job.getSourceObjectKey();
            if (sourceKey == null || sourceKey.isBlank()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis source was not found.");
            }
            s3Service.deleteKpopAnalysisObject(sourceKey, userSqno);
            job.setSourceDeletedAt(LocalDateTime.now());
            celeryJobService.saveJob(job);
        }
        return Map.of(
                "jobId", job.getId(),
                "sourceDeleted", true,
                "sourceDeletedAt", job.getSourceDeletedAt()
        );
    }

    public Map<String, Object> createSourceDownload(Long jobId, Long userSqno) {
        CeleryJob job = celeryJobService.getOwnedJobStatus(jobId, userSqno);
        if (job.getSourceObjectKey() == null || job.getSourceDeletedAt() != null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis source was not found.");
        }
        return Map.of(
                "jobId", job.getId(),
                "downloadUrl", s3Service.generatePresignedUrl(job.getSourceObjectKey(), 5),
                "expiresInSeconds", 300
        );
    }

    public boolean isTerminal(Map<String, Object> snapshot) {
        return TERMINAL_STATUSES.contains(String.valueOf(snapshot.get("status")));
    }

    private Map<String, Object> snapshot(CeleryJob job, boolean includeResult) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jobId", job.getId());
        response.put("taskId", job.getCeleryTaskId());
        response.put("celeryTaskId", job.getCeleryTaskId());
        response.put("status", normalizeStatus(job.getStatus()));
        response.put("progressStep", job.getProgressStep());
        response.put("progressPct", job.getProgressPct());
        response.put("sourceDeleted", job.getSourceDeletedAt() != null);
        response.put("sourceDeletedAt", job.getSourceDeletedAt());
        response.put("expiresAt", job.getExpiresAt());
        response.put("statusUrl", "/api/v1/kpop/analysis-jobs/" + job.getId());
        response.put("streamUrl", "/api/v1/kpop/analysis-jobs/" + job.getId() + "/stream");
        if (includeResult && job.getResultJson() != null && !job.getResultJson().isBlank()) {
            response.put("result", parseResult(job.getResultJson()));
        }
        if ("FAILED".equals(response.get("status"))) {
            response.put("error", "Analysis failed. Please try again.");
        }
        return response;
    }

    private boolean hasExpired(CeleryJob job) {
        return job.getExpiresAt() != null
                && job.getExpiresAt().isBefore(LocalDateTime.now())
                && !Set.of("SUCCESS", "FAILURE", "REVOKED", "EXPIRED").contains(job.getStatus());
    }

    private String normalizeStatus(String rawStatus) {
        if (rawStatus == null) return "QUEUED";
        return switch (rawStatus) {
            case "SUCCESS", "SUCCEEDED" -> "SUCCEEDED";
            case "FAILURE", "FAILED" -> "FAILED";
            case "REVOKED", "CANCELLED" -> "CANCELLED";
            case "EXPIRED" -> "EXPIRED";
            case "PENDING", "QUEUED" -> "QUEUED";
            default -> "RUNNING";
        };
    }

    private Object parseResult(String resultJson) {
        try {
            return objectMapper.readValue(resultJson, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ignored) {
            return Map.of(
                    "grade", "INSUFFICIENT_EVIDENCE",
                    "confidence", 0,
                    "evidence", java.util.List.of(),
                    "candidates", java.util.List.of()
            );
        }
    }

    private String requiredText(Map<String, Object> payload, String field) {
        Object raw = payload.get(field);
        String value = raw == null ? "" : String.valueOf(raw).trim();
        if (value.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required.");
        }
        return value;
    }

    private long requiredPositiveLong(Map<String, Object> payload, String field) {
        try {
            long value = Long.parseLong(requiredText(payload, field));
            if (value <= 0) throw new NumberFormatException();
            return value;
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be positive.");
        }
    }
}
