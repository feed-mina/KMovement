package com.domain.demo_backend.domain.time.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GoalSettingRepository extends JpaRepository<GoalSetting, Long> {

    // 사용자 ID로 모든 목표 설정 기록을 가져오는 메서드
    List<GoalSetting> findByUserSqno(Long userSqno);

    // 가장 최근에 등록된 기록 하나를 가져오고 싶을 때 사용
    GoalSetting findFirstByUserSqnoOrderByCreatedAtDesc(Long userSqno);

    // getGoalTime과 동일한 기준(status IS NULL, target_time >= 오늘 시작, ASC)으로 가장 가까운 미래 goal 조회
    GoalSetting findFirstByUserSqnoAndStatusIsNullAndTargetTimeGreaterThanEqualOrderByTargetTimeAsc(
            Long userSqno, LocalDateTime startOfDay);

    /** 이번 주(weekStart 이후) 완료된 goal 수 (status IS NOT NULL) */
    @Query("SELECT COUNT(g) FROM GoalSetting g WHERE g.userSqno = :userSqno AND g.status IS NOT NULL AND g.targetTime >= :weekStart")
    long countWeeklyTotal(@Param("userSqno") Long userSqno, @Param("weekStart") LocalDateTime weekStart);

    /** 이번 주(weekStart 이후) 도착 성공 goal 수 (status = 'success' or 'safe') */
    @Query("SELECT COUNT(g) FROM GoalSetting g WHERE g.userSqno = :userSqno AND g.status IN ('success', 'safe') AND g.targetTime >= :weekStart")
    long countWeeklySuccess(@Param("userSqno") Long userSqno, @Param("weekStart") LocalDateTime weekStart);

    // 3개 알림 창(30/90/180분)을 한 번에 조회 — DB 쿼리 3회 → 1회 최적화
    // 각 창은 최소 154분 간격이므로 동일 goal이 여러 창에 동시 매칭되지 않음
    @Query("SELECT g FROM GoalSetting g WHERE g.status IS NULL AND (" +
           "  (g.targetTime BETWEEN :w30s AND :w30e AND g.notifSent30min = false) OR" +
           "  (g.targetTime BETWEEN :w90s AND :w90e AND g.notifSent90min = false) OR" +
           "  (g.targetTime BETWEEN :w180s AND :w180e AND g.notifSent180min = false)" +
           ")")
    List<GoalSetting> findAllPendingNotifications(
            @Param("w30s")  LocalDateTime w30s,  @Param("w30e")  LocalDateTime w30e,
            @Param("w90s")  LocalDateTime w90s,  @Param("w90e")  LocalDateTime w90e,
            @Param("w180s") LocalDateTime w180s, @Param("w180e") LocalDateTime w180e);

    // ── 월별 달성률 집계 쿼리 ─────────────────────────────────────────────────

    /** 특정 월(monthStart ~ monthEnd) 완료된 goal 수 (status IS NOT NULL) */
    @Query("SELECT COUNT(g) FROM GoalSetting g WHERE g.userSqno = :userSqno " +
           "AND g.status IS NOT NULL AND g.targetTime >= :monthStart AND g.targetTime < :monthEnd")
    long countMonthlyTotal(@Param("userSqno") Long userSqno,
                           @Param("monthStart") LocalDateTime monthStart,
                           @Param("monthEnd") LocalDateTime monthEnd);

    /** 특정 월 도착 성공 goal 수 (status = 'success' or 'safe') */
    @Query("SELECT COUNT(g) FROM GoalSetting g WHERE g.userSqno = :userSqno " +
           "AND g.status IN ('success', 'safe') AND g.targetTime >= :monthStart AND g.targetTime < :monthEnd")
    long countMonthlySuccess(@Param("userSqno") Long userSqno,
                             @Param("monthStart") LocalDateTime monthStart,
                             @Param("monthEnd") LocalDateTime monthEnd);

    /** 특정 월 모든 GoalSetting 조회 (달성 추이 상세용) */
    @Query("SELECT g FROM GoalSetting g WHERE g.userSqno = :userSqno " +
           "AND g.targetTime >= :monthStart AND g.targetTime < :monthEnd " +
           "ORDER BY g.targetTime ASC")
    List<GoalSetting> findMonthlyGoals(@Param("userSqno") Long userSqno,
                                       @Param("monthStart") LocalDateTime monthStart,
                                       @Param("monthEnd") LocalDateTime monthEnd);

    /** 전체 사용자별 이번 달 달성 건수 상위 조회 (어드민 대시보드용) */
    @Query("SELECT g.userSqno, COUNT(g) as cnt FROM GoalSetting g " +
           "WHERE g.status IN ('success', 'safe') AND g.targetTime >= :monthStart AND g.targetTime < :monthEnd " +
           "GROUP BY g.userSqno ORDER BY cnt DESC")
    List<Object[]> findTopAchieversByMonth(@Param("monthStart") LocalDateTime monthStart,
                                           @Param("monthEnd") LocalDateTime monthEnd);
}