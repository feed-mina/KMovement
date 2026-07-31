package com.domain.demo_backend.global.security;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockCookie;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * JwtAuthenticationFilter 가 JWT 클레임의 role 이 아닌 DB에서
 * 읽은 최신 role 을 GrantedAuthority 로 사용하는지 검증한다.
 *
 * <p>이 테스트가 방지하는 버그: DB에서 사용자 권한을 ROLE_ADMIN 으로
 * 바꾸어도, 기존 JWT 클레임에 ROLE_USER 가 남아 있으면 403 이 반환되던 문제.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("JwtAuthenticationFilter — DB role 우선 적용")
class JwtAuthenticationFilterRoleTest {

    // 테스트용 불투명 토큰 식별자 (실제 서명 없음 — Mock 으로 대체)
    private static final String TOKEN_STALE = "test.stale.role";
    private static final String TOKEN_USER  = "test.regular.user";
    private static final String TOKEN_NULL  = "test.null.role";

    @Mock private JwtUtil jwtUtil;
    @Mock private UserRepository userRepository;
    @Mock private FilterChain filterChain;
    @Mock private Claims claims;

    private JwtAuthenticationFilter filter;

    @BeforeEach
    void setUp() {
        filter = new JwtAuthenticationFilter(jwtUtil, userRepository);
        SecurityContextHolder.clearContext();
    }

    /** 쿠키로 토큰을 전달하는 MockHttpServletRequest 를 만든다. */
    private MockHttpServletRequest requestWithCookieToken(String tokenValue) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new MockCookie("accessToken", tokenValue));
        return request;
    }

    @Test
    @DisplayName("JWT 클레임에 ROLE_USER 가 있어도 DB 가 ROLE_ADMIN 이면 ROLE_ADMIN 이 부여된다")
    void dbRoleTakesPrecedenceOverStaleJwtClaim() throws Exception {
        // Given: JWT 클레임 role = ROLE_USER, DB role = ROLE_ADMIN
        User dbUser = User.builder()
                .userSqno(1L).userId("admin")
                .email("admin@example.com")
                .role("ROLE_ADMIN")   // DB 최신값
                .delYn("N").build();

        when(jwtUtil.validateToken(TOKEN_STALE)).thenReturn(claims);
        when(claims.getSubject()).thenReturn("admin@example.com");
        when(claims.get("userId", String.class)).thenReturn("admin");
        when(claims.get("userSqno", Long.class)).thenReturn(1L);
        // 수정된 필터는 JWT 클레임의 role 을 더 이상 읽지 않으므로
        // claims.get("role") 스텁이 불필요하다 — 이것이 이 테스트의 핵심 조건이다
        when(userRepository.findByEmail("admin@example.com")).thenReturn(Optional.of(dbUser));

        filter.doFilterInternal(requestWithCookieToken(TOKEN_STALE),
                new MockHttpServletResponse(), filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactly("ROLE_ADMIN");
    }

    @Test
    @DisplayName("DB role 이 ROLE_USER 인 일반 사용자는 ROLE_USER 권한이 부여된다")
    void regularUserGetsRoleUserFromDb() throws Exception {
        User dbUser = User.builder()
                .userSqno(2L).userId("traveler")
                .email("traveler@example.com")
                .role("ROLE_USER")
                .delYn("N").build();

        when(jwtUtil.validateToken(TOKEN_USER)).thenReturn(claims);
        when(claims.getSubject()).thenReturn("traveler@example.com");
        when(claims.get("userId", String.class)).thenReturn("traveler");
        when(claims.get("userSqno", Long.class)).thenReturn(2L);
        when(userRepository.findByEmail("traveler@example.com")).thenReturn(Optional.of(dbUser));

        filter.doFilterInternal(requestWithCookieToken(TOKEN_USER),
                new MockHttpServletResponse(), filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactly("ROLE_USER");
    }

    @Test
    @DisplayName("DB role 이 null 이면 ROLE_USER 로 폴백한다")
    void nullDbRoleFallsBackToRoleUser() throws Exception {
        User dbUser = User.builder()
                .userSqno(3L).userId("legacy")
                .email("legacy@example.com")
                .role(null)   // 구형 계정
                .delYn("N").build();

        when(jwtUtil.validateToken(TOKEN_NULL)).thenReturn(claims);
        when(claims.getSubject()).thenReturn("legacy@example.com");
        when(claims.get("userId", String.class)).thenReturn("legacy");
        when(claims.get("userSqno", Long.class)).thenReturn(3L);
        when(userRepository.findByEmail("legacy@example.com")).thenReturn(Optional.of(dbUser));

        filter.doFilterInternal(requestWithCookieToken(TOKEN_NULL),
                new MockHttpServletResponse(), filterChain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities())
                .extracting(a -> a.getAuthority())
                .containsExactly("ROLE_USER");
    }
}
