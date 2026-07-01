package com.domain.demo_backend.domain.time.domain;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.ActiveProfiles;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * GoalSettingRepository 슬라이스 테스트 (H2 in-memory, Flyway 비활성화).
 *
 * findAllPendingNotifications JPQL 쿼리:
 *   - status IS NULL 인 goal 만 조회
 *   - 각 알림 창(30/90/180분) 범위에 targetTime 이 포함되어 있어야 함
 *   - 해당 창의 notifSent 플래그가 false 여야 함
 *
 * findFirstByUserSqno...OrderByTargetTimeAsc:
 *   - status IS NULL && target_time >= 오늘 00:00 KST 인 가장 가까운 미래 goal 반환
 */
@DataJpaTest
@ActiveProfiles("test")
@DisplayName("GoalSettingRepository 슬라이스 테스트")
class GoalSettingRepositoryTest {

    @Autowired
    private GoalSettingRepository goalSettingRepository;

    // 테스트 기준 시각 (고정값으로 시간 의존성 제거)
    private static final LocalDateTime BASE = LocalDateTime.of(2026, 3, 18, 10, 0);

    @BeforeEach
    void setUp() {
        goalSettingRepository.deleteAll();
    }

    private GoalSetting save(Long userSqno, LocalDateTime targetTime,
                              String status,
                              boolean sent30, boolean sent90, boolean sent180) {
        GoalSetting g = new GoalSetting();
        g.setUserSqno(userSqno);
        g.setTargetTime(targetTime);
        g.setStatus(status);
        g.setNotifSent30min(sent30);
        g.setNotifSent90min(sent90);
        g.setNotifSent180min(sent180);
        return goalSettingRepository.save(g);
    }

    // ── findAllPendingNotifications ──────────────────────────────────────────────

    @Test
    @DisplayName("30분 창에 있는 미발송 goal 을 조회해야 함")
    void findPending_30minWindow_shouldReturn() {
        save(1L, BASE.plusMinutes(30), null, false, false, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTargetTime()).isEqualTo(BASE.plusMinutes(30));
    }

    @Test
    @DisplayName("90분 창에 있는 미발송 goal 을 조회해야 함")
    void findPending_90minWindow_shouldReturn() {
        save(1L, BASE.plusMinutes(90), null, false, false, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("180분 창에 있는 미발송 goal 을 조회해야 함")
    void findPending_180minWindow_shouldReturn() {
        save(1L, BASE.plusMinutes(180), null, false, false, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).hasSize(1);
    }

    @Test
    @DisplayName("3개 창에 각각 해당하는 goal 3개가 한 번에 조회되어야 함")
    void findPending_allThreeWindows_shouldReturnAll() {
        save(1L, BASE.plusMinutes(30),  null, false, false, false);
        save(2L, BASE.plusMinutes(90),  null, false, false, false);
        save(3L, BASE.plusMinutes(180), null, false, false, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).hasSize(3);
    }

    @Test
    @DisplayName("notifSent30min=true 이면 30분 창에서 조회되지 않아야 함")
    void findPending_alreadySent30min_shouldNotReturn() {
        save(1L, BASE.plusMinutes(30), null, true, false, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("notifSent90min=true 이면 90분 창에서 조회되지 않아야 함")
    void findPending_alreadySent90min_shouldNotReturn() {
        save(1L, BASE.plusMinutes(90), null, false, true, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("notifSent180min=true 이면 180분 창에서 조회되지 않아야 함")
    void findPending_alreadySent180min_shouldNotReturn() {
        save(1L, BASE.plusMinutes(180), null, false, false, true);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("status 가 NULL 이 아닌 goal 은 어떤 창에서도 조회되지 않아야 함")
    void findPending_completedStatus_shouldNotReturn() {
        save(1L, BASE.plusMinutes(30),  "COMPLETED", false, false, false);
        save(2L, BASE.plusMinutes(90),  "ARRIVED",   false, false, false);
        save(3L, BASE.plusMinutes(180), "CANCELLED", false, false, false);

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("어떤 창에도 해당하지 않는 targetTime 은 조회되지 않아야 함 (60분 → 창 밖)")
    void findPending_outsideAllWindows_shouldNotReturn() {
        save(1L, BASE.plusMinutes(60), null, false, false, false); // 60분 = 어느 창에도 해당 없음

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("미발송 goal 과 기발송 goal 이 혼재할 때 미발송 goal 만 반환해야 함")
    void findPending_mixedSentAndUnsent_shouldReturnOnlyUnsent() {
        save(1L, BASE.plusMinutes(30), null, false, false, false); // 미발송
        save(2L, BASE.plusMinutes(30), null, true,  false, false); // 30min 기발송

        List<GoalSetting> result = queryWith(BASE);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getUserSqno()).isEqualTo(1L);
    }

    // ── findFirstByUserSqnoAndStatusIsNull...OrderByTargetTimeAsc ────────────────

    @Test
    @DisplayName("오늘 이후 가장 가까운 미래 goal 을 반환해야 함")
    void findFirstPendingGoal_shouldReturnEarliestFutureGoal() {
        LocalDateTime startOfToday = LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay();
        LocalDateTime future1 = LocalDateTime.now(ZoneId.of("Asia/Seoul")).plusHours(2);
        LocalDateTime future2 = LocalDateTime.now(ZoneId.of("Asia/Seoul")).plusHours(5);

        save(1L, future2, null, false, false, false); // 더 먼 미래
        save(1L, future1, null, false, false, false); // 더 가까운 미래

        GoalSetting result = goalSettingRepository
                .findFirstByUserSqnoAndStatusIsNullAndTargetTimeGreaterThanEqualOrderByTargetTimeAsc(
                        1L, startOfToday);

        assertThat(result).isNotNull();
        assertThat(result.getTargetTime()).isEqualTo(future1);
    }

    @Test
    @DisplayName("status 가 있는 goal 은 조회 대상에서 제외되어야 함")
    void findFirstPendingGoal_completedGoal_shouldBeExcluded() {
        LocalDateTime startOfToday = LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay();
        LocalDateTime future = LocalDateTime.now(ZoneId.of("Asia/Seoul")).plusHours(1);

        save(1L, future, "COMPLETED", false, false, false);

        GoalSetting result = goalSettingRepository
                .findFirstByUserSqnoAndStatusIsNullAndTargetTimeGreaterThanEqualOrderByTargetTimeAsc(
                        1L, startOfToday);

        assertThat(result).isNull();
    }

    @Test
    @DisplayName("오늘 이전 과거 goal 은 조회 대상에서 제외되어야 함")
    void findFirstPendingGoal_pastGoal_shouldBeExcluded() {
        LocalDateTime startOfToday = LocalDate.now(ZoneId.of("Asia/Seoul")).atStartOfDay();
        LocalDateTime yesterday = LocalDateTime.now(ZoneId.of("Asia/Seoul")).minusDays(1);

        save(1L, yesterday, null, false, false, false);

        GoalSetting result = goalSettingRepository
                .findFirstByUserSqnoAndStatusIsNullAndTargetTimeGreaterThanEqualOrderByTargetTimeAsc(
                        1L, startOfToday);

        assertThat(result).isNull();
    }

    // ── countWeeklyTotal / countWeeklySuccess ────────────────────────────────────

    @Test
    @DisplayName("이번 주 완료된 goal 수 (status IS NOT NULL) 를 올바르게 계산해야 함")
    void countWeeklyTotal_shouldCountNonNullStatus() {
        LocalDateTime weekStart = LocalDate.now(ZoneId.of("Asia/Seoul"))
                .with(DayOfWeek.MONDAY).atStartOfDay();
        LocalDateTime thisWeek = weekStart.plusDays(1);

        save(1L, thisWeek, "success", false, false, false);
        save(1L, thisWeek, "safe",    false, false, false);
        save(1L, thisWeek, "fail",    false, false, false);
        save(1L, thisWeek, null,      false, false, false); // 제외 대상

        long total = goalSettingRepository.countWeeklyTotal(1L, weekStart);

        assertThat(total).isEqualTo(3);
    }

    @Test
    @DisplayName("이번 주 도착 성공 goal 수 (success/safe) 를 올바르게 계산해야 함")
    void countWeeklySuccess_shouldCountOnlySuccessAndSafe() {
        LocalDateTime weekStart = LocalDate.now(ZoneId.of("Asia/Seoul"))
                .with(DayOfWeek.MONDAY).atStartOfDay();
        LocalDateTime thisWeek = weekStart.plusDays(1);

        save(1L, thisWeek, "success", false, false, false);
        save(1L, thisWeek, "safe",    false, false, false);
        save(1L, thisWeek, "fail",    false, false, false); // 제외 대상
        save(1L, thisWeek, null,      false, false, false); // 제외 대상

        long success = goalSettingRepository.countWeeklySuccess(1L, weekStart);

        assertThat(success).isEqualTo(2);
    }

    @Test
    @DisplayName("weekStart 이전 goal 은 집계에서 제외되어야 함")
    void countWeekly_goalBeforeWeekStart_shouldBeExcluded() {
        LocalDateTime weekStart = LocalDate.now(ZoneId.of("Asia/Seoul"))
                .with(DayOfWeek.MONDAY).atStartOfDay();
        LocalDateTime lastWeek = weekStart.minusDays(1);

        save(1L, lastWeek, "success", false, false, false);
        save(1L, lastWeek, "safe",    false, false, false);

        long total   = goalSettingRepository.countWeeklyTotal(1L, weekStart);
        long success = goalSettingRepository.countWeeklySuccess(1L, weekStart);

        assertThat(total).isZero();
        assertThat(success).isZero();
    }

    // ── countMonthlyTotal / countMonthlySuccess / findMonthlyGoals ───────────

    @Test
    @DisplayName("특정 월 완료 goal 수 (status IS NOT NULL) 를 올바르게 계산해야 함")
    void countMonthlyTotal_shouldCountNonNullStatus() {
        LocalDateTime monthStart = LocalDateTime.of(2026, 6, 1, 0, 0);
        LocalDateTime monthEnd   = LocalDateTime.of(2026, 7, 1, 0, 0);
        LocalDateTime inMonth    = LocalDateTime.of(2026, 6, 15, 10, 0);

        save(1L, inMonth, "success", false, false, false);
        save(1L, inMonth, "fail",    false, false, false);
        save(1L, inMonth, null,      false, false, false); // 제외 대상
        save(1L, monthEnd, "success", false, false, false); // 제외 대상 (monthEnd 경계 초과 불포함)

        long total = goalSettingRepository.countMonthlyTotal(1L, monthStart, monthEnd);

        assertThat(total).isEqualTo(2);
    }

    @Test
    @DisplayName("특정 월 성공 goal 수 (success/safe) 를 올바르게 계산해야 함")
    void countMonthlySuccess_shouldCountOnlySuccessAndSafe() {
        LocalDateTime monthStart = LocalDateTime.of(2026, 6, 1, 0, 0);
        LocalDateTime monthEnd   = LocalDateTime.of(2026, 7, 1, 0, 0);
        LocalDateTime inMonth    = LocalDateTime.of(2026, 6, 20, 9, 0);

        save(1L, inMonth, "success", false, false, false);
        save(1L, inMonth, "safe",    false, false, false);
        save(1L, inMonth, "fail",    false, false, false); // 제외
        save(1L, inMonth, null,      false, false, false); // 제외

        long success = goalSettingRepository.countMonthlySuccess(1L, monthStart, monthEnd);

        assertThat(success).isEqualTo(2);
    }

    @Test
    @DisplayName("monthStart 이전 / monthEnd 이후 goal 은 월별 집계에서 제외되어야 함")
    void countMonthly_outOfRangeGoals_shouldBeExcluded() {
        LocalDateTime monthStart = LocalDateTime.of(2026, 6, 1, 0, 0);
        LocalDateTime monthEnd   = LocalDateTime.of(2026, 7, 1, 0, 0);

        save(1L, monthStart.minusDays(1), "success", false, false, false); // 이전 월
        save(1L, monthEnd, "success",               false, false, false); // 다음 월 첫날 경계 제외

        long total   = goalSettingRepository.countMonthlyTotal(1L, monthStart, monthEnd);
        long success = goalSettingRepository.countMonthlySuccess(1L, monthStart, monthEnd);

        assertThat(total).isZero();
        assertThat(success).isZero();
    }

    @Test
    @DisplayName("findMonthlyGoals — 해당 월 goal 목록이 targetTime 오름차순으로 반환되어야 함")
    void findMonthlyGoals_shouldReturnOrderedByTargetTime() {
        LocalDateTime monthStart = LocalDateTime.of(2026, 6, 1, 0, 0);
        LocalDateTime monthEnd   = LocalDateTime.of(2026, 7, 1, 0, 0);

        save(1L, LocalDateTime.of(2026, 6, 20, 9, 0),  "success", false, false, false);
        save(1L, LocalDateTime.of(2026, 6, 5, 14, 0),  "fail",    false, false, false);
        save(1L, LocalDateTime.of(2026, 6, 15, 8, 30), "safe",    false, false, false);
        save(1L, LocalDateTime.of(2026, 5, 31, 23, 59), "success", false, false, false); // 제외

        List<GoalSetting> results = goalSettingRepository.findMonthlyGoals(1L, monthStart, monthEnd);

        assertThat(results).hasSize(3);
        assertThat(results.get(0).getTargetTime()).isBefore(results.get(1).getTargetTime());
        assertThat(results.get(1).getTargetTime()).isBefore(results.get(2).getTargetTime());
    }

    // ── 헬퍼 ────────────────────────────────────────────────────────────────────

    /** ±2분 창으로 findAllPendingNotifications 호출 (실제 스케줄러와 동일한 윈도우) */
    private List<GoalSetting> queryWith(LocalDateTime now) {
        return goalSettingRepository.findAllPendingNotifications(
                now.plusMinutes(28), now.plusMinutes(32),
                now.plusMinutes(88), now.plusMinutes(92),
                now.plusMinutes(178), now.plusMinutes(182)
        );
    }
}
