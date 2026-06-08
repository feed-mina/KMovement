package com.domain.demo_backend.domain.community.controller;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.dto.AnimationCreateRequest;
import com.domain.demo_backend.domain.community.dto.BatchAnimationRequest;
import com.domain.demo_backend.domain.community.service.AnimationService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/community/posts/{postId}/animate")
@RequiredArgsConstructor
@Tag(name = "Community Animation", description = "Community media generation API")
public class AnimationController {

    private final AnimationService animationService;

    @Operation(summary = "Submit a single-image video job")
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitAnimation(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody AnimationCreateRequest request
    ) {
        AnimationJob job = animationService.submitAnimation(
                postId,
                userDetails.getUserSqno(),
                request
        );
        return ResponseEntity.ok(ApiResponse.success(
                "영상 생성 작업을 요청했습니다.",
                submissionResponse(job)
        ));
    }

    @Operation(summary = "Submit a multi-image video job")
    @PostMapping("/batch")
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitBatchAnimation(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody BatchAnimationRequest request
    ) {
        AnimationJob job = animationService.submitBatchAnimation(
                postId,
                userDetails.getUserSqno(),
                request
        );
        Map<String, Object> result = submissionResponse(job);
        result.put("totalImages", job.getTotalImages() != null ? job.getTotalImages() : 0);
        return ResponseEntity.ok(ApiResponse.success(
                "배치 영상 생성 작업을 요청했습니다.",
                result
        ));
    }

    @Operation(summary = "Get the latest video job status")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAnimationStatus(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        try {
            AnimationJob job = animationService.getAnimationStatus(postId);
            boolean owner = userDetails != null
                    && animationService.isPostOwner(job, userDetails.getUserSqno());
            Map<String, Object> result = submissionResponse(job);
            result.put("resultUrl", job.getResultUrl() != null ? job.getResultUrl() : "");
            result.put(
                    "errorMessage",
                    owner && job.getErrorMessage() != null ? job.getErrorMessage() : ""
            );
            result.put("totalImages", job.getTotalImages() != null ? job.getTotalImages() : 0);
            result.put("processedImages", job.getProcessedImages() != null ? job.getProcessedImages() : 0);
            result.put("route", job.getRoute() != null ? job.getRoute() : "");
            result.put("actualModel", job.getActualModel() != null ? job.getActualModel() : "");
            result.put(
                    "failedImageIndexes",
                    job.getFailedImageIndexes() != null ? job.getFailedImageIndexes() : ""
            );
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.ok(ApiResponse.success(Map.of(
                    "jobId", 0,
                    "status", "NONE",
                    "resultUrl", "",
                    "errorMessage", ""
            )));
        }
    }

    private Map<String, Object> submissionResponse(AnimationJob job) {
        Map<String, Object> result = new java.util.HashMap<>(Map.of(
                "jobId", job.getId(),
                "runpodJobId", job.getRunpodJobId() != null ? job.getRunpodJobId() : "",
                "status", job.getStatus()
        ));
        result.put("route", job.getRoute() != null ? job.getRoute() : "");
        return result;
    }
}
