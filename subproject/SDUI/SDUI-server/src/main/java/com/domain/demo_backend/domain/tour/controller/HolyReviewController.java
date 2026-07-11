package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.domain.tour.dto.HolyReviewItemDto;
import com.domain.demo_backend.domain.tour.service.TourService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 성지 POI 검수 API — 어드민 전용. Epic #74 · Dev-4(#96-A) 2차.
 *
 * <p>경로를 /api/admin/** 아래에 두어 SecurityConfig의 기존
 * {@code .requestMatchers("/api/admin/**").hasRole("ADMIN")} 규칙으로 보호한다.
 * (/api/v1/tour/** 는 GET permitAll이므로 검수 API를 그 아래 두면 안 된다.)</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/admin/tour/holy")
@RequiredArgsConstructor
public class HolyReviewController {

    private final TourService tourService;

    /** GET /api/admin/tour/holy/pending — 검수 대기 큐 목록. */
    @GetMapping("/pending")
    public ApiResponse<List<HolyReviewItemDto>> getPending() {
        return ApiResponse.success(tourService.getPendingHolyPois());
    }

    /** 검수 액션 요청 바디. action: APPROVE | REJECT */
    public record ReviewActionRequest(String action) {}

    /** POST /api/admin/tour/holy/{poiSqno}/review — 승인/반려 처리. */
    @PostMapping("/{poiSqno}/review")
    public ResponseEntity<?> review(@PathVariable Long poiSqno,
                                    @RequestBody ReviewActionRequest request,
                                    Principal principal) {
        String reviewer = principal != null ? principal.getName() : "admin";
        try {
            HolyReviewItemDto result = tourService.reviewHolyPoi(poiSqno, request.action(), reviewer);
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (IllegalArgumentException e) {
            log.warn("[HolyReview] 검수 요청 거부 - poiSqno={}, reason={}", poiSqno, e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        }
    }
}
