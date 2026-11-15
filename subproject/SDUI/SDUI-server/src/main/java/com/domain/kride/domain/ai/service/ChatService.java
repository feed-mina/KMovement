package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.OpenAiClient;
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
public class ChatService {

    private final OpenAiClient openAiClient;

    public void stream(ChatRequest req, Long userId, SseEmitter emitter) {
        try {
            List<Map<String, String>> messages = req.getMessages().stream()
                    .map(m -> Map.of("role", m.getRole(), "content", m.getContent()))
                    .collect(Collectors.toList());

            openAiClient.streamChat(
                    messages,
                    chunk -> {
                        try {
                            emitter.send(SseEmitter.event()
                                    .data("{\"content\":\"" + escapeJson(chunk) + "\"}"));
                        } catch (Exception e) {
                            log.warn("SSE 청크 전송 실패 (userId={})", userId, e);
                        }
                    },
                    () -> {
                        try {
                            emitter.send(SseEmitter.event().data("[DONE]"));
                            emitter.complete();
                        } catch (Exception e) {
                            log.warn("SSE 완료 전송 실패 (userId={})", userId, e);
                        }
                    }
            );
        } catch (Exception e) {
            log.error("채팅 스트리밍 실패 (userId={})", userId, e);
            emitter.completeWithError(e);
        }
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    public String createGuestReply(String message, String lang) {
        try {
            String systemPrompt = "You are the official 'AI Gwanghwamun Guide' for the BTS 2026 event. You are friendly, helpful, and provide accurate information about the event schedule, Gwanghwamun landmarks, safety guidelines, and nearby facilities. " +
                    "Focus on making fans' experience memorable and safe. If you don't know specific internal event details, advise them to check with staff on-site. " +
                    "Current language: " + lang + ". Please respond naturally in " + lang + ".";
            
            List<Map<String, String>> messages = List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", message)
            );

            return openAiClient.chat(messages);
        } catch (Exception e) {
            log.error("게스트 채팅 답변 생성 실패", e);
            return "죄송합니다. 서비스 연결 중 오류가 발생했습니다. (Sorry, an error occurred.)";
        }
    }
}
