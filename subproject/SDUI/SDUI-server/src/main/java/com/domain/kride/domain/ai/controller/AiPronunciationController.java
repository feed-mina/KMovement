package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.PronunciationRequest;
import com.domain.kride.domain.ai.dto.PronunciationResponse;
import com.domain.kride.domain.ai.service.PronunciationService;
import com.domain.kride.global.common.response.ApiResponse;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiPronunciationController {

    private final PronunciationService pronunciationService;

    /**
     * POST /api/ai/pronunciation
     * FastAPI /pronunciation-score 프록시
     * 사용자 발화(spoken)와 기대 텍스트(expected)를 비교하여 유사도 점수 반환
     * 응답에 spoken/expected를 포함하여 프론트에서 비교 UI를 렌더링할 수 있도록 함
     */
    @PostMapping("/pronunciation")
    public ResponseEntity<ApiResponse<PronunciationResponse>> checkPronunciation(
            @RequestBody PronunciationRequest req,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("발음 채점 요청 - userId={}, language={}", userDetails.getUserSqno(), req.getLanguage());

        PronunciationResponse result = pronunciationService.score(req);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
