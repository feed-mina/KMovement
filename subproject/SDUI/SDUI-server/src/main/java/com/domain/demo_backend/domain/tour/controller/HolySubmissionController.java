package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.domain.tour.dto.HolyReviewItemDto;
import com.domain.demo_backend.domain.tour.service.TourService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/tour/holy/submissions")
@RequiredArgsConstructor
public class HolySubmissionController {
    private final TourService tourService;

    @PostMapping
    public ResponseEntity<?> submit(@RequestBody SubmissionRequest request,
                                    @AuthenticationPrincipal CustomUserDetails user) {
        try {
            HolyReviewItemDto result = tourService.submitHolyPoi(request.title(), request.addr(), request.mapX(),
                    request.mapY(), request.artist(), request.recommendReason(), request.sourceUrl(), user.getUserSqno());
            return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    public record SubmissionRequest(String title, String addr, Double mapX, Double mapY, String artist,
                                    String recommendReason, String sourceUrl) {}
}
