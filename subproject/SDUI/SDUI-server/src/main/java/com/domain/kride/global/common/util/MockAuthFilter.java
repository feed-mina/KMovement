package com.domain.kride.global.common.util;


import com.domain.kride.domain.user.domain.User;
import com.domain.kride.global.security.CustomUserDetails;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Profile("test") // 테스트 프로필에서만 작동하도록 설정 [cite: 2026-02-18]
public class MockAuthFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(MockAuthFilter.class);
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        log.debug("MockAuthFilter 실행됨!");
        String testAuthHeader = request.getHeader("X-Test-Auth");

        if ("true".equals(testAuthHeader)) {
            // AuthContext에서 기대하는 유저 정보와 일치하는 Mock 유저 생성
            User mockUser = User.builder()
                    .userSqno(1L)
                    .userId("pagingmina")
                    .role("USER")
                    .build();

            CustomUserDetails userDetails = new CustomUserDetails(mockUser);
            Authentication auth = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }
}