package com.domain.demo_backend.domain.admin.dto;

import java.time.LocalDateTime;
import java.util.List;

public record SduiScreenSummaryResponse(
        String screenId,
        long componentCount,
        String firstLabelText,
        LocalDateTime lastCreatedAt,
        List<String> componentTypes,
        List<String> dataSqlKeys
) {
}
