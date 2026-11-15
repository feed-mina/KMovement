package com.domain.kride.domain.community.dto;

import com.domain.kride.domain.community.domain.CommunityPost;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class PostListResponse {
    private Long postId;
    private String title;
    private String contentPreview;
    private Long authorSqno;
    private String authorNickname;
    private Long likeCount;
    private String thumbnailUrl;
    private LocalDateTime createdAt;

    public static PostListResponse from(CommunityPost post) {
        String preview = post.getContent();
        if (preview != null && preview.length() > 100) {
            preview = preview.substring(0, 100) + "...";
        }

        String thumbnail = null;
        if (post.getImages() != null && !post.getImages().isEmpty()) {
            thumbnail = post.getImages().stream()
                    .filter(img -> img.getSortOrder() != null && img.getSortOrder() == 1)
                    .findFirst()
                    .map(img -> img.getStorageUrl())
                    .orElse(post.getImages().get(0).getStorageUrl());
        }

        return PostListResponse.builder()
                .postId(post.getPostId())
                .title(post.getTitle())
                .contentPreview(preview)
                .authorSqno(post.getAuthorSqno())
                .authorNickname(post.getAuthor() != null
                        ? post.getAuthor().getNickname() != null
                            ? post.getAuthor().getNickname()
                            : post.getAuthor().getUserId()
                        : null)
                .likeCount(post.getLikeCount())
                .thumbnailUrl(thumbnail)
                .createdAt(post.getCreatedAt())
                .build();
    }
}
