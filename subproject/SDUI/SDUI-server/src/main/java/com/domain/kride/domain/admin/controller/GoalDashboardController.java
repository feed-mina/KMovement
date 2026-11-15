package com.domain.kride.domain.admin.controller;

import com.domain.kride.domain.admin.dto.GoalDashboardResponse;
import com.domain.kride.domain.admin.service.GoalDashboardService;
import com.domain.kride.global.common.response.ApiResponse;
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
