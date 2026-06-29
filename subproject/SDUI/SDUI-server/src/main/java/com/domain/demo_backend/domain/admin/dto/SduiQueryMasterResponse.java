package com.domain.demo_backend.domain.admin.dto;

import java.time.LocalDateTime;

public record SduiQueryMasterResponse(
        String sqlKey,
        String returnType,
        String requiredRole,
        String description,
        String queryText,
        LocalDateTime updatedAt
) {
}
