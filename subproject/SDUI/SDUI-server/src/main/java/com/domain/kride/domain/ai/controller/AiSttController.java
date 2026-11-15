package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.SttResponse;
import com.domain.kride.domain.ai.service.SttService;
import com.domain.kride.global.common.response.ApiResponse;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiSttController {

    private final SttService sttService;

    /**
     * POST /api/ai/stt
     * multipart/form-data: audio(file), language(string, default="en")
     */
    @PostMapping("/stt")
    public ResponseEntity<ApiResponse<SttResponse>> transcribe(
            @RequestParam("audio") MultipartFile audio,
            @RequestParam(value = "language", defaultValue = "en") String language,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("STT 요청 - userId={}, language={}, size={}bytes",
                userDetails != null ? userDetails.getUserSqno() : "GUEST", 
                language, audio.getSize());


        SttResponse result = sttService.transcribe(audio, language);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
