package com.domain.demo_backend.global.config;

import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.common.util.MockAuthFilter;
import jakarta.servlet.DispatcherType;
import com.domain.demo_backend.global.security.JwtAuthenticationFilter;
import com.domain.demo_backend.global.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.Http403ForbiddenEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity

public class SecurityConfig {

    private final JwtUtil jwtUtil;
    private final RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private CustomUserDetailsService customUserDetailsService;

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired(required = false)
    private MockAuthFilter mockAuthFilter; // 테스트 프로필일 때만 주입됨

    @Autowired
    public SecurityConfig(JwtUtil jwtUtil, RefreshTokenRepository refreshTokenRepository) {
        this.jwtUtil = jwtUtil;
        this.refreshTokenRepository = refreshTokenRepository;
    }

    // 비밀번호 암호화 설정
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JwtUtil jwtUtil, UserRepository userRepository)
            throws Exception {
        // 1. JWT 필터 객체 생성 [cite: 2026-02-18]
        // JwtAuthenticationFilter jwtFilter = new JwtAuthenticationFilter(jwtUtil,
        // refreshTokenRepository, userRepository);

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ASYNC, DispatcherType.FORWARD, DispatcherType.ERROR)
                        .permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Swagger UI
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html",
                                "/v3/api-docs/**", "/swagger-resources/**", "/webjars/**").permitAll()
                        // PUBLIC — 인증 불필요
                        .requestMatchers(
                                "/api/auth/login", "/api/auth/register",
                                "/api/auth/signup", "/api/auth/signUp",
                                "/api/auth/me", "/api/auth/refresh", "/api/auth/logout",
                                "/api/auth/verify-code", "/api/auth/resend-code",
                                "/api/auth/confirm-email", "/api/auth/check-verification",
                                "/api/ai/stt", "/api/ai/guest/**", "/api/ai/interview/resume/upload",
                                "/api/ai/interview/resume/view")
                        .permitAll()


                        .requestMatchers("/api/kakao/**").permitAll()
                        .requestMatchers("/api/google/callback").permitAll()
                        .requestMatchers("/api/google/**").authenticated()
                        .requestMatchers("/api/ui/**").permitAll()
                        .requestMatchers("/api/timer/**").permitAll()
                        .requestMatchers("/api/goalTime/**").permitAll() // 컨트롤러 레벨에서 인증 처리
                        .requestMatchers("/api/execute/**").permitAll() // SDUI 데이터 조회 (공개 화면 포함)
                        // AUTHENTICATED — 로그인 필수
                        .requestMatchers("/api/auth/editPassword", "/api/auth/non-user", "/api/auth/update-profile")
                        .authenticated()
                        .requestMatchers("/api/content/**").authenticated()
                        // ADMIN ONLY
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        // AI API (인증 필요)
                        .requestMatchers(HttpMethod.POST, "/api/ai/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/ai/v2/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/ai/v2/tts").authenticated()
                        // 멤버십 API (인증 필요)
                        .requestMatchers("/api/v1/user-memberships/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/v1/memberships").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/memberships/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/memberships/**").hasRole("ADMIN")
                        // ── [추가] 커뮤니티 ──
                        .requestMatchers(HttpMethod.GET, "/api/v1/community/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/v1/community/**").authenticated()
                        .requestMatchers(HttpMethod.PATCH, "/api/v1/community/**").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/v1/community/**").authenticated()
                        // ── [추가] KRIDE ──
                        .requestMatchers("/api/v1/kride/chat/**").authenticated()
                        .requestMatchers("/api/kride/**").permitAll()
                        // DEFAULT — 명시되지 않은 모든 요청 차단
                        .anyRequest().denyAll())
                .exceptionHandling(exception -> exception.authenticationEntryPoint(new Http403ForbiddenEntryPoint()))
                .formLogin(f -> f.disable())
                .logout(l -> l.disable());

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        if (mockAuthFilter != null) {
            http.addFilterBefore(mockAuthFilter, JwtAuthenticationFilter.class);
        }

        return http.build();
    }

    // CORS 설정
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(
                "https://yerin.duckdns.org",
                "http://localhost:3000",
                "http://localhost:8080",
                "http://43.201.237.68",
                "http://43.201.237.68:8081"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowCredentials(true); // 쿠키 허용
        configuration.setMaxAge(10800L); // preflight 캐시 3 * 60 (분) * 60(초)
        configuration.setExposedHeaders(List.of("Authorization", "Authorization-Refresh")); // 앱 개발 - Authorization 헤더
                                                                                            // 추가
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

}