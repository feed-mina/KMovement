package com.domain.demo_backend.domain.kridechat.controller;

import com.domain.demo_backend.domain.kridechat.dto.ChatQueryRequest;
import com.domain.demo_backend.domain.kridechat.dto.ChatQueryResponse;
import com.domain.demo_backend.domain.kridechat.service.KrideChatService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.concurrent.Executor;

@Slf4j
@RestController
@RequestMapping("/api/v1/kride/chat")
@Tag(name = "KRIDE Chatbot", description = "KRIDE 여행 챗봇 API")
public class KrideChatController {

    private final KrideChatService chatService;
    private final Executor sseExecutor;

    public KrideChatController(KrideChatService chatService,
                                @Qualifier("sseExecutor") Executor sseExecutor) {
        this.chatService = chatService;
        this.sseExecutor = sseExecutor;
    }

    @Operation(summary = "통합 챗봇 (여행 추천 + Q&A)")
    @PostMapping
    public ResponseEntity<ApiResponse<ChatQueryResponse>> chat(
            @RequestBody ChatQueryRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("KRIDE 챗봇 요청 - message={}", request.getMessage());
        attachUserContext(request, userDetails);
        ChatQueryResponse response = chatService.chat(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @Operation(summary = "SSE 스트리밍 챗봇")
    @PostMapping("/stream")
    public SseEmitter streamChat(
            @RequestBody ChatQueryRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("KRIDE 챗봇 스트리밍 요청 - message={}", request.getMessage());
        attachUserContext(request, userDetails);
        SseEmitter emitter = new SseEmitter(180_000L);
        chatService.streamChat(request, emitter, sseExecutor);
        return emitter;
    }

    private void attachUserContext(ChatQueryRequest request, CustomUserDetails userDetails) {
        if (userDetails == null) {
            return;
        }
        if (request.getUserSqno() == null) {
            request.setUserSqno(userDetails.getUserSqno());
        }
        if (request.getUserId() == null || request.getUserId().isBlank()) {
            request.setUserId(userDetails.getUserId());
        }
    }
}
