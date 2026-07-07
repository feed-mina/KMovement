package com.domain.demo_backend.domain.admin.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDateTime;
import java.util.List;

public record GoalDashboardResponse(
        @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss")
        LocalDateTime generatedAt,
        List<MonthlyGoalSummary> monthly,
        List<DailyGoalTrend> trend,
        List<UserGoalCard> users
) {
    public record MonthlyGoalSummary(
            String month,
            long totalCount,
            long successCount,
            long failureCount,
            double attainmentRate
    ) {
    }

    public record DailyGoalTrend(
            String date,
            long successCount,
            long failureCount
    ) {
    }

    public record UserGoalCard(
            Long userSqno,
            String userId,
            String displayName,
            long totalCount,
            long successCount,
            long failureCount,
            long pendingCount,
            double attainmentRate
    ) {
    }
}
