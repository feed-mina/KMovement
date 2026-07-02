package com.domain.demo_backend.domain.admin.service;

import com.domain.demo_backend.domain.admin.dto.AdminUsageStatsResponse;
import com.domain.demo_backend.domain.admin.dto.AdminUsageStatsResponse.RegionCount;
import com.domain.demo_backend.domain.admin.dto.AdminUsageStatsResponse.RequestTypeCount;
import com.domain.demo_backend.domain.admin.dto.CommunityStatsResponse;
import com.domain.demo_backend.domain.admin.dto.CommunityStatsResponse.PopularPost;
import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import com.domain.demo_backend.domain.community.domain.PostLikeRepository;
import com.domain.demo_backend.domain.community.domain.UserFollowRepository;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 어드민 이용 통계 / 커뮤니티 통계 서비스.
 *
 * user_route_history 는 JPA 엔티티가 없으므로 NamedParameterJdbcTemplate 으로 조회한다.
 * 커뮤니티 통계는 기존 JPA 레포지토리를 재사용한다.
 */
@Service
@RequiredArgsConstructor
public class AdminUsageStatsService {

    private final UserRepository userRepository;
    private final CommunityPostRepository communityPostRepository;
    private final PostLikeRepository postLikeRepository;
    private final UserFollowRepository userFollowRepository;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    /**
     * 어드민 이용 통계 조회.
     *  - 총 사용자 수
     *  - 최근 7일 신규 가입자
     *  - 최근 7일 K-Ride 경로 탐색 건수 (user_route_history)
     *  - 유형별 경로 탐색 건수
     *  - 최근 7일 인기 지역 Top 5
     */
    @Transactional(readOnly = true)
    public AdminUsageStatsResponse getUsageStats() {
        long totalUsers = userRepository.count();

        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("since", sevenDaysAgo);

        // 최근 7일 신규 가입자 수 (User 엔티티에 created_at 컬럼이 없으면 0)
        long newUsersLast7Days = queryNewUsersLast7Days(sevenDaysAgo);

        // 최근 7일 경로 탐색 총 건수
        long routeSearchesLast7Days = queryRouteSearchCount(params);

        // 유형별 경로 탐색 건수
        List<RequestTypeCount> routeCountByType = queryRouteCountByType(params);

        // 인기 지역 Top 5
        List<RegionCount> topRegionsLast7Days = queryTopRegions(params);

        return AdminUsageStatsResponse.builder()
                .totalUsers(totalUsers)
                .newUsersLast7Days(newUsersLast7Days)
                .routeSearchesLast7Days(routeSearchesLast7Days)
                .routeCountByType(routeCountByType)
                .topRegionsLast7Days(topRegionsLast7Days)
                .build();
    }

    /**
     * 커뮤니티 통계 조회.
     *  - 전체/최근 7일 게시글 수
     *  - 전체 좋아요·팔로우 수
     *  - 인기 게시글 Top 5
     */
    @Transactional(readOnly = true)
    public CommunityStatsResponse getCommunityStats() {
        long totalPosts = communityPostRepository.countByDelYn("N");
        long totalLikes = postLikeRepository.count();
        long totalFollows = userFollowRepository.count();

        // 최근 7일 신규 게시글 수
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        long newPostsLast7Days = communityPostRepository.countByDelYnAndCreatedAtAfter("N", sevenDaysAgo);

        // 좋아요 순 Top 5
        Pageable top5 = PageRequest.of(0, 5);
        List<CommunityPost> topPosts = communityPostRepository
                .findByDelYnOrderByLikeCountDesc("N", top5)
                .getContent();

        List<PopularPost> topLikedPosts = topPosts.stream()
                .map(p -> PopularPost.builder()
                        .postId(p.getPostId())
                        .title(p.getTitle())
                        .likeCount(p.getLikeCount())
                        .authorId(p.getAuthor() != null ? p.getAuthor().getUserId() : null)
                        .build())
                .collect(Collectors.toList());

        return CommunityStatsResponse.builder()
                .totalPosts(totalPosts)
                .newPostsLast7Days(newPostsLast7Days)
                .totalLikes(totalLikes)
                .totalFollows(totalFollows)
                .topLikedPosts(topLikedPosts)
                .build();
    }

    // -------------------------------------------------------------------------
    // 내부 헬퍼 (user_route_history native SQL)
    // -------------------------------------------------------------------------

    private long queryNewUsersLast7Days(LocalDateTime since) {
        try {
            String sql = "SELECT COUNT(*) FROM users WHERE del_yn = 'N' AND created_at >= :since";
            Long count = namedParameterJdbcTemplate.queryForObject(
                    sql,
                    new MapSqlParameterSource("since", since),
                    Long.class);
            return count != null ? count : 0L;
        } catch (Exception e) {
            // created_at 컬럼이 없거나 접근 불가 시 0 반환 (비치명적)
            return 0L;
        }
    }

    private long queryRouteSearchCount(MapSqlParameterSource params) {
        try {
            String sql = "SELECT COUNT(*) FROM user_route_history WHERE recorded_at >= :since";
            Long count = namedParameterJdbcTemplate.queryForObject(sql, params, Long.class);
            return count != null ? count : 0L;
        } catch (Exception e) {
            return 0L;
        }
    }

    private List<RequestTypeCount> queryRouteCountByType(MapSqlParameterSource params) {
        try {
            String sql = "SELECT request_type, COUNT(*) AS cnt" +
                         " FROM user_route_history" +
                         " WHERE recorded_at >= :since" +
                         " GROUP BY request_type" +
                         " ORDER BY cnt DESC";
            return namedParameterJdbcTemplate.query(sql, params, (rs, rowNum) ->
                    RequestTypeCount.builder()
                            .requestType(rs.getString("request_type"))
                            .count(rs.getLong("cnt"))
                            .build());
        } catch (Exception e) {
            return List.of();
        }
    }

    private List<RegionCount> queryTopRegions(MapSqlParameterSource params) {
        try {
            // JSONB 배열을 UNNEST해 각 지역명을 행으로 펼쳐 집계한다
            String sql = "SELECT region_name, COUNT(*) AS cnt" +
                         " FROM user_route_history," +
                         "      jsonb_array_elements_text(regions) AS region_name" +
                         " WHERE recorded_at >= :since" +
                         " GROUP BY region_name" +
                         " ORDER BY cnt DESC" +
                         " LIMIT 5";
            return namedParameterJdbcTemplate.query(sql, params, (rs, rowNum) ->
                    RegionCount.builder()
                            .region(rs.getString("region_name"))
                            .count(rs.getLong("cnt"))
                            .build());
        } catch (Exception e) {
            return List.of();
        }
    }
}
