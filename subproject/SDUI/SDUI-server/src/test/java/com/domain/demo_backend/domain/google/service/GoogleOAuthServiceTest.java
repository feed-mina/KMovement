package com.domain.demo_backend.domain.google.service;

import com.domain.demo_backend.domain.google.domain.GoogleOAuthToken;
import com.domain.demo_backend.domain.google.domain.GoogleOAuthTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings({"unchecked", "rawtypes"})
@ExtendWith(MockitoExtension.class)
@DisplayName("GoogleOAuthService 단위 테스트")
class GoogleOAuthServiceTest {

    @Mock private GoogleOAuthTokenRepository tokenRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private WebClient webClient;
    @Mock private WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock private WebClient.RequestBodySpec requestBodySpec;
    @Mock private WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock private WebClient.ResponseSpec responseSpec;

    private GoogleOAuthService googleOAuthService;

    @BeforeEach
    void setUp() {
        WebClient.Builder builder = mock(WebClient.Builder.class);
        when(builder.build()).thenReturn(webClient);
        // lenient: opsForValue() is only used by token-caching tests, not all tests
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);

        googleOAuthService = new GoogleOAuthService(tokenRepository, redisTemplate, builder);
        ReflectionTestUtils.setField(googleOAuthService, "clientId",     "test-client-id");
        ReflectionTestUtils.setField(googleOAuthService, "clientSecret", "test-client-secret");
        ReflectionTestUtils.setField(googleOAuthService, "redirectUri",  "https://example.com/callback");
    }

    // ── 헬퍼 ──────────────────────────────────────────────────────────────────

    private void mockWebClientPostOk(Map<?, ?> responseBody) {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(Mono.just(responseBody));
    }

    // ── isConnected ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("clientId 가 비어 있으면 isConnected 는 false 를 반환해야 함")
    void isConnected_emptyClientId_shouldReturnFalse() {
        ReflectionTestUtils.setField(googleOAuthService, "clientId", "");

        boolean result = googleOAuthService.isConnected(1L);

        assertThat(result).isFalse();
        verifyNoInteractions(tokenRepository);
    }

    @Test
    @DisplayName("토큰 레코드가 있으면 isConnected 는 true 를 반환해야 함")
    void isConnected_tokenExists_shouldReturnTrue() {
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.of(new GoogleOAuthToken()));

        boolean result = googleOAuthService.isConnected(1L);

        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("토큰 레코드가 없으면 isConnected 는 false 를 반환해야 함")
    void isConnected_tokenAbsent_shouldReturnFalse() {
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.empty());

        boolean result = googleOAuthService.isConnected(1L);

        assertThat(result).isFalse();
    }

    // ── exchangeCode ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("exchangeCode: 응답에 access_token 이 있으면 토큰을 저장하고 Redis 에 캐싱해야 함")
    void exchangeCode_success_shouldSaveAndCache() {
        Map<?, ?> tokenResponse = Map.of(
                "access_token", "new-access-token",
                "refresh_token", "new-refresh-token",
                "expires_in", 3600);
        mockWebClientPostOk(tokenResponse);
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.empty());
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        googleOAuthService.exchangeCode("auth-code-123", 1L);

        verify(tokenRepository, times(1)).save(argThat(t ->
                "new-access-token".equals(t.getAccessToken()) &&
                "new-refresh-token".equals(t.getRefreshToken())));
        verify(valueOps, times(1)).set(eq("GOOGLE_TOKEN:1"), eq("new-access-token"), any());
    }

    @Test
    @DisplayName("exchangeCode: 응답에 access_token 이 없으면 RuntimeException 을 던져야 함")
    void exchangeCode_noAccessToken_shouldThrow() {
        mockWebClientPostOk(Map.of());

        assertThatThrownBy(() -> googleOAuthService.exchangeCode("bad-code", 1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("토큰 교환 실패");
    }

    @Test
    @DisplayName("exchangeCode: 특수문자 포함 code 도 정상 처리되어야 함 (MultiValueMap URL 인코딩)")
    void exchangeCode_codeWithSpecialChars_shouldNotThrow() {
        String codeWithSpecialChars = "4/0AX4XfWj+special=chars&more";
        Map<?, ?> tokenResponse = Map.of(
                "access_token", "token",
                "refresh_token", "refresh",
                "expires_in", 3600);
        mockWebClientPostOk(tokenResponse);
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.empty());
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // 특수문자가 있어도 MultiValueMap 이 URL 인코딩을 처리하므로 예외 없이 완료되어야 함
        googleOAuthService.exchangeCode(codeWithSpecialChars, 1L);

        verify(tokenRepository, times(1)).save(any());
    }

    // ── getValidAccessToken ───────────────────────────────────────────────────

    @Test
    @DisplayName("Redis 캐시에 토큰이 있으면 DB 조회 없이 반환해야 함")
    void getValidAccessToken_cachedInRedis_shouldReturnFromCache() {
        when(valueOps.get("GOOGLE_TOKEN:1")).thenReturn("cached-token");

        String token = googleOAuthService.getValidAccessToken(1L);

        assertThat(token).isEqualTo("cached-token");
        verifyNoInteractions(tokenRepository);
    }

    @Test
    @DisplayName("Redis 캐시 미스 + 토큰 미만료 → DB 토큰을 반환하고 Redis 에 캐싱해야 함")
    void getValidAccessToken_noCacheTokenValid_shouldReturnFromDb() {
        when(valueOps.get("GOOGLE_TOKEN:1")).thenReturn(null);

        GoogleOAuthToken token = new GoogleOAuthToken();
        token.setUserSqno(1L);
        token.setAccessToken("db-token");
        token.setRefreshToken("refresh-token");
        token.setTokenExpiry(OffsetDateTime.now().plusHours(1));
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.of(token));

        String result = googleOAuthService.getValidAccessToken(1L);

        assertThat(result).isEqualTo("db-token");
        verify(valueOps, times(1)).set(eq("GOOGLE_TOKEN:1"), eq("db-token"), any());
    }

    @Test
    @DisplayName("토큰이 없으면 RuntimeException 을 던져야 함")
    void getValidAccessToken_noToken_shouldThrow() {
        when(valueOps.get("GOOGLE_TOKEN:1")).thenReturn(null);
        when(tokenRepository.findByUserSqno(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> googleOAuthService.getValidAccessToken(1L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("구글 캘린더 미연결");
    }

    // ── refreshAccessToken ────────────────────────────────────────────────────

    @Test
    @DisplayName("refreshAccessToken: 성공 시 새 토큰을 저장하고 Redis 에 캐싱해야 함")
    void refreshAccessToken_success_shouldSaveAndCache() {
        Map<?, ?> tokenResponse = Map.of(
                "access_token", "refreshed-token",
                "expires_in", 3600);
        mockWebClientPostOk(tokenResponse);
        when(tokenRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GoogleOAuthToken token = new GoogleOAuthToken();
        token.setUserSqno(1L);
        token.setAccessToken("old-token");
        token.setRefreshToken("refresh-token");
        token.setTokenExpiry(OffsetDateTime.now().minusMinutes(1));

        String result = googleOAuthService.refreshAccessToken(1L, token);

        assertThat(result).isEqualTo("refreshed-token");
        verify(valueOps, times(1)).set(eq("GOOGLE_TOKEN:1"), eq("refreshed-token"), any());
    }

    @Test
    @DisplayName("refreshAccessToken: 응답에 access_token 이 없으면 RuntimeException 을 던져야 함")
    void refreshAccessToken_noAccessToken_shouldThrow() {
        mockWebClientPostOk(Map.of());

        GoogleOAuthToken token = new GoogleOAuthToken();
        token.setRefreshToken("refresh-token");

        assertThatThrownBy(() -> googleOAuthService.refreshAccessToken(1L, token))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("토큰 갱신 실패");
    }

    // ── revokeToken ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("revokeToken: Redis 캐시 삭제 + DB 레코드 삭제가 호출되어야 함")
    void revokeToken_shouldDeleteCacheAndDb() {
        googleOAuthService.revokeToken(1L);

        verify(redisTemplate, times(1)).delete("GOOGLE_TOKEN:1");
        verify(tokenRepository, times(1)).deleteByUserSqno(1L);
    }
}
