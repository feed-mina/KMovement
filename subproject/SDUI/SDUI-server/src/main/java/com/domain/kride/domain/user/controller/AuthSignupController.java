package com.domain.kride.domain.user.controller;

import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import com.domain.kride.domain.user.dto.RegisterRequest;
import com.domain.kride.domain.user.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.mail.MessagingException;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;


@RestController
@RequestMapping("/api/auth")
@Tag(name = "회원가입·이메일 인증", description = "회원가입, 아이디 중복 확인, 이메일 인증 코드 전송/확인/재전송")
public class AuthSignupController {
    private final Logger log = LoggerFactory.getLogger(AuthSignupController.class);
    private final AuthService authService;
    private final UserRepository userRepository;
    private final Map<String, String> emailVerificationMap = new HashMap<>();

    public AuthSignupController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @Operation(summary = "회원 가입페이지에서 회원가입 로직", description = "users 테이블에 insert한다..")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "201", description = "users 테이블에 insert 성공"),
            @ApiResponse(responseCode = "400", description = "입력값 오류"),
            @ApiResponse(responseCode = "409", description = "이미 존재하는 사용자"),
            @ApiResponse(responseCode = "500", description = "서버오류"),
    })
    @PostMapping("/register")
    public ResponseEntity<String> register(@Valid @RequestBody com.domain.kride.domain.user.dto.RegisterRequest registerRequest) {
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
    public ResponseEntity<String> verifyCode(@RequestHeader(value = "X-Platform", defaultValue = "web") String platform, @RequestBody com.domain.kride.domain.user.dto.RegisterRequest request) {
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
    public ResponseEntity<String> resendVerificationCode(@RequestBody com.domain.kride.domain.user.dto.RegisterRequest request) {
        try {
            authService.resendVerification(request.getEmail());
            return ResponseEntity.ok(" 새 인증코드가 이메일로 전송되었습니다!");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(" 인증코드 재전송에 실패했습니다.");
        }
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
