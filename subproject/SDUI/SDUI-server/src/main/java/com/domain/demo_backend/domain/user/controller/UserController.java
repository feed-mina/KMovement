package com.domain.demo_backend.domain.user.controller;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.user.dto.FcmTokenRequest;
import com.domain.demo_backend.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@Tag(name = "유저 컨트롤러", description = "유저 정보 관리 (FCM 토큰 등)")
public class UserController {
    
    private final Logger log = LoggerFactory.getLogger(UserController.class);
    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Operation(summary = "FCM 토큰 저장", description = "로그인한 유저의 FCM 디바이스 토큰을 저장합니다.")
    @PostMapping("/fcm-token")
    public ResponseEntity<?> saveFcmToken(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody FcmTokenRequest request) {
        
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        if (request.getToken() == null || request.getToken().isBlank()) {
            return ResponseEntity.badRequest().body("토큰이 비어 있습니다.");
        }

        User user = userRepository.findByEmail(userDetails.getUserEmail())
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        user.setFcmToken(request.getToken());
        userRepository.save(user);

        log.info("FCM 토큰 저장 완료: userId={}, token={}", user.getUserId(), request.getToken());

        return ResponseEntity.ok(Map.of("message", "FCM 토큰이 저장되었습니다."));
    }
}
