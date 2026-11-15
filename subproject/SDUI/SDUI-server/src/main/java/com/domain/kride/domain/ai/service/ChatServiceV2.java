// V2 — 테스트용 복사본 (ChatService.java 기반)
// OpenAiClientV2 사용, SSE 키는 "content"로 전송
package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.OpenAiClientV2;
import com.domain.kride.domain.ai.dto.ChatRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatServiceV2 {

    private final OpenAiClientV2 openAiClientV2;

    public void stream(ChatRequest req, Long userId, SseEmitter emitter) {
        try {
            List<Map<String, String>> messages = req.getMessages().stream()
                    .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                    .collect(Collectors.toList());

            log.info("[V2] 스트리밍 시작 - userId={}, messages={}", userId, messages.size());

            openAiClientV2.streamChat(
                    messages,
                    chunk -> {
                        try {
                            // ✅ Map 객체로 전달하여 Spring/Jackson이 올바른 JSON으로 변환하게 함
                            emitter.send(SseEmitter.event()
                                    .data(Map.of("content", chunk)));
                        } catch (Exception e) {
                            log.warn("[V2] SSE 청크 전송 실패 (userId={})", userId, e);
                        }
                    },
                    () -> {
                        try {
                            emitter.send(SseEmitter.event().data("[DONE]"));
                            emitter.complete();
                            log.info("[V2] SSE 완료 - userId={}", userId);
                        } catch (Exception e) {
                            log.warn("[V2] SSE 완료 전송 실패 (userId={})", userId, e);
                        }
                    }
            );
        } catch (Exception e) {
            log.error("[V2] 채팅 스트리밍 실패 (userId={})", userId, e);
            emitter.completeWithError(e);
        }
    }

    public String translate(String text, String target) throws Exception {
        log.info("[V2] 번역 요청 - target={}, textLength={}", target, text.length());
        return openAiClientV2.translate(text, target);
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
