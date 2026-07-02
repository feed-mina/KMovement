package com.domain.demo_backend.domain.admin.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 커뮤니티 통계 응답 DTO
 * GET /api/admin/stats/community 에서 사용
 */
@Getter
@Builder
public class CommunityStatsResponse {

    /** 전체 활성 게시글 수 (del_yn = 'N') */
    private long totalPosts;

    /** 최근 7일 신규 게시글 수 */
    private long newPostsLast7Days;

    /** 전체 좋아요 합계 */
    private long totalLikes;

    /** 전체 팔로우 관계 수 */
    private long totalFollows;

    /** 좋아요 순 인기 게시글 Top 5 */
    private List<PopularPost> topLikedPosts;

    @Getter
    @Builder
    public static class PopularPost {
        /** 게시글 ID */
        private Long postId;
        /** 게시글 제목 */
        private String title;
        /** 좋아요 수 */
        private long likeCount;
        /** 작성자 userId */
        private String authorId;
    }
}
