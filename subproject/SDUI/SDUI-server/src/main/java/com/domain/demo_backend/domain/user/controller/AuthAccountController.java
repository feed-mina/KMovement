package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.dto.AdditionalInfoRequest;
import com.domain.demo_backend.domain.user.dto.RegisterRequest;
import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.domain.membership.service.UserMembershipService;
import com.domain.demo_backend.domain.user.service.AuthService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;


@RestController
@RequestMapping("/api/auth")
@Tag(name = "회원 계정 관리", description = "회원탈퇴, 비밀번호 변경, 카카오 로그인 후 추가 정보 입력")
public class AuthAccountController {
    private final Logger log = LoggerFactory.getLogger(AuthAccountController.class);
    private final AuthService authService;
    private final UserRepository userRepository;
    private final UserMembershipService userMembershipService;
    private final OperationAlertService operationAlertService;

    public AuthAccountController(
        AuthService authService,
        UserRepository userRepository,
        UserMembershipService userMembershipService,
        OperationAlertService operationAlertService
    ) {
        this.authService = authService;
        this.userRepository = userRepository;
        this.userMembershipService = userMembershipService;
        this.operationAlertService = operationAlertService;
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
}
