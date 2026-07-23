package com.domain.demo_backend.domain.community.domain;

import com.domain.demo_backend.domain.user.domain.User;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "community_post")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommunityPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @JoinColumn(name = "author_sqno")
    private User author;

    @Column(name = "author_sqno", insertable = false, updatable = false)
    private Long authorSqno;

    @Column(name = "title", length = 200, nullable = false)
    private String title;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Builder.Default
    @Column(name = "like_count")
    private Long likeCount = 0L;

    @Builder.Default
    @Column(name = "report_count")
    private Long reportCount = 0L;

    @Builder.Default
    @Column(name = "del_yn", length = 1)
    private String delYn = "N";

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "moderation_status", nullable = false, length = 20)
    private ContentModerationStatus moderationStatus = ContentModerationStatus.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "moderated_by")
    private User moderatedBy;

    @Column(name = "moderated_at")
    private LocalDateTime moderatedAt;

    @Column(name = "moderation_note", length = 1000)
    private String moderationNote;

    @Column(name = "moderation_due_at", nullable = false)
    private LocalDateTime moderationDueAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PostImage> images = new ArrayList<>();

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = this.createdAt == null ? now : this.createdAt;
        this.updatedAt = this.updatedAt == null ? now : this.updatedAt;
        this.moderationStatus = this.moderationStatus == null
                ? ContentModerationStatus.PENDING : this.moderationStatus;
        this.moderationDueAt = this.moderationDueAt == null
                ? now.plusHours(24) : this.moderationDueAt;
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
