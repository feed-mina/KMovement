package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.ChatRequest;
import com.domain.kride.domain.ai.service.ChatService;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.concurrent.Executor;

@Slf4j
@RestController
@RequestMapping("/api/ai")
public class AiChatController {

    private final ChatService chatService;
    private final Executor sseExecutor;

    // @Qualifier + Lombok @RequiredArgsConstructor 미지원 → 명시적 생성자 사용
    public AiChatController(ChatService chatService,
                             @Qualifier("sseExecutor") Executor sseExecutor) {
        this.chatService = chatService;
        this.sseExecutor = sseExecutor;
    }

    /**
     * POST /api/ai/chat/stream
     * 자유 대화 SSE 스트리밍 (messages 이력을 클라이언트가 유지해 전달)
     */
    @PostMapping("/chat/stream")
    public SseEmitter streamChat(
            @RequestBody ChatRequest req,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        Long userId = userDetails.getUserSqno();
        log.info("채팅 스트리밍 요청 - userId={}", userId);

        SseEmitter emitter = new SseEmitter(180_000L); // 3분 타임아웃
        sseExecutor.execute(() -> chatService.stream(req, userId, emitter));
        return emitter;
    }

    /**
     * POST /api/ai/guest/chat
     * 게스트용 단일 응답 채팅 (BTS 이벤트 페이지 등에서 사용)
     */
    @PostMapping("/guest/chat")
    public Map<String, String> guestChat(@RequestBody Map<String, String> body) {
        String message = body.get("message");
        String lang = body.get("lang");
        log.info("게스트 채팅 요청 - lang={}", lang);

        String reply = chatService.createGuestReply(message, lang);
        return Map.of("reply", reply);
    }
}
