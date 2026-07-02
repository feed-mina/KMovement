package com.domain.demo_backend.domain.admin.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 어드민 이용 통계 응답 DTO
 * GET /api/admin/stats 에서 사용
 */
@Getter
@Builder
public class AdminUsageStatsResponse {

    /** 총 등록 사용자 수 */
    private long totalUsers;

    /** 최근 7일 신규 가입자 수 */
    private long newUsersLast7Days;

    /** 최근 7일 K-Ride 경로 탐색 건수 */
    private long routeSearchesLast7Days;

    /** 경로 탐색 유형별 건수 (route / course / itinerary) */
    private List<RequestTypeCount> routeCountByType;

    /** 최근 7일 인기 지역 Top 5 */
    private List<RegionCount> topRegionsLast7Days;

    @Getter
    @Builder
    public static class RequestTypeCount {
        /** 요청 유형: route | course | itinerary */
        private String requestType;
        /** 해당 유형 건수 */
        private long count;
    }

    @Getter
    @Builder
    public static class RegionCount {
        /** 지역명 */
        private String region;
        /** 출현 횟수 */
        private long count;
    }
}
