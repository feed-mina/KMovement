package com.domain.demo_backend.domain.time.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

/**
 * 월별 목표 달성률 응답 DTO
 * GET /api/goalTime/stats/monthly 에서 사용
 */
@Getter
@Builder
public class GoalMonthlyStatsResponse {

    /** 조회 년도 (예: 2026) */
    private int year;

    /** 조회 월 (1~12) */
    private int month;

    /** 해당 월 총 완료 시도 건수 (status IS NOT NULL) */
    private long totalCount;

    /** 해당 월 성공 건수 (status = 'success' or 'safe') */
    private long successCount;

    /** 해당 월 실패 건수 (totalCount - successCount) */
    private long failCount;

    /**
     * 달성률 (0~100, 소수 첫째 자리 반올림)
     * totalCount == 0 이면 null
     */
    private Double achievementRate;

    /** 일별 달성 추이 (날짜 기준 오름차순) */
    private List<DailyGoalResult> dailyResults;

    @Getter
    @Builder
    public static class DailyGoalResult {
        /** 목표 날짜 (yyyy-MM-dd) */
        private String date;
        /** 목표 시간 (HH:mm) */
        private String targetTime;
        /** 결과 상태: success | safe | late | fail | null(미처리) */
        private String status;
    }
}
