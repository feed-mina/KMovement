package com.domain.kride.domain.community.controller;

import com.domain.kride.domain.community.dto.LikeStatusResponse;
import com.domain.kride.domain.community.service.PostLikeService;
import com.domain.kride.global.common.response.ApiResponse;
import com.domain.kride.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/community/posts/{postId}/likes")
@RequiredArgsConstructor
@Tag(name = "Post Like", description = "게시글 좋아요 API")
public class PostLikeController {

    private final PostLikeService likeService;

    @Operation(summary = "좋아요 토글")
    @PostMapping
    public ResponseEntity<ApiResponse<LikeStatusResponse>> toggleLike(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        LikeStatusResponse response = likeService.toggleLike(postId, userDetails.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "좋아요 상태 조회")
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<LikeStatusResponse>> getLikeStatus(
            @PathVariable("postId") Long postId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        LikeStatusResponse response = likeService.getLikeStatus(postId, userDetails.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
