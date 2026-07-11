package com.domain.demo_backend.domain.admin.controller;

import com.domain.demo_backend.domain.admin.dto.B2bDashboardResponse;
import com.domain.demo_backend.domain.admin.service.B2bPilotService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class B2bPilotController {
    private final B2bPilotService service;
    public B2bPilotController(B2bPilotService service) { this.service = service; }

    @GetMapping("/api/partner/b2b/dashboard")
    public ApiResponse<B2bDashboardResponse> partnerDashboard(@AuthenticationPrincipal CustomUserDetails user) {
        return ApiResponse.success(service.dashboard(user.getUserSqno(), false));
    }

    @GetMapping("/api/admin/b2b/dashboard")
    public ApiResponse<B2bDashboardResponse> adminDashboard() { return ApiResponse.success(service.dashboard(null, true)); }

    @PostMapping("/api/partner/b2b/slots")
    public ApiResponse<Long> requestSlot(@RequestBody SlotRequest request, @AuthenticationPrincipal CustomUserDetails user) {
        return ApiResponse.success(service.requestSlot(user.getUserSqno(), request.partnerName(), request.partnerType(),
                request.slotKey(), request.title(), request.destinationUrl(), request.poiSqno()));
    }

    @PostMapping("/api/v1/b2b/slots/{slotId}/events")
    public ApiResponse<Void> event(@PathVariable long slotId, @RequestBody EventRequest request) {
        service.recordEvent(slotId, request.eventType(), request.sessionKey());
        return ApiResponse.success(null);
    }

    @PostMapping("/api/admin/b2b/slots/{slotId}/review")
    public ApiResponse<Void> review(@PathVariable long slotId, @RequestBody ReviewRequest request,
                                    @AuthenticationPrincipal CustomUserDetails user) {
        service.reviewSlot(slotId, request.status(), user.getUserSqno());
        return ApiResponse.success(null);
    }

    public record EventRequest(String eventType, String sessionKey) {}
    public record ReviewRequest(String status) {}
    public record SlotRequest(String partnerName, String partnerType, String slotKey, String title,
                              String destinationUrl, Long poiSqno) {}
}
