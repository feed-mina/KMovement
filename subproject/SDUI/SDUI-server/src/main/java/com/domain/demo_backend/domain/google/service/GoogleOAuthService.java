package com.domain.demo_backend.domain.google.service;

import com.domain.demo_backend.domain.google.domain.GoogleOAuthToken;
import com.domain.demo_backend.domain.google.domain.GoogleOAuthTokenRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import org.springframework.http.MediaType;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;

@Service
public class GoogleOAuthService {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthService.class);
    private static final String REDIS_KEY_PREFIX = "GOOGLE_TOKEN:";
    private static final String AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN_URL = "https://oauth2.googleapis.com/token";

    @Value("${google.oauth.client-id:}")
    private String clientId;

    @Value("${google.oauth.client-secret:}")
    private String clientSecret;

    @Value("${google.oauth.redirect-uri:}")
    private String redirectUri;

    private final GoogleOAuthTokenRepository tokenRepository;
    private final StringRedisTemplate redisTemplate;
    private final WebClient webClient;

    public GoogleOAuthService(GoogleOAuthTokenRepository tokenRepository,
                              StringRedisTemplate redisTemplate,
                              WebClient.Builder webClientBuilder) {
        this.tokenRepository = tokenRepository;
        this.redisTemplate = redisTemplate;
        this.webClient = webClientBuilder.build();
    }

    public String buildAuthorizationUrl(Long userSqno) {
        return UriComponentsBuilder.fromHttpUrl(AUTH_URL)
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "https://www.googleapis.com/auth/calendar.events")
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", userSqno.toString())
                .build()
                .toUriString();
    }

    @Transactional
    public void exchangeCode(String code, Long userSqno) {
        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("code", code);
        formData.add("client_id", clientId);
        formData.add("client_secret", clientSecret);
        formData.add("redirect_uri", redirectUri);
        formData.add("grant_type", "authorization_code");

        Map<?, ?> response = webClient.post()
                .uri(TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .bodyValue(formData)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null || !response.containsKey("access_token")) {
            throw new RuntimeException("Google OAuth 토큰 교환 실패");
        }

        String accessToken = (String) response.get("access_token");
        String refreshToken = (String) response.get("refresh_token");
        int expiresIn = (int) response.get("expires_in");
        OffsetDateTime expiry = OffsetDateTime.now().plusSeconds(expiresIn);

        GoogleOAuthToken token = tokenRepository.findByUserSqno(userSqno)
                .orElse(new GoogleOAuthToken());
        token.setUserSqno(userSqno);
        token.setAccessToken(accessToken);
        token.setRefreshToken(refreshToken);
        token.setTokenExpiry(expiry);
        tokenRepository.save(token);

        cacheAccessToken(userSqno, accessToken, expiresIn);
    }

    public String getValidAccessToken(Long userSqno) {
        String cached = redisTemplate.opsForValue().get(REDIS_KEY_PREFIX + userSqno);
        if (cached != null) return cached;

        GoogleOAuthToken token = tokenRepository.findByUserSqno(userSqno)
                .orElseThrow(() -> new RuntimeException("구글 캘린더 미연결"));

        if (OffsetDateTime.now().isAfter(token.getTokenExpiry().minusMinutes(5))) {
            return refreshAccessToken(userSqno, token);
        }

        long ttlSeconds = Duration.between(OffsetDateTime.now(), token.getTokenExpiry()).getSeconds() - 300;
        cacheAccessToken(userSqno, token.getAccessToken(), (int) Math.max(ttlSeconds, 60));
        return token.getAccessToken();
    }

    @Transactional
    public String refreshAccessToken(Long userSqno, GoogleOAuthToken token) {
        MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
        formData.add("refresh_token", token.getRefreshToken());
        formData.add("client_id", clientId);
        formData.add("client_secret", clientSecret);
        formData.add("grant_type", "refresh_token");

        Map<?, ?> response = webClient.post()
                .uri(TOKEN_URL)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .bodyValue(formData)
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null || !response.containsKey("access_token")) {
            throw new RuntimeException("Google 토큰 갱신 실패");
        }

        String newAccessToken = (String) response.get("access_token");
        int expiresIn = (int) response.get("expires_in");
        token.setAccessToken(newAccessToken);
        token.setTokenExpiry(OffsetDateTime.now().plusSeconds(expiresIn));
        tokenRepository.save(token);

        cacheAccessToken(userSqno, newAccessToken, expiresIn);
        return newAccessToken;
    }

    @Transactional
    public void revokeToken(Long userSqno) {
        redisTemplate.delete(REDIS_KEY_PREFIX + userSqno);
        tokenRepository.deleteByUserSqno(userSqno);
    }

    public boolean isConnected(Long userSqno) {
        if (clientId == null || clientId.isBlank()) return false;
        return tokenRepository.findByUserSqno(userSqno).isPresent();
    }

    private void cacheAccessToken(Long userSqno, String accessToken, int expiresIn) {
        int ttl = Math.max(expiresIn - 300, 60);
        redisTemplate.opsForValue().set(REDIS_KEY_PREFIX + userSqno, accessToken, Duration.ofSeconds(ttl));
    }
}
