package com.domain.demo_backend.domain.community.controller;

import com.domain.demo_backend.domain.community.dto.ReportRequest;
import com.domain.demo_backend.domain.community.service.PostReportService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/community/posts/{postId}/reports")
@RequiredArgsConstructor
@Tag(name = "Post Report", description = "게시글 신고 API")
public class PostReportController {

    private final PostReportService reportService;

    @Operation(summary = "게시글 신고")
    @PostMapping
    public ResponseEntity<ApiResponse<Void>> reportPost(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ReportRequest request) {

        reportService.reportPost(postId, userDetails.getUserSqno(), request);
        return ResponseEntity.ok(ApiResponse.success("신고가 접수되었습니다.", null));
    }
}
