package com.domain.demo_backend.domain.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

public record B2bDashboardResponse(
        LocalDateTime generatedAt,
        long impressions,
        long clicks,
        long conversions,
        double ctr,
        double conversionRate,
        List<SlotPerformance> slots
) {
    public record SlotPerformance(long slotId, String title, String status, long impressions,
                                  long clicks, long conversions, double ctr, double conversionRate) {}
}
