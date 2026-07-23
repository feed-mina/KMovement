package com.domain.demo_backend.domain.community.dto;

import com.domain.demo_backend.domain.community.domain.PostReport;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminCommunityReportResponse {
    private Long reportId;
    private Long postId;
    private String reasonCode;
    private String detailText;
    private String status;
    private Long reporterSqno;
    private String reporterNickname;
    private LocalDateTime createdAt;
    private LocalDateTime dueAt;
    private boolean slaBreached;
    private Long lastActorSqno;
    private LocalDateTime resolvedAt;
    private String resolutionNote;

    public static AdminCommunityReportResponse from(PostReport report, LocalDateTime now) {
        return AdminCommunityReportResponse.builder()
                .reportId(report.getPostReportId())
                .postId(report.getPost().getPostId())
                .reasonCode(report.getReasonCode())
                .detailText(report.getDetailText())
                .status(report.getStatus().name())
                .reporterSqno(report.getReporter().getUserSqno())
                .reporterNickname(AdminCommunityPostResponse.displayName(
                        report.getReporter().getNickname(), report.getReporter().getUserId()))
                .createdAt(report.getCreatedAt())
                .dueAt(report.getReviewDueAt())
                .slaBreached(AdminCommunityPostResponse.isBreached(
                        report.getReviewDueAt(), report.getResolvedAt(), now))
                .lastActorSqno(report.getAssignedAdmin() == null
                        ? null : report.getAssignedAdmin().getUserSqno())
                .resolvedAt(report.getResolvedAt())
                .resolutionNote(report.getResolutionNote())
                .build();
    }
}
