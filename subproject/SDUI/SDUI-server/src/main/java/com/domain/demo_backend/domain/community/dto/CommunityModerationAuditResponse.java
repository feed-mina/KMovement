package com.domain.demo_backend.domain.community.dto;

import com.domain.demo_backend.domain.community.domain.CommunityModerationAudit;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommunityModerationAuditResponse {
    private Long auditId;
    private String targetType;
    private Long targetId;
    private String fromStatus;
    private String toStatus;
    private Long actorUserSqno;
    private String actorNickname;
    private String reason;
    private LocalDateTime createdAt;

    public static CommunityModerationAuditResponse from(CommunityModerationAudit audit) {
        return CommunityModerationAuditResponse.builder()
                .auditId(audit.getAuditId())
                .targetType(audit.getTargetType())
                .targetId(audit.getTargetId())
                .fromStatus(audit.getFromStatus())
                .toStatus(audit.getToStatus())
                .actorUserSqno(audit.getAdminActor() == null ? null : audit.getAdminActor().getUserSqno())
                .actorNickname(audit.getAdminActor() == null ? null
                        : AdminCommunityPostResponse.displayName(
                                audit.getAdminActor().getNickname(), audit.getAdminActor().getUserId()))
                .reason(audit.getNote())
                .createdAt(audit.getCreatedAt())
                .build();
    }
}
