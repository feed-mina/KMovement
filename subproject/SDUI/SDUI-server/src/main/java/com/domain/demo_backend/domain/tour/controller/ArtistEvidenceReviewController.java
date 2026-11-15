package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.domain.tour.dto.ArtistEvidenceReviewRequest.Evidence;
import com.domain.demo_backend.domain.tour.dto.ArtistEvidenceReviewRequest.Identity;
import com.domain.demo_backend.domain.tour.dto.ArtistEvidenceReviewRequest.VisitPolicy;
import com.domain.demo_backend.domain.tour.service.ArtistEvidenceReviewService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletResponse;

/** ADMIN-only explicit review. Validation and SQL live in ArtistEvidenceReviewService / ArtistEvidenceJdbcRepository. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/tour/artist-evidence")
public class ArtistEvidenceReviewController {
    private final ArtistEvidenceReviewService reviewService;

    @ModelAttribute
    void noStore(HttpServletResponse response) { response.setHeader("Cache-Control", "private, no-store"); }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public java.util.Map<String,String> invalidReference() {
        return java.util.Map.of("code","invalid_reference","message","Check the explicit content, artist and place IDs.");
    }

    static String reviewer(CustomUserDetails principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return "user:" + principal.getUserSqno();
    }

    @PostMapping("/identity")
    public ApiResponse<?> identity(@RequestBody Identity r, @AuthenticationPrincipal CustomUserDetails user) {
        reviewService.linkIdentity(r, reviewer(user));
        return ApiResponse.success("identity linked");
    }

    @PostMapping
    public ApiResponse<?> evidence(@RequestBody Evidence r, @AuthenticationPrincipal CustomUserDetails user) {
        return ApiResponse.success(reviewService.verifyEvidence(r, reviewer(user)));
    }

    @PostMapping("/visit-policy")
    public ApiResponse<?> visitPolicy(@RequestBody VisitPolicy r, @AuthenticationPrincipal CustomUserDetails user) {
        reviewService.verifyVisitPolicy(r, reviewer(user));
        return ApiResponse.success("visit policy reviewed");
    }

    @PostMapping("/{evidenceId}/revoke")
    public ApiResponse<?> revoke(@PathVariable Long evidenceId, @AuthenticationPrincipal CustomUserDetails user) {
        reviewService.revokeEvidence(evidenceId, reviewer(user));
        return ApiResponse.success("revoked");
    }

    @PostMapping("/visit-policy/{poiId}/revoke")
    public ApiResponse<?> revokePolicy(@PathVariable Long poiId, @AuthenticationPrincipal CustomUserDetails user) {
        reviewService.revokeVisitPolicy(poiId, reviewer(user));
        return ApiResponse.success("revoked");
    }
}
