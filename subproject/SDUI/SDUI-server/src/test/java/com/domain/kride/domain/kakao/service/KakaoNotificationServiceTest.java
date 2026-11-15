package com.domain.kride.domain.kakao.service;

import com.domain.kride.domain.time.domain.GoalSetting;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.service.KakaoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
@ExtendWith(MockitoExtension.class)
@DisplayName("KakaoNotificationService 단위 테스트")
class KakaoNotificationServiceTest {

    @Mock private KakaoService kakaoService;
    @Mock private WebClient webClient;
    @Mock private WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock private WebClient.RequestBodySpec requestBodySpec;
    @Mock private WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock private WebClient.ResponseSpec responseSpec;

    private KakaoNotificationService kakaoNotificationService;
    private User user;
    private GoalSetting goal;

    @BeforeEach
    void setUp() {
        WebClient.Builder builder = mock(WebClient.Builder.class);
        when(builder.build()).thenReturn(webClient);
        kakaoNotificationService = new KakaoNotificationService(kakaoService, builder);

        user = User.builder()
                .userSqno(1L)
                .userId("testUser")
                .kakaoAccessToken("valid-access-token")
                .kakaoTokenExpiresAt(LocalDateTime.now().plusHours(1))
                .build();

        goal = new GoalSetting();
        goal.setId(1L);
        goal.setUserSqno(1L);
        // UTC 05:00 기준으로 저장 (KST 14:00 으로 표시됨)
        goal.setTargetTime(LocalDateTime.of(2026, 3, 18, 5, 0));
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────────────────

    private void mockWebClientPostOk() {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.header(anyString(), anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.just("success"));
    }

    private void mockWebClientPostThrow(RuntimeException ex) {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.header(anyString(), anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(Mono.error(ex));
    }

    // ── 정상 발송 케이스 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("30분 전 알림: webClient.post() 가 1회 호출되어야 함")
    void sendReminder_30min_shouldCallPost() {
        mockWebClientPostOk();
        kakaoNotificationService.sendReminder(user, goal, 30);
        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("90분 전 알림: webClient.post() 가 1회 호출되어야 함")
    void sendReminder_90min_shouldCallPost() {
        mockWebClientPostOk();
        kakaoNotificationService.sendReminder(user, goal, 90);
        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("180분 전 알림: webClient.post() 가 1회 호출되어야 함")
    void sendReminder_180min_shouldCallPost() {
        mockWebClientPostOk();
        kakaoNotificationService.sendReminder(user, goal, 180);
        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("메모(todaysMessage)가 있으면 HTTP 요청이 실행되어야 함")
    void sendReminder_withMemo_shouldSendMessage() {
        goal.setTodaysMessage("오늘도 화이팅!");
        mockWebClientPostOk();
        kakaoNotificationService.sendReminder(user, goal, 30);
        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("메모가 null 이면 HTTP 요청이 실행되어야 함 (메모 없이 발송)")
    void sendReminder_nullMemo_shouldSendWithoutMemo() {
        goal.setTodaysMessage(null);
        mockWebClientPostOk();
        kakaoNotificationService.sendReminder(user, goal, 30);
        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("메모가 빈 문자열이면 HTTP 요청이 실행되어야 함 (메모 없이 발송)")
    void sendReminder_blankMemo_shouldSendWithoutMemo() {
        goal.setTodaysMessage("   ");
        mockWebClientPostOk();
        kakaoNotificationService.sendReminder(user, goal, 30);
        verify(webClient, times(1)).post();
    }

    // ── 토큰 관련 케이스 ────────────────────────────────────────────────────────

    @Test
    @DisplayName("카카오 토큰이 null 이면 HTTP 호출 없이 즉시 반환해야 함")
    void sendReminder_nullToken_shouldSkipHttpCall() {
        user.setKakaoAccessToken(null);
        kakaoNotificationService.sendReminder(user, goal, 30);
        verify(webClient, never()).post();
    }

    @Test
    @DisplayName("토큰 만료 5분 이내이면 refreshKakaoToken 을 호출해야 함")
    void sendReminder_tokenExpiringWithin5min_shouldRefresh() {
        user.setKakaoTokenExpiresAt(LocalDateTime.now().plusMinutes(3));
        when(kakaoService.refreshKakaoToken(user)).thenReturn("new-access-token");
        mockWebClientPostOk();

        kakaoNotificationService.sendReminder(user, goal, 30);

        verify(kakaoService, times(1)).refreshKakaoToken(user);
        verify(webClient, times(1)).post();
    }

    @Test
    @DisplayName("토큰 갱신 후 새 토큰이 null 이면 HTTP 호출 없이 반환해야 함")
    void sendReminder_refreshReturnsNull_shouldSkipHttpCall() {
        user.setKakaoTokenExpiresAt(LocalDateTime.now().plusMinutes(3));
        when(kakaoService.refreshKakaoToken(user)).thenReturn(null);

        kakaoNotificationService.sendReminder(user, goal, 30);

        verify(kakaoService, times(1)).refreshKakaoToken(user);
        verify(webClient, never()).post();
    }

    @Test
    @DisplayName("토큰이 충분히 유효하면 refreshKakaoToken 을 호출하지 않아야 함")
    void sendReminder_validToken_shouldNotRefresh() {
        user.setKakaoTokenExpiresAt(LocalDateTime.now().plusHours(1));
        mockWebClientPostOk();

        kakaoNotificationService.sendReminder(user, goal, 30);

        verify(kakaoService, never()).refreshKakaoToken(any());
    }

    // ── 예외 케이스 ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("REST 호출 실패 시 RuntimeException('카카오 알림 발송 실패')을 던져야 함")
    void sendReminder_httpError_shouldThrowRuntimeException() {
        mockWebClientPostThrow(new RuntimeException("Connection refused"));

        assertThatThrownBy(() -> kakaoNotificationService.sendReminder(user, goal, 30))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("카카오 알림 발송 실패");
    }
}
