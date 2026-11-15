// V2 — 테스트용 복사본 (AiChatController.java 기반)
// 새 엔드포인트: POST /api/ai/v2/chat/stream
package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.ChatRequest;
import com.domain.kride.domain.ai.service.ChatServiceV2;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.Executor;

@Slf4j
@RestController
@RequestMapping("/api/ai/v2")
public class AiChatControllerV2 {

    private final ChatServiceV2 chatServiceV2;
    private final Executor sseExecutor;

    public AiChatControllerV2(ChatServiceV2 chatServiceV2,
                               @Qualifier("sseExecutor") Executor sseExecutor) {
        this.chatServiceV2 = chatServiceV2;
        this.sseExecutor = sseExecutor;
    }

    /**
     * POST /api/ai/v2/chat/stream
     * V2 테스트 전용 Chat SSE 스트리밍
     */
    @PostMapping("/chat/stream")
    public SseEmitter streamChat(
            @RequestBody ChatRequest req,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        Long userId = userDetails.getUserSqno();
        log.info("[V2] 채팅 스트리밍 요청 - userId={}", userId);

        SseEmitter emitter = new SseEmitter(180_000L); // 3분 타임아웃
        sseExecutor.execute(() -> chatServiceV2.stream(req, userId, emitter));
        return emitter;
    }

    /**
     * POST /api/ai/v2/chat/translate
     * 자유 대화용 텍스트 번역 (동기식)
     */
    @PostMapping("/chat/translate")
    public com.domain.kride.global.common.response.ApiResponse<String> translate(
            @RequestBody java.util.Map<String, String> req) throws Exception {

        String text = req.get("text");
        String target = req.getOrDefault("target", "en");

        log.info("[V2] 번역 요청 - target={}, length={}", target, text != null ? text.length() : 0);

        String translated = chatServiceV2.translate(text, target);
        return com.domain.kride.global.common.response.ApiResponse.success(translated);
    }
}
