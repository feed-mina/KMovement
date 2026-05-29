package com.domain.demo_backend.domain.community.controller;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.service.AnimationService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/community/posts/{postId}/animate")
@RequiredArgsConstructor
@Tag(name = "Community Animation", description = "커뮤니티 스케치 애니메이션 API")
public class AnimationController {

    private final AnimationService animationService;

    @Operation(summary = "애니메이션 생성 요청")
    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> submitAnimation(
            @PathVariable("postId") Long postId,
            @RequestBody Map<String, String> body) {

        String imageBase64 = body.get("imageBase64");
        if (imageBase64 == null || imageBase64.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("imageBase64는 필수입니다."));
        }

        AnimationJob job = animationService.submitAnimation(postId, imageBase64);
        Map<String, Object> result = Map.of(
                "jobId", job.getId(),
                "runpodJobId", job.getRunpodJobId() != null ? job.getRunpodJobId() : "",
                "status", job.getStatus()
        );
        return ResponseEntity.ok(ApiResponse.success("애니메이션 생성이 요청되었습니다.", result));
    }

    @Operation(summary = "애니메이션 상태 조회")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAnimationStatus(
            @PathVariable("postId") Long postId) {

        AnimationJob job = animationService.getAnimationStatus(postId);
        Map<String, Object> result = Map.of(
                "jobId", job.getId(),
                "status", job.getStatus(),
                "resultUrl", job.getResultUrl() != null ? job.getResultUrl() : "",
                "errorMessage", job.getErrorMessage() != null ? job.getErrorMessage() : ""
        );
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
