package com.domain.demo_backend.domain.kakao.service;

import com.domain.demo_backend.domain.time.domain.GoalSetting;
import com.domain.demo_backend.domain.time.domain.GoalSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * SlackNotificationService 단위 테스트
 *
 * 검증 항목:
 * 1. webhook-url 미설정 시 HTTP 호출 없이 skip (fallback 동작)
 * 2. 정상 발송 시 webClient.post() 1회 호출
 * 3. HTTP 호출 실패 시 예외가 호출측으로 전파되지 않음 (best-effort)
 * 4. 각오(todaysMessage)가 있을 때/없을 때 모두 발송 성공
 */
@SuppressWarnings({"unchecked", "rawtypes"})
@ExtendWith(MockitoExtension.class)
@DisplayName("SlackNotificationService 단위 테스트")
class SlackNotificationServiceTest {

    @Mock private GoalSettingRepository goalSettingRepo;
    @Mock private WebClient webClient;
    @Mock private WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock private WebClient.RequestBodySpec requestBodySpec;
    @Mock private WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock private WebClient.ResponseSpec responseSpec;

    private SlackNotificationService slackNotificationService;

    private GoalSetting goal;

    @BeforeEach
    void setUp() {
        slackNotificationService = new SlackNotificationService(goalSettingRepo);
        // WebClient 필드를 mock으로 교체 (SlackNotificationService는 WebClient.create()로 생성하므로)
        ReflectionTestUtils.setField(slackNotificationService, "webClient", webClient);
        ReflectionTestUtils.setField(slackNotificationService, "webhookUrl", "https://hooks.slack.com/test");
        ReflectionTestUtils.setField(slackNotificationService, "targetUserId", "U0TEST");

        goal = new GoalSetting();
        goal.setId(1L);
        goal.setUserSqno(1L);
        goal.setTargetTime(LocalDateTime.of(2026, 6, 30, 14, 0));
    }

    // ── fallback (webhook URL 미설정) ─────────────────────────────────────────

    @Test
    @DisplayName("webhook-url 미설정 시 HTTP 호출 없이 즉시 반환해야 함 (개발 환경 안전)")
    void sendReminder_noWebhookUrl_shouldSkipHttpCall() {
        ReflectionTestUtils.setField(slackNotificationService, "webhookUrl", "");

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, never()).post();
    }

    @Test
    @DisplayName("webhook-url null일 때도 HTTP 호출 없이 반환해야 함")
    void sendReminder_nullWebhookUrl_shouldSkipHttpCall() {
        ReflectionTestUtils.setField(slackNotificationService, "webhookUrl", null);

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, never()).post();
    }

    // ── 정상 발송 ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("30분 전 알림: webClient.post() 1회 호출되어야 함")
    void sendReminder_30min_shouldCallPost() {
        mockWebClientPostOk();
        mockWeeklyStats(3, 2);

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("90분 전 알림: webClient.post() 1회 호출되어야 함")
    void sendReminder_90min_shouldCallPost() {
        mockWebClientPostOk();
        mockWeeklyStats(5, 4);

        slackNotificationService.sendReminder(goal, 90);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("180분 전 알림: webClient.post() 1회 호출되어야 함")
    void sendReminder_180min_shouldCallPost() {
        mockWebClientPostOk();
        mockWeeklyStats(0, 0);

        slackNotificationService.sendReminder(goal, 180);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("각오(todaysMessage)가 있으면 정상 발송되어야 함")
    void sendReminder_withMemo_shouldSend() {
        goal.setTodaysMessage("오늘도 화이팅!");
        mockWebClientPostOk();
        mockWeeklyStats(2, 1);

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("각오(todaysMessage)가 null이어도 정상 발송되어야 함")
    void sendReminder_nullMemo_shouldSend() {
        goal.setTodaysMessage(null);
        mockWebClientPostOk();
        mockWeeklyStats(1, 1);

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, times(1)).post();
    }

    // ── HTTP 실패 시 예외 전파 없음 (best-effort) ────────────────────────────

    @Test
    @DisplayName("HTTP 호출 실패 시 예외가 호출측으로 전파되지 않아야 함")
    void sendReminder_httpError_shouldNotPropagateException() {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.error(new RuntimeException("Connection refused")));
        mockWeeklyStats(1, 0);

        // SlackNotificationService는 내부 예외를 처리하므로 예외가 전파되면 안 됨
        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, times(1)).post();
    }

    // ── sendAlert ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendAlert — webhook URL 미설정 시 HTTP 호출 없이 반환")
    void sendAlert_noWebhookUrl_shouldSkip() {
        ReflectionTestUtils.setField(slackNotificationService, "webhookUrl", "");

        slackNotificationService.sendAlert("테스트 운영 알림");

        verify(webClient, never()).post();
    }

    @Test
    @DisplayName("sendAlert — webhook URL 설정 시 HTTP 호출 1회")
    void sendAlert_withWebhookUrl_shouldCallPost() {
        mockWebClientPostTextOk();

        slackNotificationService.sendAlert("테스트 운영 알림");

        verify(webClient, times(1)).post();
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────────────────

    private void mockWebClientPostOk() {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just("ok"));
    }

    private void mockWebClientPostTextOk() {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just("ok"));
    }

    private void mockWeeklyStats(long total, long success) {
        LocalDateTime weekStart = LocalDate.now(ZoneId.of("Asia/Seoul"))
                .with(DayOfWeek.MONDAY).atStartOfDay();
        when(goalSettingRepo.countWeeklyTotal(eq(1L), any(LocalDateTime.class))).thenReturn(total);
        when(goalSettingRepo.countWeeklySuccess(eq(1L), any(LocalDateTime.class))).thenReturn(success);
    }
}
