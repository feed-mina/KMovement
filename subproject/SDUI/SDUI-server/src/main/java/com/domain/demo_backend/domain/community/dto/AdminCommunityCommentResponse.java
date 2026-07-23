package com.domain.demo_backend.domain.community.dto;

import com.domain.demo_backend.domain.community.domain.PostComment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class AdminCommunityCommentResponse {
    private Long commentId;
    private Long postId;
    private String content;
    private String moderationStatus;
    private Long authorSqno;
    private String authorNickname;
    private LocalDateTime createdAt;
    private LocalDateTime dueAt;
    private boolean slaBreached;
    private Long lastActorSqno;

    public static AdminCommunityCommentResponse from(PostComment comment, LocalDateTime now) {
        return AdminCommunityCommentResponse.builder()
                .commentId(comment.getCommentId())
                .postId(comment.getPost().getPostId())
                .content(comment.getContent())
                .moderationStatus(comment.getModerationStatus().name())
                .authorSqno(comment.getAuthor().getUserSqno())
                .authorNickname(AdminCommunityPostResponse.displayName(
                        comment.getAuthor().getNickname(), comment.getAuthor().getUserId()))
                .createdAt(comment.getCreatedAt())
                .dueAt(comment.getModerationDueAt())
                .slaBreached(AdminCommunityPostResponse.isBreached(
                        comment.getModerationDueAt(), comment.getModeratedAt(), now))
                .lastActorSqno(comment.getModeratedBy() == null
                        ? null : comment.getModeratedBy().getUserSqno())
                .build();
    }
}
