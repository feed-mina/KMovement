package com.domain.kride.domain.community.controller;

import com.domain.kride.domain.community.service.UserFollowService;
import com.domain.kride.global.common.response.ApiResponse;
import com.domain.kride.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/community/users")
@RequiredArgsConstructor
@Tag(name = "User Follow", description = "사용자 팔로우 API")
public class UserFollowController {

    private final UserFollowService followService;

    @Operation(summary = "팔로우 토글")
    @PostMapping("/{userSqno}/follow")
    public ResponseEntity<ApiResponse<Map<String, Object>>> toggleFollow(
            @PathVariable("userSqno") Long followeeSqno,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        Map<String, Object> response = followService.toggleFollow(userDetails.getUserSqno(), followeeSqno);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "팔로우 상태 조회")
    @GetMapping("/{userSqno}/follow/status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getFollowStatus(
            @PathVariable("userSqno") Long followeeSqno,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        Map<String, Object> response = followService.getFollowStatus(userDetails.getUserSqno(), followeeSqno);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
