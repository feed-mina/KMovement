package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.token.domain.RefreshToken;
import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.domain.token.domain.TokenResponse;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.dto.AdditionalInfoRequest;
import com.domain.demo_backend.domain.user.dto.RegisterRequest;
import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.domain.membership.service.UserMembershipService;
import com.domain.demo_backend.domain.user.service.AuthService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.domain.demo_backend.global.security.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.mail.MessagingException;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "회원 권한 로직 컨트롤러", description = "로그인, 회원가입 (-- 로그아웃, 회원탈퇴, 회원가입, 비밀번호 변경, 이메일 인증/재인증 , 회원탈퇴")
public class AuthController {
    private final Logger log = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;
    private final UserMembershipService userMembershipService;
    private final OperationAlertService operationAlertService;
    private Map<String, String> emailVerificationMap = new HashMap<>();
    private JwtUtil jwtUtil;
    private User user;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    private UserRepository userRepository;
    // 생성자 주입
    @Autowired
    public AuthController(
        AuthService authService,
        JwtUtil jwtUtil,
        RefreshTokenRepository refreshTokenRepository,
        UserRepository userRepository,
        UserMembershipService userMembershipService,
        OperationAlertService operationAlertService
    ) {
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userRepository = userRepository;
        this.userMembershipService = userMembershipService;
        this.operationAlertService = operationAlertService;
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
    public ResponseEntity<?> login(@RequestBody com.domain.demo_backend.domain.user.dto.LoginRequest loginRequest) {
        TokenResponse tokenResponse = authService.login(loginRequest);
//  Access Token 쿠키 (수명 1시간)
        ResponseCookie accessTokenCookie = ResponseCookie.from("accessToken", tokenResponse.getAccessToken())
                .httpOnly(true)
                .secure(false)  // 로컬 HTTP 테스트 시 false HTTPS 적용 시  true
                .path("/")
                .maxAge(60 * 60)
                .sameSite("Lax")
                .build();

        // 2. Refresh Token 쿠키 (수명 7일)
        ResponseCookie refreshTokenCookie = ResponseCookie.from("refreshToken", tokenResponse.getRefreshToken())
                .httpOnly(true)
                .secure(false) // 로컬 HTTP 테스트 시 false HTTPS 적용 시  true
                .path("/")
                .maxAge(60 * 60 * 24 * 7)
                .sameSite("Lax")
                .build();
// AccessToken (보안용)

        // 일반 로그인/카카오 로그인 성공 로직에 추가
        ResponseCookie loginTypeCookie = ResponseCookie.from("loginType", "N")
                .httpOnly(false) // 프론트엔드 자바스크립트가 읽을 수 있어야 하므로 false
                .path("/")
                .maxAge(3600)
                .build();

        // Role 쿠키 (RBAC용, 프론트엔드 접근 가능)
        ResponseCookie roleCookie = ResponseCookie.from("role", tokenResponse.getRole())
                .httpOnly(false)
                .secure(false)
                .path("/")
                .maxAge(60 * 60)
                .sameSite("Lax")
                .build();

// 로그인 여부 확인용 (자바스크립트 접근 가능)
        ResponseCookie statusCookie = ResponseCookie.from("isLoggedIn", "true")
                .httpOnly(false).path("/").maxAge(3600).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshTokenCookie.toString())
                .header(HttpHeaders.SET_COOKIE, roleCookie.toString())
                .header(HttpHeaders.SET_COOKIE, loginTypeCookie.toString())
                .header(HttpHeaders.SET_COOKIE, statusCookie.toString())
                .body(tokenResponse);  //앱 개발 확장 토큰 정보를 포함한 객체 반환
    }

    @Operation(summary = "회원 가입페이지에서 회원가입 로직", description = "users 테이블에 insert한다..")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "users 테이블에 insert 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 사용자"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/register")
    public ResponseEntity<String> register(@Valid @RequestBody com.domain.demo_backend.domain.user.dto.RegisterRequest registerRequest) {
        // 1. 필수 값 검증 (간단한 예시)
        if (registerRequest.getZipCode() == null || registerRequest.getRoadAddress() == null) {
            return ResponseEntity.badRequest().body("주소 정보는 필수입니다.");
        }

        log.info("회원가입 요청 - 이메일: " + registerRequest.getEmail());
        log.info("주소 정보: [" + registerRequest.getZipCode() + "] " + registerRequest.getRoadAddress());

        log.info("registerRequest: " + registerRequest);
        authService.register(registerRequest);
        log.info("register service logic OK");
        return ResponseEntity.status(HttpStatus.CREATED).body("User registred successfully!");
    }

    @GetMapping("/check-user-id")
    public ResponseEntity<Map<String, Object>> checkUserId(@RequestParam String userId) {
        String normalized = userId == null ? "" : userId.trim();
        if (!normalized.matches("^[A-Za-z0-9_]{4,20}$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "available", false,
                    "message", "아이디는 영문, 숫자, 밑줄을 사용해 4~20자로 입력해주세요."
            ));
        }
        boolean available = !userRepository.existsByUserIdIgnoreCase(normalized);
        return ResponseEntity.ok(Map.of(
                "available", available,
                "message", available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다."
        ));
    }


    @Operation(summary = "회원 가입 로직 이후 이메일 인증 전송로직", description = "users테이블에 code(인증번호)와 verify(Y) update")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "users테이블에 code(인증번호)와 verify(Y) update 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 사용자"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/signup")
    public ResponseEntity<?> sendVerificationCode(@RequestHeader(value = "X-Platform", defaultValue = "web") String platform,  @RequestBody RegisterRequest registerRequest, @RequestParam String message) throws MessagingException {
        log.info("회원가입 인증코드 전송 시작: " + registerRequest.getEmail());
        log.info("유효성 평가 ");
        log.info("회원가입 하기 위해 인증코드 전송 ");
        String email = registerRequest.getEmail();
        // 랜덤 인증 코드 생성
        String verificationCode = authService.sendVerificationCode(email, platform);

        // 이메일 전송 시뮬레이션(실제 서비스에서는 이메일 전송 API)
        log.info("이메일 전송: " + email);
        log.info("메시지: " + message);

        String savedCode = emailVerificationMap.get(email);
        return ResponseEntity.ok(Map.of("message", "인증 코드가 이메일로 전송되었습니다.", "email", registerRequest.getEmail()));

    }

    @Operation(summary = "get방식의 /signUp", description = "url에서 signUp이 잘 되는지 테스트.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 사용자"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @GetMapping("/signUp")
    public ResponseEntity<?> sendVerificationCodeByGet(@RequestHeader(value = "X-Platform", defaultValue = "web") String platform, @RequestBody RegisterRequest registerRequest, @RequestParam String message) throws MessagingException {

        log.info("get 테스트 회원가입 하기 위해 인증코드 전송 ");
        String email = registerRequest.getEmail();

        String verificationCode = authService.sendVerificationCode(email, platform);
        emailVerificationMap.put(email, verificationCode);

        return ResponseEntity.ok(Map.of(
                "message", "인증 코드가 이메일로 전송되었습니다.",
                "email", email
        ));
    }


    @Operation(summary = "회원 가입 인증 번호 확인", description = "회원 가입 인증 번호를 확인.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "회원 가입 인증  번호 확인 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 사용자"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/verify-code")
    public ResponseEntity<String> verifyCode(@RequestHeader(value = "X-Platform", defaultValue = "web") String platform, @RequestBody com.domain.demo_backend.domain.user.dto.RegisterRequest request) {
        if (request.getEmail() == null || request.getCode() == null) {
            return ResponseEntity.badRequest().body("이메일 또는 인증 코드가 누락되었습니다.");
        }

        boolean isValid = authService.verifyCode(request.getEmail(), request.getCode(), platform);
        if (isValid) {
            return ResponseEntity.ok("인증 성공!");
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("인증 실패! 코드를 다시 확인해주세요.");
        }

    }

    @Operation(summary = "회원 가입 인증  번호 재전송", description = "회원 가입 인증  번호 다시확인한다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "회원 가입 인증  번호 재전송 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 사용자"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/resend-code")
    public ResponseEntity<String> resendVerificationCode(@RequestBody com.domain.demo_backend.domain.user.dto.RegisterRequest request) {
        try {
            authService.resendVerification(request.getEmail());
            return ResponseEntity.ok(" 새 인증코드가 이메일로 전송되었습니다!");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(" 인증코드 재전송에 실패했습니다.");
        }
    }

    @Operation(summary = "회원 탈퇴", description = "사용자 계정의 del_yn flag를 'Y' -> 'N'로 표시한다.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "회원탈퇴 성공"),
            @ApiResponse(responseCode = "401", description = "인증되지 않은 사용자"),
            @ApiResponse(responseCode = "404", description = "사용자 정보 없음"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/non-user")
    public ResponseEntity<String> nonUser(@RequestBody com.domain.demo_backend.domain.user.dto.RegisterRequest registerRequest,
                                          @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }
        if (registerRequest.getEmail() == null || registerRequest.getEmail().isEmpty()) {
            log.info("회원탈퇴 실패: userId가 비어 있음");
            return ResponseEntity.badRequest().body("회원 아이디가 필요합니다.");
        }

        try {
            authService.nonMember(registerRequest);
            return ResponseEntity.ok("회원탈퇴 성공");
        } catch (IllegalArgumentException e) {
            log.info("회원탈퇴 실패: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            log.info("회원탈퇴 실패: 서버 내부 오류");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("서버 오류 발생");
        }
    }


    @Operation(summary = "비밀번호 변경 로직", description = "users테이블에 변경된 비빌번호로 password update")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "users테이블에 비밀번호 변경 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/editPassword")
    public ResponseEntity<?> editPassword(@RequestBody com.domain.demo_backend.domain.user.dto.PasswordDto passwordDto,
                                          @AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }
        if (passwordDto.getEmail() == null || passwordDto.getEmail().isEmpty()) {
            log.info("비밀변호 변경 실패: userId가 비어 있음");
            return ResponseEntity.badRequest().body("회원 아이디가 필요합니다.");
        }
        try {
            authService.editPassword(passwordDto);
            return ResponseEntity.ok("비밀변호 변경 성공");
        } catch (IllegalArgumentException e) {
            log.info("비밀변호 변경 실패: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (Exception e) {
            log.info("비밀변호 변경 실패: 서버 내부 오류");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("서버 오류 발생");
        }
    }


    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@CookieValue(name = "refreshToken", required = false) String cookieRT ,
                                     @RequestHeader(value = "Authorization-Refresh", required = false) String headerRT) {
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
                    .secure(false)
                    .path("/")
                    .maxAge(60 * 60)
                    .sameSite("Lax")
                    .build();
            ResponseCookie newRefreshCookie = ResponseCookie.from("refreshToken", refreshedTokens.getRefreshToken())
                    .httpOnly(true)
                    .secure(false)
                    .path("/")
                    .maxAge(60 * 60 * 24 * 7)
                    .sameSite("Lax")
                    .build();

            return ResponseEntity.ok()
                    .header(HttpHeaders.SET_COOKIE, newAccessCookie.toString())
                    .header(HttpHeaders.SET_COOKIE, newRefreshCookie.toString())
                    .body(Map.of("accessToken", refreshedTokens.getAccessToken()));

        } catch (ExpiredJwtException e) {
            log.info("@@@@@ 리프레시 토큰이 만료");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("리프레시 토큰이 만료됐어요. 다시 로그인 해주세요!");
        } catch (Exception e) {
            log.info("@@@@@ 토큰 오류");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("인증 오류: " + e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        // 1. Access Token 삭제 쿠키
        ResponseCookie accessCookie = ResponseCookie.from("accessToken", "")
                .path("/")
                .maxAge(0) // 수명을 0으로 설정하여 즉시 삭제 
                .httpOnly(true)
                .secure(false) // 개발 환경에 맞춰 설정
                .build();

        // 2. Refresh Token 삭제 쿠키
        ResponseCookie refreshCookie = ResponseCookie.from("refreshToken", "")
                .path("/")
                .maxAge(0)
                .httpOnly(true)
                .secure(false)
                .build();

        // 3. 로그인 타입 플래그 쿠키 삭제 (일반 쿠키)
        ResponseCookie loginTypeCookie = ResponseCookie.from("loginType", "")
                .path("/")
                .maxAge(0)
                .httpOnly(false) // 프론트에서 접근 가능했던 쿠키 
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, accessCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, refreshCookie.toString());
        response.addHeader(HttpHeaders.SET_COOKIE, loginTypeCookie.toString());
        return ResponseEntity.ok().body("로그아웃 성공");
    }

    @Operation(summary = "추가 정보 입력 (RBAC)", description = "카카오 로그인 후 추가 정보 입력 및 ROLE_GUEST → ROLE_USER 승격")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "추가 정보 입력 및 권한 업그레이드 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류 또는 이미 정보가 입력된 사용자"),
            @ApiResponse(responseCode = "401", description = "인증되지 않은 사용자"),
            @ApiResponse(responseCode = "500", description = "서버 오류")
    })
    @PostMapping("/update-profile")
    public ResponseEntity<?> updateAdditionalInfo(
        @AuthenticationPrincipal CustomUserDetails userDetails,
        @RequestBody AdditionalInfoRequest request
    ) {
        log.info("수신된 데이터: roadAddress={}, zipCode={}", request.getRoadAddress(), request.getZipCode());

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        String email = userDetails.getUserEmail();
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다"));

        // ROLE_GUEST인 경우만 업데이트 허용 (이미 정보가 입력된 사용자는 차단)
        if (!"ROLE_GUEST".equals(user.getRole())) {
            log.warn("추가 정보 입력 실패: 이미 정보가 입력된 사용자 (role: {})", user.getRole());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("message", "이미 정보가 입력된 사용자입니다"));
        }

        // 추가 정보 업데이트
        user.setPhone(request.getPhone());
        user.setRoadAddress(request.getRoadAddress());
        user.setDetailAddress(request.getDetailAddress());
        user.setZipCode(request.getZipCode());

        // 권한 업그레이드: ROLE_GUEST → ROLE_USER
        user.setRole("ROLE_USER");
        user.setUpdatedAt(LocalDateTime.now());
        userRepository.save(user);

        // 신규 가입자 프리미엄 멤버십 자동 부여
        userMembershipService.grantByMembershipName(user.getUserSqno(), "프리미엄", "register");

        // 운영 알림: 신규 가입
        operationAlertService.sendNewUser(email, userRepository.count());

        log.info("추가 정보 입력 완료: email={}, role=ROLE_USER", email);

        return ResponseEntity.ok(Map.of(
            "message", "추가 정보가 저장되었습니다",
            "role", "ROLE_USER"
        ));
    }

    @GetMapping("/check-verification")
    public ResponseEntity<?> checkVerification(@RequestParam String email) {
        // DB나 Redis에서 해당 이메일의 인증 상태를 확인하는 로직
        boolean verified = authService.isUserVerified(email);

        Map<String, Object> result = new HashMap<>();
        result.put("isVerified", verified);

        return ResponseEntity.ok(result);
    }

}
