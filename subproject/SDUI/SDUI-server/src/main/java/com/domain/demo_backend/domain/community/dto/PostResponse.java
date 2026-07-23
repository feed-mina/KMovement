package com.domain.demo_backend.domain.community.dto;

import com.domain.demo_backend.domain.community.domain.CommunityPost;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Getter
@Builder
public class PostResponse {
    private Long postId;
    private String title;
    private String content;
    private Long authorSqno;
    private String authorNickname;
    private Long likeCount;
    private Long reportCount;
    private String moderationStatus;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<PostImageDto> images;

    public static PostResponse from(CommunityPost post) {
        return PostResponse.builder()
                .postId(post.getPostId())
                .title(post.getTitle())
                .content(post.getContent())
                .authorSqno(post.getAuthorSqno())
                .authorNickname(post.getAuthor() != null
                        ? post.getAuthor().getNickname() != null
                            ? post.getAuthor().getNickname()
                            : post.getAuthor().getUserId()
                        : null)
                .likeCount(post.getLikeCount())
                .reportCount(post.getReportCount())
                .moderationStatus(post.getModerationStatus() == null
                        ? null : post.getModerationStatus().name())
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .images(post.getImages() != null
                        ? post.getImages().stream()
                            .map(PostImageDto::from)
                            .collect(Collectors.toList())
                        : List.of())
                .build();
    }
}
