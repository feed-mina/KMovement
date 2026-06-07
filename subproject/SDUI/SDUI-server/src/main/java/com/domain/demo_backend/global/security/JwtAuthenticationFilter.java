package com.domain.demo_backend.global.security;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@RequiredArgsConstructor
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    //    cloundfront 적용 후 프록시 설정으로 추가
    private static final List<String> EXCLUDE_URLS = List.of(
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/kakao/login",
            "/api/kakao/callback",
            "/api/ui/LOGIN_PAGE"
    );
    private final JwtUtil jwtUtil;
    private final UserRepository userRepository;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return EXCLUDE_URLS.stream().anyMatch(path::startsWith);
    }

    /**
     * 토큰 추출 로직 분리
     */
    private String resolveToken(HttpServletRequest request) {
        // 1. Authorization 헤더에서 찾기
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }

        // 2. 헤더에 없으면 쿠키에서 찾기
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (jakarta.servlet.http.Cookie cookie : cookies) {
                if ("accessToken".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        // [추가] 이미 MockAuthFilter 등에 의해 인증이 완료된 경우 JWT 검사를 건너뛴다.
        if (SecurityContextHolder.getContext().getAuthentication() != null &&
                SecurityContextHolder.getContext().getAuthentication().isAuthenticated()) {
            filterChain.doFilter(request, response);
            return;
        }
        // 1. 토큰 추출 (헤더 우선, 없으면 쿠키)
        String token = resolveToken(request);
        if (token == null || token.isEmpty()) {
            // 토큰이 없으면 검증하지 않고 다음 필터(Spring Security)로 넘김
            filterChain.doFilter(request, response);
            return;
        }
// [수정] 토큰이 비어있으면 검증하지 않고 다음 필터로 넘김
        if (token == null || token.isEmpty()) {
            filterChain.doFilter(request, response);
            return;
        }
            try {
                Claims claims = jwtUtil.validateToken(token); // 토큰 검증
                String email = claims.getSubject();
                String userId = claims.get("userId", String.class);
                Long userSqno = claims.get("userSqno", Long.class);

                if (email != null) {
                    User user = userRepository.findByEmail(email)
                            .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
                    // JWT 클레임에서 role 읽기 (DB 역할 체계 반영)
                    String role = claims.get("role", String.class);
                    if (role == null || role.isBlank()) {
                        role = "ROLE_USER"; // 폴백 (기존 토큰 호환)
                    }
                    List<GrantedAuthority> authorities = List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority(role));

                    CustomUserDetails userDetails = new CustomUserDetails(user);
                    // 인증 토큰 생성
                    Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, authorities);

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                // 유효하지 않은 토큰 예외 처리
                log.warn("Invalid JWT token: {}", e.getMessage(), e);
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED); // 401 응답 반환
                response.getWriter().write("Invalid JWT Token");
                return;
            }
        filterChain.doFilter(request, response); // 다음 필터로 이동
        }



}
