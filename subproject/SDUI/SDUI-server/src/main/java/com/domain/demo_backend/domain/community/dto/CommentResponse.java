package com.domain.demo_backend.domain.community.dto;

import com.domain.demo_backend.domain.community.domain.PostComment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CommentResponse {
    private Long commentId;
    private Long postId;
    private Long authorSqno;
    private String authorNickname;
    private String content;
    private String moderationStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static CommentResponse from(PostComment comment) {
        return CommentResponse.builder()
                .commentId(comment.getCommentId())
                .postId(comment.getPost().getPostId())
                .authorSqno(comment.getAuthor().getUserSqno())
                .authorNickname(displayName(comment.getAuthor().getNickname(), comment.getAuthor().getUserId()))
                .content(comment.getContent())
                .moderationStatus(comment.getModerationStatus().name())
                .createdAt(comment.getCreatedAt())
                .updatedAt(comment.getUpdatedAt())
                .build();
    }

    private static String displayName(String nickname, String userId) {
        return nickname == null || nickname.isBlank() ? userId : nickname;
    }
}
