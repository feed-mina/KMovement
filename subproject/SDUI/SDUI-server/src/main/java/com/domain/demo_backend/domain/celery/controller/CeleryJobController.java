package com.domain.demo_backend.domain.celery.controller;

import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.service.CeleryJobService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/celery")
@RequiredArgsConstructor
@Tag(name = "Celery Jobs", description = "FastAPI Celery 비동기 작업 관리 API")
public class CeleryJobController {

    private final CeleryJobService celeryJobService;

    @Operation(summary = "Submit a Celery task")
    @PostMapping("/jobs/{taskType}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitJob(
            @PathVariable("taskType") String taskType,
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        CeleryJob job = celeryJobService.submitJob(
                taskType, payload, userDetails.getUserSqno()
        );
        return ResponseEntity.ok(ApiResponse.success(
                "Celery 작업을 제출했습니다.",
                jobResponse(job)
        ));
    }

    @Operation(summary = "Get Celery task status")
    @GetMapping("/jobs/{celeryTaskId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getJobStatus(
            @PathVariable("celeryTaskId") String celeryTaskId
    ) {
        CeleryJob job = celeryJobService.getJobStatus(celeryTaskId);
        CeleryJob refreshed = celeryJobService.refreshJob(job);
        return ResponseEntity.ok(ApiResponse.success(jobResponse(refreshed)));
    }

    private Map<String, Object> jobResponse(CeleryJob job) {
        Map<String, Object> result = new HashMap<>();
        result.put("id", job.getId());
        result.put("celeryTaskId", job.getCeleryTaskId() != null ? job.getCeleryTaskId() : "");
        result.put("taskType", job.getTaskType());
        result.put("status", job.getStatus());
        result.put("resultJson", job.getResultJson() != null ? job.getResultJson() : "");
        result.put("errorMessage", job.getErrorMessage() != null ? job.getErrorMessage() : "");
        result.put("progressStep", job.getProgressStep() != null ? job.getProgressStep() : "");
        result.put("progressPct", job.getProgressPct() != null ? job.getProgressPct() : 0);
        return result;
    }
}
