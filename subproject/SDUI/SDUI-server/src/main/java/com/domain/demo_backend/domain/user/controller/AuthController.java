package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.token.domain.RefreshToken;
import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.service.AuthService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.domain.demo_backend.global.security.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "회원 권한 로직 컨트롤러", description = "로그인, 내 정보, 토큰 재발급, 로그아웃 (회원가입은 AuthSignupController, 계정 관리는 AuthAccountController)")
public class AuthController {
    private final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;
    private JwtUtil jwtUtil;
    private User user;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    private UserRepository userRepository;
    @Value("${app.auth.cookie-secure:false}")
    private boolean secureCookie;
    // 생성자 주입
    @Autowired
    public AuthController(
        AuthService authService,
        JwtUtil jwtUtil,
        RefreshTokenRepository refreshTokenRepository,
        UserRepository userRepository
    ) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
    }
    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUser(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            // [수정] Map.of 대신 직접 HashMap을 쓰거나 Null 방어 로직 추가
            Map<String, Object> guestResponse = new HashMap<>();
            guestResponse.put("isLoggedIn", false);
            guestResponse.put("role", "GUEST");
            return ResponseEntity.ok(guestResponse);
        }
        // 보안상 필요한 정보(ID, 이메일, 시퀀스번호 등)만 객체에 담아 반환

        Map<String, Object> response = new HashMap<>();
        response.put("isLoggedIn", true);
        response.put("userSqno", userDetails.getUserSqno());
        response.put("userId", userDetails.getUserId());
        response.put("email", userDetails.getUserEmail());
        response.put("socialType", userDetails.getSocialType());
        response.put("role", userDetails.getRole());

        return ResponseEntity.ok(response);

    }
    @Operation(summary = "회원 로그인", description = "id와 password와 haspassword가 일치하다면 로그인, 아니면 팝업 경고창이 뜬다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "일반 회원 로그인 성공"),
            @ApiResponse(responseCode = "401", description = "아이디 또는 비밀번호 불일치"),
            @ApiResponse(responseCode = "403", description = "계정 비 활성화 또는 회원탈퇴"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestHeader(value = "X-Platform", defaultValue = "web") String platform,
            @RequestBody com.domain.demo_backend.domain.user.dto.LoginRequest loginRequest) {
        TokenResponse tokenResponse = authService.login(loginRequest);
//  Access Token 쿠키 (수명 1시간)
        ResponseCookie accessTokenCookie = ResponseCookie.from("accessToken", tokenResponse.getAccessToken())
                .httpOnly(true)
                .secure(secureCookie)
                .path("/")
                .maxAge(60 * 60)
                .sameSite("Lax")
                .build();

        // 2. Refresh Token 쿠키 (수명 7일)
        ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", tokenResponse.getRefreshToken())
                .httpOnly(true)
                .secure(secureCookie)
                .path("/")
                .maxAge(60 * 60 * 24 * 7)
                .sameSite("Lax")
                .build();
// AccessToken (보안용)

        // 일반 로그인/카카오 로그인 성공 로직에 추가
        ResponseCookie loginTypeCookie = ResponseCookie.from("loginType", "N")
                .httpOnly(false) // 프론트엔드 자바스크립트가 읽을 수 있어야 하므로 false
                .secure(secureCookie)
                .path("/")
                .maxAge(3600)
                .sameSite("Lax")
                .build();

        // Role 쿠키 (RBAC용, 프론트엔드 접근 가능)
        ResponseCookie roleCookie = ResponseCookie.from("role", tokenResponse.getRole())
                .httpOnly(false)
                .secure(secureCookie)
                .path("/")
                .maxAge(60 * 60)
                .sameSite("Lax")
                .build();

// 로그인 여부 확인용 (자바스크립트 접근 가능)
        ResponseCookie statusCookie = ResponseCookie.from("isLoggedIn", "true")
                .httpOnly(false).secure(secureCookie).path("/").maxAge(3600).sameSite("Lax").build();
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, roleCookie.toString())
                .header(HttpHeaders.SET_COOKIE, loginTypeCookie.toString())
                .header(HttpHeaders.SET_COOKIE, statusCookie.toString());

        // Browser sessions keep both JWTs in HttpOnly cookies. Native clients
        // explicitly opt in to the token response through X-Platform.
        if ("mobile".equalsIgnoreCase(platform) || "app".equalsIgnoreCase(platform)) {
            return response.body(tokenResponse);
        }
        return response.body(Map.of("message", "로그인 성공", "role", tokenResponse.getRole()));
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(name = "refreshToken", required = false) String cookieRT ,
                                     @RequestHeader(value = "Authorization-Refresh", required = false) String headerRT,
                                     @RequestHeader(value = "X-Platform", defaultValue = "web") String platform) {
        try {
            // 1. 쿠키에 없으면 헤더에서 가져온다 (앱 대응)
            String refreshToken = (cookieRT != null) ? cookieRT : headerRT;

            if (refreshToken == null || refreshToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("인증 정보가 없습니다.");
            }

            // 1. 토큰 유효성 먼저 검증 (jwtUtil에서 만료 체크)
            log.info("@@@@@  토큰 유효성 먼저 검증 ");
            Claims claims = jwtUtil.validateToken(refreshToken);
            String email = claims.getSubject();
            User user = userRepository.findByEmail(email)
                    .orElseThrow(() -> new RuntimeException("사용자를 찾을 수 없습니다."));
            // Redis lookups should use the primary key instead of an unindexed email field.
            RefreshToken saved = refreshTokenRepository.findById(user.getUserSqno())
                    .orElseThrow(() -> new IllegalArgumentException("로그인 정보가 만료되었습니다."));

            if (!saved.getRefreshToken().equals(refreshToken)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("유효하지 않은 토큰입니다");
            }

            // Rotate both tokens so active sessions receive a fresh seven-day window.
            TokenResponse refreshedTokens = jwtUtil.generateTokens(user);
            ResponseCookie newAccessCookie = ResponseCookie.from("accessToken", refreshedTokens.getAccessToken())
                    .httpOnly(true)
                    .secure(secureCookie)
                    .path("/")
                    .maxAge(60 * 60)
                    .sameSite("Lax")
                    .build();
            ResponseCookie newRefreshCookie = ResponseCookie.from("refreshToken", refreshedTokens.getRefreshToken())
                    .httpOnly(true)
                    .secure(secureCookie)
                    .path("/")
                    .maxAge(60 * 60 * 24 * 7)
                    .sameSite("Lax")
                    .build();

            ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, newAccessCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, newRefreshCookie.toString());
            if ("mobile".equalsIgnoreCase(platform) || "app".equalsIgnoreCase(platform)) {
                return response.body(Map.of(
                        "accessToken", refreshedTokens.getAccessToken(),
                        "refreshToken", refreshedTokens.getRefreshToken()));
            }
            return response.body(Map.of("message", "세션 갱신 성공"));

        } catch (ExpiredJwtException e) {
            log.info("@@@@@ 리프레시 토큰이 만료");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("리프레시 토큰이 만료됐어요. 다시 로그인 해주세요!");
        } catch (Exception e) {
            log.info("@@@@@ 토큰 오류");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("인증 오류: " + e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(@AuthenticationPrincipal CustomUserDetails userDetails,
                                    HttpServletResponse response) {
        if (userDetails != null) {
            refreshTokenRepository.deleteById(userDetails.getUserSqno());
        }
        // 1. Access Token 삭제 쿠키
        ResponseCookie accessCookie = ResponseCookie.from("accessToken", "")
                .path("/")
                .maxAge(0) // 수명을 0으로 설정하여 즉시 삭제 
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .build();

        // 2. Refresh Token 삭제 쿠키
        ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", "")
                .path("/")
                .maxAge(0)
                .httpOnly(true)
                .secure(secureCookie)
                .sameSite("Lax")
                .build();

        // 3. 로그인 타입 플래그 쿠키 삭제 (일반 쿠키)
        ResponseCookie loginTypeCookie = ResponseCookie.from("loginType", "")
                .path("/")
                .maxAge(0)
                .httpOnly(false) // 프론트에서 접근 가능했던 쿠키 
                .secure(secureCookie)
                .sameSite("Lax")
                .build();

        ResponseCookie roleCookie = ResponseCookie.from("role", "")
                .path("/").maxAge(0).httpOnly(false).secure(secureCookie).sameSite("Lax").build();
        ResponseCookie statusCookie = ResponseCookie.from("isLoggedIn", "")
                .path("/").maxAge(0).httpOnly(false).secure(secureCookie).sameSite("Lax").build();

        response.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, loginTypeCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, roleCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, statusCookie.toString());
        return ResponseEntity.ok().body("로그아웃 성공");
    }
}
