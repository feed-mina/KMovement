package com.domain.demo_backend.domain.community.controller;

import com.domain.demo_backend.domain.community.dto.CommentRequest;
import com.domain.demo_backend.domain.community.dto.CommentResponse;
import com.domain.demo_backend.domain.community.service.PostCommentService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/community/posts/{postId}/comments")
@RequiredArgsConstructor
public class PostCommentController {

    private final PostCommentService commentService;

    @GetMapping
    public ResponseEntity<ApiResponse<Page<CommentResponse>>> getComments(
            @PathVariable("postId") Long postId,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(ApiResponse.success(
                commentService.getApprovedComments(postId, page, size)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CommentResponse>> createComment(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CommentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Comment submitted for moderation.",
                commentService.createComment(postId, userDetails.getUserSqno(), request)));
    }

    @PatchMapping("/{commentId}")
    public ResponseEntity<ApiResponse<CommentResponse>> updateComment(
            @PathVariable("postId") Long postId,
            @PathVariable("commentId") Long commentId,
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @Valid @RequestBody CommentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                "Comment updated and resubmitted for moderation.",
                commentService.updateComment(
                        postId, commentId, userDetails.getUserSqno(), request)));
    }

    @DeleteMapping("/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(
            @PathVariable("postId") Long postId,
            @PathVariable("commentId") Long commentId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        commentService.deleteComment(postId, commentId, userDetails.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success("Comment deleted.", null));
    }
}
