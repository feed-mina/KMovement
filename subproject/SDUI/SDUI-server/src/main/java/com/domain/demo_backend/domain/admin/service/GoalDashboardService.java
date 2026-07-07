package com.domain.demo_backend.domain.admin.service;

import com.domain.demo_backend.domain.admin.dto.GoalDashboardResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class GoalDashboardService {

    private final JdbcTemplate jdbcTemplate;

    public GoalDashboardService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public GoalDashboardResponse getDashboard() {
        return new GoalDashboardResponse(
                LocalDateTime.now(),
                getMonthlySummaries(),
                getDailyTrend(),
                getUserCards()
        );
    }

    private List<GoalDashboardResponse.MonthlyGoalSummary> getMonthlySummaries() {
        String sql = """
                WITH monthly AS (
                    SELECT
                        DATE_TRUNC('month', target_time) AS bucket,
                        COUNT(*) AS total_count,
                        SUM(CASE WHEN status IN ('success', 'safe') THEN 1 ELSE 0 END) AS success_count,
                        SUM(CASE WHEN status IS NOT NULL AND status NOT IN ('success', 'safe') THEN 1 ELSE 0 END) AS failure_count
                    FROM goal_settings
                    WHERE target_time >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
                    GROUP BY bucket
                )
                SELECT
                    TO_CHAR(bucket, 'YYYY-MM') AS month,
                    total_count,
                    success_count,
                    failure_count,
                    CASE
                        WHEN total_count = 0 THEN 0
                        ELSE ROUND(success_count * 100.0 / total_count, 1)
                    END AS attainment_rate
                FROM monthly
                ORDER BY bucket
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new GoalDashboardResponse.MonthlyGoalSummary(
                rs.getString("month"),
                rs.getLong("total_count"),
                rs.getLong("success_count"),
                rs.getLong("failure_count"),
                rs.getDouble("attainment_rate")
        ));
    }

    private List<GoalDashboardResponse.DailyGoalTrend> getDailyTrend() {
        String sql = """
                SELECT
                    TO_CHAR(target_time::date, 'YYYY-MM-DD') AS goal_date,
                    SUM(CASE WHEN status IN ('success', 'safe') THEN 1 ELSE 0 END) AS success_count,
                    SUM(CASE WHEN status IS NOT NULL AND status NOT IN ('success', 'safe') THEN 1 ELSE 0 END) AS failure_count
                FROM goal_settings
                WHERE target_time >= CURRENT_DATE - INTERVAL '13 days'
                  AND status IS NOT NULL
                GROUP BY target_time::date
                ORDER BY target_time::date
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new GoalDashboardResponse.DailyGoalTrend(
                rs.getString("goal_date"),
                rs.getLong("success_count"),
                rs.getLong("failure_count")
        ));
    }

    private List<GoalDashboardResponse.UserGoalCard> getUserCards() {
        String sql = """
                WITH user_goals AS (
                    SELECT
                        g.user_sqno,
                        COALESCE(
                            NULLIF(MAX(u.nickname), ''),
                            NULLIF(MAX(u.user_id), ''),
                            NULLIF(MAX(g.user_id), ''),
                            CONCAT('user-', g.user_sqno)
                        ) AS display_name,
                        COALESCE(NULLIF(MAX(u.user_id), ''), NULLIF(MAX(g.user_id), '')) AS user_id,
                        COUNT(*) AS total_count,
                        SUM(CASE WHEN g.status IN ('success', 'safe') THEN 1 ELSE 0 END) AS success_count,
                        SUM(CASE WHEN g.status IS NOT NULL AND g.status NOT IN ('success', 'safe') THEN 1 ELSE 0 END) AS failure_count,
                        SUM(CASE WHEN g.status IS NULL THEN 1 ELSE 0 END) AS pending_count
                    FROM goal_settings g
                    LEFT JOIN users u ON u.user_sqno = g.user_sqno
                    WHERE g.target_time >= DATE_TRUNC('month', CURRENT_DATE)
                    GROUP BY g.user_sqno
                )
                SELECT
                    user_sqno,
                    user_id,
                    display_name,
                    total_count,
                    success_count,
                    failure_count,
                    pending_count,
                    CASE
                        WHEN total_count = 0 THEN 0
                        ELSE ROUND(success_count * 100.0 / total_count, 1)
                    END AS attainment_rate
                FROM user_goals
                ORDER BY attainment_rate DESC, total_count DESC, user_sqno ASC
                LIMIT 12
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> new GoalDashboardResponse.UserGoalCard(
                rs.getLong("user_sqno"),
                rs.getString("user_id"),
                rs.getString("display_name"),
                rs.getLong("total_count"),
                rs.getLong("success_count"),
                rs.getLong("failure_count"),
                rs.getLong("pending_count"),
                rs.getDouble("attainment_rate")
        ));
    }
}
