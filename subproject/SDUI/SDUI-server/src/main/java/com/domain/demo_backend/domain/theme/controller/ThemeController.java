package com.domain.demo_backend.domain.theme.controller;

import com.domain.demo_backend.domain.theme.dto.ThemeResponseDto;
import com.domain.demo_backend.domain.theme.service.ThemeService;
import com.domain.demo_backend.global.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

// 2026-06-12 DB 기반 테마 시스템 (GitHub issue #4 Phase 3)
// GET  /api/ui/theme/{themeId} — 공개 (SecurityConfig의 /api/ui/** permitAll)
// PUT  /api/ui/theme/{themeId} — 관리자 전용 (SecurityConfig에 별도 ADMIN 규칙)
@RestController
@RequestMapping("/api/ui/theme")
public class ThemeController {
    private static final Logger log = LoggerFactory.getLogger(ThemeController.class);

    private final ThemeService themeService;

    public ThemeController(ThemeService themeService) {
        this.themeService = themeService;
    }

    @GetMapping("/{themeId}")
    public ApiResponse<ThemeResponseDto> getTheme(@PathVariable String themeId) {
        try {
            return ApiResponse.success(themeService.getTheme(themeId));
        } catch (IllegalArgumentException e) {
            log.error("테마 조회 실패: themeId={}, message={}", themeId, e.getMessage());
            return ApiResponse.error(e.getMessage());
        }
    }

    // body 예시: { "primary": "#E50914", "bg-cream": "#FDFBF7" }
    @PutMapping("/{themeId}")
    public ApiResponse<ThemeResponseDto> updateTheme(
            @PathVariable String themeId,
            @RequestBody Map<String, String> tokenUpdates
    ) {
        try {
            ThemeResponseDto updated = themeService.updateTokens(themeId, tokenUpdates);
            log.info("테마 토큰 수정 완료: themeId={}, keys={}", themeId, tokenUpdates.keySet());
            return ApiResponse.success(updated);
        } catch (IllegalArgumentException e) {
            log.error("테마 수정 실패: themeId={}, message={}", themeId, e.getMessage());
            return ApiResponse.error(e.getMessage());
        }
    }
}
