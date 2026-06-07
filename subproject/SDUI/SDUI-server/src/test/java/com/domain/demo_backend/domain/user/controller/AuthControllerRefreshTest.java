package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.domain.membership.service.UserMembershipService;
import com.domain.demo_backend.domain.token.domain.RefreshToken;
import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.service.AuthService;
import com.domain.demo_backend.global.security.JwtUtil;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthController refresh token")
class AuthControllerRefreshTest {

    @Mock private AuthService authService;
    @Mock private JwtUtil jwtUtil;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserMembershipService userMembershipService;
    @Mock private OperationAlertService operationAlertService;
    @Mock private Claims claims;

    private AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController(
                authService,
                jwtUtil,
                refreshTokenRepository,
                userRepository,
                userMembershipService,
                operationAlertService
        );
    }

    @Test
    @DisplayName("valid refresh token rotates access and refresh cookies")
    void refreshRotatesBothCookies() {
        User user = User.builder()
                .userSqno(42L)
                .userId("kakao-user")
                .email("kakao@example.com")
                .role("ROLE_USER")
                .build();
        RefreshToken savedToken = new RefreshToken(
                user.getUserSqno(),
                user.getEmail(),
                "old-refresh-token",
                60L * 60 * 24 * 7
        );
        TokenResponse rotatedTokens = TokenResponse.builder()
                .accessToken("new-access-token")
                .refreshToken("new-refresh-token")
                .userSqno(user.getUserSqno())
                .email(user.getEmail())
                .role(user.getRole())
                .build();

        when(jwtUtil.validateToken("old-refresh-token")).thenReturn(claims);
        when(claims.getSubject()).thenReturn(user.getEmail());
        when(userRepository.findByEmail(user.getEmail())).thenReturn(Optional.of(user));
        when(refreshTokenRepository.findById(user.getUserSqno())).thenReturn(Optional.of(savedToken));
        when(jwtUtil.generateTokens(user)).thenReturn(rotatedTokens);

        ResponseEntity<?> response = controller.refresh("old-refresh-token", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().get(HttpHeaders.SET_COOKIE))
                .anyMatch(cookie -> cookie.startsWith("accessToken=new-access-token"))
                .anyMatch(cookie -> cookie.startsWith("refreshToken=new-refresh-token"));
        assertThat(response.getBody()).isEqualTo(Map.of("accessToken", "new-access-token"));
        verify(jwtUtil).generateTokens(user);
    }
}
