package com.domain.kride.domain.google.controller;

import com.domain.kride.domain.google.service.GoogleOAuthService;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/google")
@RequiredArgsConstructor
public class GoogleOAuthController {

    private static final Logger log = LoggerFactory.getLogger(GoogleOAuthController.class);
    private final GoogleOAuthService googleOAuthService;

    /** 구글 OAuth 동의 URL 반환 */
    @GetMapping("/auth-url")
    public ResponseEntity<Map<String, String>> getAuthUrl(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        String url = googleOAuthService.buildAuthorizationUrl(userDetails.getUserSqno());
        return ResponseEntity.ok(Map.of("authUrl", url));
    }

    /** 구글 콜백: code → 토큰 교환 + DB 저장 */
    @GetMapping("/callback")
    public ResponseEntity<Map<String, String>> callback(
            @RequestParam String code,
            @RequestParam String state) {
        try {
            Long userSqno = Long.parseLong(state);
            googleOAuthService.exchangeCode(code, userSqno);
            return ResponseEntity.ok(Map.of("result", "ok"));
        } catch (Exception e) {
            log.error("Google OAuth callback error: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    /** 연결 해제 */
    @DeleteMapping("/disconnect")
    public ResponseEntity<Void> disconnect(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        googleOAuthService.revokeToken(userDetails.getUserSqno());
        return ResponseEntity.noContent().build();
    }

    /** 연결 상태 확인 */
    @GetMapping("/status")
    public ResponseEntity<Map<String, Boolean>> status(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        boolean connected = googleOAuthService.isConnected(userDetails.getUserSqno());
        return ResponseEntity.ok(Map.of("connected", connected));
    }
}
