package com.domain.demo_backend.domain.kakao.scheduler;

import com.domain.demo_backend.domain.kakao.service.KakaoNotificationService;
import com.domain.demo_backend.domain.kakao.service.SlackNotificationService;
import com.domain.demo_backend.domain.time.domain.GoalSetting;
import com.domain.demo_backend.domain.time.domain.GoalSettingRepository;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AppointmentNotificationScheduler 단위 테스트")
class AppointmentNotificationSchedulerTest {

    @Mock
    private GoalSettingRepository goalRepo;

    @Mock
    private UserRepository userRepo;

    @Mock
    private KakaoNotificationService notifService;

    @Mock
    private SlackNotificationService slackNotifService;

    @InjectMocks
    private AppointmentNotificationScheduler scheduler;

    private User mockUser;

    @BeforeEach
    void setUp() {
        mockUser = User.builder()
                .userSqno(1L)
                .userId("testUser")
                .kakaoAccessToken("valid-token")
                .build();
    }

    /** targetTime = 지금으로부터 minutesLater 분 후 (KST 기준) */
    private GoalSetting goalAtMinutesFromNow(int minutesLater) {
        GoalSetting g = new GoalSetting();
        g.setId(1L);
        g.setUserSqno(1L);
        g.setTargetTime(LocalDateTime.now(ZoneId.of("Asia/Seoul")).plusMinutes(minutesLater));
        return g;
    }

    // ── 정상 발송 케이스 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("30분 창: sendReminder(30) 호출 후 notifSent30min=true 로 저장되어야 함")
    void checkAndSend_30minWindow_shouldSendAndMarkSent() {
        GoalSetting goal = goalAtMinutesFromNow(30);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));

        scheduler.checkAndSendNotifications();

        verify(notifService, times(1)).sendReminder(mockUser, goal, 30);
        assertThat(goal.isNotifSent30min()).isTrue();
        verify(goalRepo, times(1)).save(goal);
    }

    @Test
    @DisplayName("90분 창: sendReminder(90) 호출 후 notifSent90min=true 로 저장되어야 함")
    void checkAndSend_90minWindow_shouldSendAndMarkSent() {
        GoalSetting goal = goalAtMinutesFromNow(90);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));

        scheduler.checkAndSendNotifications();

        verify(notifService, times(1)).sendReminder(mockUser, goal, 90);
        assertThat(goal.isNotifSent90min()).isTrue();
        verify(goalRepo, times(1)).save(goal);
    }

    @Test
    @DisplayName("180분 창: sendReminder(180) 호출 후 notifSent180min=true 로 저장되어야 함")
    void checkAndSend_180minWindow_shouldSendAndMarkSent() {
        GoalSetting goal = goalAtMinutesFromNow(180);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));

        scheduler.checkAndSendNotifications();

        verify(notifService, times(1)).sendReminder(mockUser, goal, 180);
        assertThat(goal.isNotifSent180min()).isTrue();
        verify(goalRepo, times(1)).save(goal);
    }

    // ── 중복 방지 케이스 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("notifSent30min=true 이면 30분 알림을 재발송하지 않아야 함")
    void checkAndSend_alreadySent30min_shouldSkip() {
        GoalSetting goal = goalAtMinutesFromNow(30);
        goal.setNotifSent30min(true); // 이미 발송됨

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));

        scheduler.checkAndSendNotifications();

        verify(notifService, never()).sendReminder(any(), any(), eq(30));
        verify(goalRepo, never()).save(any());
    }

    @Test
    @DisplayName("notifSent90min=true 이면 90분 알림을 재발송하지 않아야 함")
    void checkAndSend_alreadySent90min_shouldSkip() {
        GoalSetting goal = goalAtMinutesFromNow(90);
        goal.setNotifSent90min(true);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));

        scheduler.checkAndSendNotifications();

        verify(notifService, never()).sendReminder(any(), any(), eq(90));
    }

    // ── 건너뛰기 케이스 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("카카오 토큰이 null 인 유저는 모든 알림을 건너뛰어야 함")
    void checkAndSend_noKakaoToken_shouldSkipAll() {
        mockUser.setKakaoAccessToken(null);
        GoalSetting goal = goalAtMinutesFromNow(30);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));

        scheduler.checkAndSendNotifications();

        verify(notifService, never()).sendReminder(any(), any(), anyInt());
        verify(goalRepo, never()).save(any());
    }

    @Test
    @DisplayName("DB에 pending 알림이 없으면 아무것도 발송하지 않아야 함")
    void checkAndSend_noPendingGoals_shouldDoNothing() {
        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(Collections.emptyList());

        scheduler.checkAndSendNotifications();

        verify(notifService, never()).sendReminder(any(), any(), anyInt());
        verify(goalRepo, never()).save(any());
        verifyNoInteractions(userRepo);
    }

    @Test
    @DisplayName("userRepo 에 userId 가 없으면 알림을 발송하지 않아야 함")
    void checkAndSend_userNotFound_shouldSkip() {
        GoalSetting goal = goalAtMinutesFromNow(30);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.empty());

        scheduler.checkAndSendNotifications();

        verify(notifService, never()).sendReminder(any(), any(), anyInt());
    }

    // ── 예외 처리 케이스 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("Kakao sendReminder 예외 발생 시 notifSent 플래그를 저장하지 않아야 함")
    void checkAndSend_serviceThrows_shouldNotSaveFlag() {
        GoalSetting goal = goalAtMinutesFromNow(30);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));
        doThrow(new RuntimeException("Kakao API error"))
                .when(notifService).sendReminder(any(), any(), anyInt());

        scheduler.checkAndSendNotifications();

        verify(goalRepo, never()).save(any());
        assertThat(goal.isNotifSent30min()).isFalse();
    }

    @Test
    @DisplayName("Kakao 실패 시에도 Slack sendReminder 는 호출되어야 함 (독립 실행)")
    void checkAndSend_kakaoFails_slackShouldStillRun() {
        GoalSetting goal = goalAtMinutesFromNow(30);

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));
        doThrow(new RuntimeException("Kakao API error"))
                .when(notifService).sendReminder(any(), any(), anyInt());

        scheduler.checkAndSendNotifications();

        // Kakao 실패에도 불구하고 Slack 은 반드시 호출되어야 함
        verify(slackNotifService, times(1)).sendReminder(goal, 30);
    }

    @Test
    @DisplayName("첫 번째 goal 예외 발생 시 두 번째 goal 는 정상 처리되어야 함")
    void checkAndSend_firstGoalThrows_shouldContinueToSecond() {
        GoalSetting goal1 = goalAtMinutesFromNow(30);
        goal1.setId(1L);
        goal1.setUserSqno(1L);

        GoalSetting goal2 = new GoalSetting();
        goal2.setId(2L);
        goal2.setUserSqno(2L);
        goal2.setTargetTime(LocalDateTime.now(ZoneId.of("Asia/Seoul")).plusMinutes(30));

        User mockUser2 = User.builder()
                .userSqno(2L)
                .userId("testUser2")
                .kakaoAccessToken("token2")
                .build();

        when(goalRepo.findAllPendingNotifications(any(), any(), any(), any(), any(), any()))
                .thenReturn(List.of(goal1, goal2));
        when(userRepo.findById(1L)).thenReturn(Optional.of(mockUser));
        when(userRepo.findById(2L)).thenReturn(Optional.of(mockUser2));

        doThrow(new RuntimeException("API error"))
                .when(notifService).sendReminder(eq(mockUser), any(), anyInt());
        doNothing()
                .when(notifService).sendReminder(eq(mockUser2), any(), anyInt());

        scheduler.checkAndSendNotifications();

        verify(notifService, times(1)).sendReminder(eq(mockUser2), any(), anyInt());
        assertThat(goal2.isNotifSent30min()).isTrue();
        verify(goalRepo, times(1)).save(goal2);
    }
}
