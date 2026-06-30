package com.domain.demo_backend.domain.kakao.service;

import com.domain.demo_backend.domain.time.domain.GoalSetting;
import com.domain.demo_backend.domain.time.domain.GoalSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
@ExtendWith(MockitoExtension.class)
@DisplayName("SlackNotificationService 단위 테스트")
class SlackNotificationServiceTest {

    @Mock private GoalSettingRepository goalSettingRepository;
    @Mock private WebClient webClient;
    @Mock private WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock private WebClient.RequestBodySpec requestBodySpec;
    @Mock private WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock private WebClient.ResponseSpec responseSpec;

    private SlackNotificationService slackNotificationService;
    private GoalSetting goal;

    @BeforeEach
    void setUp() {
        WebClient.Builder builder = mock(WebClient.Builder.class);
        when(builder.build()).thenReturn(webClient);
        slackNotificationService = new SlackNotificationService(goalSettingRepository, builder);

        goal = new GoalSetting();
        goal.setId(1L);
        goal.setUserSqno(1L);
        goal.setTargetTime(LocalDateTime.of(2026, 3, 18, 9, 0));
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

    private void setWebhookUrl(String url) {
        ReflectionTestUtils.setField(slackNotificationService, "webhookUrl", url);
    }

    // ── webhook URL 미설정 시 skip ─────────────────────────────────────────────

    @Test
    @DisplayName("webhook URL 이 빈 문자열이면 HTTP 호출 없이 skip 해야 함")
    void sendReminder_noWebhookUrl_shouldSkip() {
        setWebhookUrl("");

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, never()).post();
    }

    @Test
    @DisplayName("webhook URL 이 null 이면 HTTP 호출 없이 skip 해야 함")
    void sendReminder_nullWebhookUrl_shouldSkip() {
        setWebhookUrl(null);

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, never()).post();
    }

    // ── 정상 발송 케이스 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("30분 창: webhook URL 설정 시 HTTP POST 가 1회 호출되어야 함")
    void sendReminder_30min_shouldCallPost() {
        setWebhookUrl("https://hooks.slack.com/test");
        when(goalSettingRepository.countWeeklyTotal(anyLong(), any())).thenReturn(5L);
        when(goalSettingRepository.countWeeklySuccess(anyLong(), any())).thenReturn(3L);
        mockWebClientPostOk();

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("90분 창: webhook URL 설정 시 HTTP POST 가 1회 호출되어야 함")
    void sendReminder_90min_shouldCallPost() {
        setWebhookUrl("https://hooks.slack.com/test");
        when(goalSettingRepository.countWeeklyTotal(anyLong(), any())).thenReturn(0L);
        when(goalSettingRepository.countWeeklySuccess(anyLong(), any())).thenReturn(0L);
        mockWebClientPostOk();

        slackNotificationService.sendReminder(goal, 90);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("180분 창: webhook URL 설정 시 HTTP POST 가 1회 호출되어야 함")
    void sendReminder_180min_shouldCallPost() {
        setWebhookUrl("https://hooks.slack.com/test");
        when(goalSettingRepository.countWeeklyTotal(anyLong(), any())).thenReturn(0L);
        when(goalSettingRepository.countWeeklySuccess(anyLong(), any())).thenReturn(0L);
        mockWebClientPostOk();

        slackNotificationService.sendReminder(goal, 180);

        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("각오(todaysMessage)가 있으면 HTTP POST 가 호출되어야 함")
    void sendReminder_withMessage_shouldCallPost() {
        goal.setTodaysMessage("오늘은 꼭 일찍!");
        setWebhookUrl("https://hooks.slack.com/test");
        when(goalSettingRepository.countWeeklyTotal(anyLong(), any())).thenReturn(0L);
        when(goalSettingRepository.countWeeklySuccess(anyLong(), any())).thenReturn(0L);
        mockWebClientPostOk();

        slackNotificationService.sendReminder(goal, 30);

        verify(webClient, times(1)).post();
    }

    // ── HTTP 오류 시 예외를 외부로 전파하지 않아야 함 ────────────────────────────

    @Test
    @DisplayName("HTTP 오류가 발생해도 예외를 외부로 전파하지 않아야 함 (내부 처리)")
    void sendReminder_httpError_shouldNotPropagate() {
        setWebhookUrl("https://hooks.slack.com/test");
        when(goalSettingRepository.countWeeklyTotal(anyLong(), any())).thenReturn(0L);
        when(goalSettingRepository.countWeeklySuccess(anyLong(), any())).thenReturn(0L);

        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.error(new RuntimeException("webhook error")));

        // 예외가 전파되지 않아야 함
        slackNotificationService.sendReminder(goal, 30);
    }

    // ── sendAlert 케이스 ──────────────────────────────────────────────────────

    @Test
    @DisplayName("sendAlert: webhook URL 미설정 시 HTTP 호출 없이 skip 해야 함")
    void sendAlert_noWebhookUrl_shouldSkip() {
        setWebhookUrl("");

        slackNotificationService.sendAlert("운영 알림 테스트");

        verify(webClient, never()).post();
    }

    @Test
    @DisplayName("sendAlert: webhook URL 설정 시 HTTP POST 가 1회 호출되어야 함")
    void sendAlert_withWebhookUrl_shouldCallPost() {
        setWebhookUrl("https://hooks.slack.com/test");
        mockWebClientPostOk();

        slackNotificationService.sendAlert("운영 알림 테스트");

        verify(webClient, times(1)).post();
    }
}
