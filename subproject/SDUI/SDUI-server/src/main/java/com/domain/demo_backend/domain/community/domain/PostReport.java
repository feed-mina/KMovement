package com.domain.demo_backend.domain.community.domain;

import com.domain.demo_backend.domain.user.domain.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "post_report",
       uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "reporter_sqno"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_report_id")
    private Long postReportId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @JoinColumn(name = "post_id", nullable = false)
    private CommunityPost post;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @JoinColumn(name = "reporter_sqno", nullable = false)
    private User reporter;

    @Column(name = "reason_code", length = 30)
    private String reasonCode;

    @Column(name = "detail_text", length = 1000)
    private String detailText;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private PostReportStatus status = PostReportStatus.OPEN;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_admin_sqno")
    private User assignedAdmin;

    @Column(name = "review_due_at", nullable = false)
    private LocalDateTime reviewDueAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "resolution_note", length = 1000)
    private String resolutionNote;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = this.createdAt == null ? now : this.createdAt;
        this.updatedAt = this.updatedAt == null ? now : this.updatedAt;
        this.reviewDueAt = this.reviewDueAt == null ? now.plusHours(24) : this.reviewDueAt;
        this.status = this.status == null ? PostReportStatus.OPEN : this.status;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
