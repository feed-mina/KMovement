package com.domain.demo_backend.domain.community.controller;

import com.domain.demo_backend.domain.community.dto.*;
import com.domain.demo_backend.domain.community.service.CommunityModerationService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/community")
@RequiredArgsConstructor
public class CommunityModerationController {

    private final CommunityModerationService moderationService;

    @GetMapping("/posts")
    public ResponseEntity<ApiResponse<Page<AdminCommunityPostResponse>>> getPosts(
            @RequestParam(name = "status", defaultValue = "PENDING") String status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(moderationService.getPosts(status, page, size)));
    }

    @PatchMapping("/posts/{postId}/moderation")
    public ResponseEntity<ApiResponse<AdminCommunityPostResponse>> moderatePost(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ModerationTransitionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                moderationService.moderatePost(postId, userDetails.getUserSqno(), request)));
    }

    @GetMapping("/comments")
    public ResponseEntity<ApiResponse<Page<AdminCommunityCommentResponse>>> getComments(
            @RequestParam(name = "status", defaultValue = "PENDING") String status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(moderationService.getComments(status, page, size)));
    }

    @PatchMapping("/comments/{commentId}/moderation")
    public ResponseEntity<ApiResponse<AdminCommunityCommentResponse>> moderateComment(
            @PathVariable("commentId") Long commentId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ModerationTransitionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                moderationService.moderateComment(commentId, userDetails.getUserSqno(), request)));
    }

    @GetMapping("/reports")
    public ResponseEntity<ApiResponse<Page<AdminCommunityReportResponse>>> getReports(
            @RequestParam(name = "status", defaultValue = "OPEN") String status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(moderationService.getReports(status, page, size)));
    }

    @PatchMapping("/reports/{reportId}/status")
    public ResponseEntity<ApiResponse<AdminCommunityReportResponse>> transitionReport(
            @PathVariable("reportId") Long reportId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody ModerationTransitionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                moderationService.transitionReport(reportId, userDetails.getUserSqno(), request)));
    }

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<Page<CommunityModerationAuditResponse>>> getAudit(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(moderationService.getAudit(page, size)));
    }
}
