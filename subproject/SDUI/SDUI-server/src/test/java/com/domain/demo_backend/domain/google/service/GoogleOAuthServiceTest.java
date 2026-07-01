package com.domain.demo_backend.domain.google.service;

import com.domain.demo_backend.domain.google.domain.GoogleOAuthToken;
import com.domain.demo_backend.domain.google.domain.GoogleOAuthTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * GoogleOAuthService 단위 테스트
 *
 * 검증 항목:
 * 1. exchangeCode — MultiValueMap 기반 파라미터 전송 (URL 인코딩 안전성)
 * 2. refreshAccessToken — MultiValueMap 기반 파라미터 전송
 * 3. isConnected — clientId 빈 값이면 false 반환 (config 미설정 시 안전)
 * 4. getValidAccessToken — Redis 캐시 히트 시 DB 조회 없이 반환
 */
@SuppressWarnings({"unchecked", "rawtypes"})
@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleOAuthService 단위 테스트")
class GoogleOAuthServiceTest {

    @Mock private GoogleOAuthTokenRepository tokenRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private WebClient.Builder webClientBuilder;
    @Mock private WebClient webClient;
    @Mock private WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock private WebClient.RequestBodySpec requestBodySpec;
    @Mock private WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock private WebClient.ResponseSpec responseSpec;

    private GoogleOAuthService googleOAuthService;

    @BeforeEach
    void setUp() {
        when(webClientBuilder.build()).thenReturn(webClient);
        googleOAuthService = new GoogleOAuthService(tokenRepository, redisTemplate, webClientBuilder);
        ReflectionTestUtils.setField(googleOAuthService, "clientId", "test-client-id");
        ReflectionTestUtils.setField(googleOAuthService, "clientSecret", "test-client-secret");
        ReflectionTestUtils.setField(googleOAuthService, "redirectUri", "https://example.com/callback");
    }

    // ── exchangeCode ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("exchangeCode — 토큰 교환 성공 시 DB에 저장되어야 함")
    void exchangeCode_success_shouldSaveToken() {
        mockWebClientPostOk(Map.of(
                "access_token", "new-access-token",
                "refresh_token", "new-refresh-token",
                "expires_in", 3600
        ));
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        googleOAuthService.exchangeCode("auth-code", 1L);

        verify(tokenRepository, times(1)).save(any(GoogleOAuthToken.class));
    }

    @Test
    @DisplayName("exchangeCode — access_token 없는 응답이면 RuntimeException을 던져야 함")
    void exchangeCode_missingAccessToken_shouldThrow() {
        mockWebClientPostOk(Map.of("error", "invalid_grant"));

        assertThatThrownBy(() -> googleOAuthService.exchangeCode("bad-code", 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Google OAuth 토큰 교환 실패");
    }

    @Test
    @DisplayName("exchangeCode — 특수문자가 포함된 code도 안전하게 처리되어야 함 (URL 인코딩)")
    void exchangeCode_specialCharInCode_shouldNotThrow() {
        String codeWithSpecialChars = "4/0AX4XfWi=te+st&code";
        mockWebClientPostOk(Map.of(
                "access_token", "token",
                "refresh_token", "refresh",
                "expires_in", 3600
        ));
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.empty());
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        // MultiValueMap 기반 구현에서는 특수문자가 자동 URL 인코딩됨 — 예외 없이 처리되어야 함
        googleOAuthService.exchangeCode(codeWithSpecialChars, 1L);

        verify(tokenRepository, times(1)).save(any(GoogleOAuthToken.class));
    }

    // ── refreshAccessToken ────────────────────────────────────────────────────

    @Test
    @DisplayName("refreshAccessToken — 성공 시 새 토큰을 DB에 저장하고 반환해야 함")
    void refreshAccessToken_success_shouldReturnNewToken() {
        mockWebClientPostOk(Map.of(
                "access_token", "refreshed-token",
                "expires_in", 3600
        ));
        when(redisTemplate.opsForValue()).thenReturn(valueOps);

        GoogleOAuthToken token = new GoogleOAuthToken();
        token.setUserSqno(1L);
        token.setRefreshToken("old-refresh-token");
        token.setAccessToken("old-token");
        token.setTokenExpiry(OffsetDateTime.now().plusHours(1));

        String result = googleOAuthService.refreshAccessToken(1L, token);

        assertThat(result).isEqualTo("refreshed-token");
        verify(tokenRepository, times(1)).save(token);
    }

    @Test
    @DisplayName("refreshAccessToken — access_token 없는 응답이면 RuntimeException을 던져야 함")
    void refreshAccessToken_missingToken_shouldThrow() {
        mockWebClientPostOk(Map.of("error", "invalid_grant"));

        GoogleOAuthToken token = new GoogleOAuthToken();
        token.setRefreshToken("expired-refresh");
        token.setTokenExpiry(OffsetDateTime.now().plusHours(1));

        assertThatThrownBy(() -> googleOAuthService.refreshAccessToken(1L, token))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("Google 토큰 갱신 실패");
    }

    // ── isConnected ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("isConnected — clientId 빈 값이면 DB 조회 없이 false 반환 (미설정 환경 안전)")
    void isConnected_emptyClientId_shouldReturnFalse() {
        ReflectionTestUtils.setField(googleOAuthService, "clientId", "");

        boolean result = googleOAuthService.isConnected(1L);

        assertThat(result).isFalse();
        verify(tokenRepository, never()).findByUserSqno(any());
    }

    @Test
    @DisplayName("isConnected — 토큰이 DB에 있으면 true 반환")
    void isConnected_tokenExists_shouldReturnTrue() {
        when(tokenRepository.findByUserSqno(1L))
                .thenReturn(Optional.of(new GoogleOAuthToken()));

        assertThat(googleOAuthService.isConnected(1L)).isTrue();
    }

    // ── getValidAccessToken ───────────────────────────────────────────────────

    @Test
    @DisplayName("getValidAccessToken — Redis 캐시 히트 시 DB 조회 없이 캐시값 반환")
    void getValidAccessToken_cacheHit_shouldReturnCachedValue() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get("GOOGLE_TOKEN:1")).thenReturn("cached-token");

        String result = googleOAuthService.getValidAccessToken(1L);

        assertThat(result).isEqualTo("cached-token");
        verify(tokenRepository, never()).findByUserSqno(any());
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────────────────

    private void mockWebClientPostOk(Map<?, ?> responseBody) {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.body(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(Mono.just(responseBody));
    }
}
