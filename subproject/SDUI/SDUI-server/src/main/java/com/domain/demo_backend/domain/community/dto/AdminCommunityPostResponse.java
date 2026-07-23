package com.domain.demo_backend.domain.community.dto;

import com.domain.demo_backend.domain.community.domain.CommunityPost;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminCommunityPostResponse {
    private Long postId;
    private String title;
    private String content;
    private String moderationStatus;
    private Long authorSqno;
    private String authorNickname;
    private LocalDateTime createdAt;
    private LocalDateTime dueAt;
    private boolean slaBreached;
    private Long lastActorSqno;

    public static AdminCommunityPostResponse from(CommunityPost post, LocalDateTime now) {
        LocalDateTime completedAt = post.getModeratedAt();
        return AdminCommunityPostResponse.builder()
                .postId(post.getPostId())
                .title(post.getTitle())
                .content(post.getContent())
                .moderationStatus(post.getModerationStatus().name())
                .authorSqno(post.getAuthor().getUserSqno())
                .authorNickname(displayName(post.getAuthor().getNickname(), post.getAuthor().getUserId()))
                .createdAt(post.getCreatedAt())
                .dueAt(post.getModerationDueAt())
                .slaBreached(isBreached(post.getModerationDueAt(), completedAt, now))
                .lastActorSqno(post.getModeratedBy() == null ? null : post.getModeratedBy().getUserSqno())
                .build();
    }

    static boolean isBreached(LocalDateTime dueAt, LocalDateTime completedAt, LocalDateTime now) {
        return dueAt != null && (completedAt == null ? now.isAfter(dueAt) : completedAt.isAfter(dueAt));
    }

    static String displayName(String nickname, String userId) {
        return nickname == null || nickname.isBlank() ? userId : nickname;
    }
}
