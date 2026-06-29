package com.domain.demo_backend.domain.admin.dto;

import java.util.List;

public record SduiScreenDetailResponse(
        String screenId,
        List<ComponentResponse> components
) {
    public record ComponentResponse(
            Long uiId,
            String componentId,
            String labelText,
            String componentType,
            Integer sortOrder,
            String actionType,
            String actionUrl,
            String dataSqlKey,
            String dataApiUrl,
            String groupId,
            String parentGroupId,
            String isVisible,
            String allowedRoles,
            String componentProps
    ) {
    }
}
