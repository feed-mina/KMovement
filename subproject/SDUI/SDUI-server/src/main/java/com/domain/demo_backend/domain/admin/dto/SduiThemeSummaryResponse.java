package com.domain.demo_backend.domain.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SduiThemeSummaryResponse(
        String themeId,
        long tokenCount,
        LocalDateTime lastUpdatedAt,
        List<String> categories
) {
}
