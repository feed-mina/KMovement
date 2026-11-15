package com.domain.kride.global.security;

import com.domain.kride.domain.token.domain.RefreshTokenRepository;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "jwt.secret=test_secret_key_must_be_at_least_32_bytes_long_for_security",
    "jwt.expiration=3600000",
    "jwt.refresh-token.expiration=86400000"
})
@ActiveProfiles("test")
@DisplayName("JwtUtil 단위 테스트")
class JwtUtilTest {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    private User testUser;

    @BeforeEach
    void setUp() {
        // 테스트용 사용자 생성
        testUser = User.builder()
                .userId("testuser")
                .email("test@example.com")
                .hashedPassword("hashedPassword123")
                .role("ROLE_USER")
                .phone("010-1234-5678")
                .delYn("N")
                .verifyYn("Y")
                .build();

        testUser = userRepository.save(testUser);
    }

    @Test
    @DisplayName("createAccessToken: JWT 생성 시 role 클레임이 포함되어야 한다")
    void createAccessToken_shouldIncludeRoleClaim() {
        // Given
        User user = testUser;

        // When
        String token = jwtUtil.createAccessToken(user);

        // Then
        assertThat(token).isNotNull();
        assertThat(token).isNotEmpty();

        // 토큰 파싱하여 role 클레임 확인
        Claims claims = jwtUtil.validateToken(token);
        assertThat(claims.get("role", String.class)).isEqualTo("ROLE_USER");
        assertThat(claims.get("userId", String.class)).isEqualTo("testuser");
        assertThat(claims.get("userSqno", Long.class)).isEqualTo(user.getUserSqno());
        assertThat(claims.getSubject()).isEqualTo("test@example.com");
    }

    @Test
    @DisplayName("createAccessToken: ADMIN 역할이 정확히 저장되어야 한다")
    void createAccessToken_shouldIncludeAdminRole() {
        // Given
        User adminUser = User.builder()
                .userId("adminuser")
                .email("admin@example.com")
                .hashedPassword("hashedPassword123")
                .role("ROLE_ADMIN")
                .phone("010-9999-8888")
                .delYn("N")
                .verifyYn("Y")
                .build();
        adminUser = userRepository.save(adminUser);

        // When
        String token = jwtUtil.createAccessToken(adminUser);

        // Then
        Claims claims = jwtUtil.validateToken(token);
        assertThat(claims.get("role", String.class)).isEqualTo("ROLE_ADMIN");
    }

    @Test
    @DisplayName("validateToken: 유효한 토큰을 파싱할 수 있어야 한다")
    void validateToken_shouldParseValidToken() {
        // Given
        String token = jwtUtil.createAccessToken(testUser);

        // When
        Claims claims = jwtUtil.validateToken(token);

        // Then
        assertThat(claims).isNotNull();
        assertThat(claims.getSubject()).isEqualTo("test@example.com");
        assertThat(claims.get("userId")).isEqualTo("testuser");
        assertThat(claims.getIssuedAt()).isNotNull();
        assertThat(claims.getExpiration()).isNotNull();
    }

    @Test
    @DisplayName("generateTokens: AccessToken과 RefreshToken이 모두 생성되어야 한다")
    void generateTokens_shouldCreateBothTokens() {
        // Given
        User user = testUser;

        // When
        var tokenResponse = jwtUtil.generateTokens(user);

        // Then
        assertThat(tokenResponse).isNotNull();
        assertThat(tokenResponse.getAccessToken()).isNotEmpty();
        assertThat(tokenResponse.getRefreshToken()).isNotEmpty();
        assertThat(tokenResponse.getUserId()).isEqualTo("testuser");
        assertThat(tokenResponse.getEmail()).isEqualTo("test@example.com");
        assertThat(tokenResponse.getRole()).isEqualTo("ROLE_USER");

        // AccessToken의 role 클레임 확인
        Claims claims = jwtUtil.validateToken(tokenResponse.getAccessToken());
        assertThat(claims.get("role", String.class)).isEqualTo("ROLE_USER");
    }

    @Test
    @DisplayName("createAccessToken: role이 null인 경우에도 토큰이 생성되어야 한다")
    void createAccessToken_shouldHandleNullRole() {
        // Given
        User userWithoutRole = User.builder()
                .userId("noroleuser")
                .email("norole@example.com")
                .hashedPassword("hashedPassword123")
                .role(null) // role이 null
                .phone("010-5555-6666")
                .delYn("N")
                .verifyYn("Y")
                .build();
        userWithoutRole = userRepository.save(userWithoutRole);

        // When
        String token = jwtUtil.createAccessToken(userWithoutRole);

        // Then
        assertThat(token).isNotNull();
        Claims claims = jwtUtil.validateToken(token);
        assertThat(claims.get("role")).isNull();
    }
}
