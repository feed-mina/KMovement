package com.domain.demo_backend.domain.admin.controller;

import com.domain.demo_backend.domain.admin.dto.GoalDashboardResponse;
import com.domain.demo_backend.domain.admin.service.GoalDashboardService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/goal-dashboard")
public class GoalDashboardController {

    private final GoalDashboardService goalDashboardService;

    public GoalDashboardController(GoalDashboardService goalDashboardService) {
        this.goalDashboardService = goalDashboardService;
    }

    @GetMapping
    public ApiResponse<GoalDashboardResponse> getDashboard() {
        return ApiResponse.success(goalDashboardService.getDashboard());
    }
}
