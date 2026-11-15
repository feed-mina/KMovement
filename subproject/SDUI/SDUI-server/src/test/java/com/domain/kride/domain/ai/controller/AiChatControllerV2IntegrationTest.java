package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.ChatRequest;
import com.domain.kride.domain.ai.dto.ChatMessage;
import com.domain.kride.domain.ai.service.ChatServiceV2;
import com.domain.kride.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "openai.api-key=test-key",
    "openai.model=gpt-4o",
    "openai.whisper-model=whisper-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AiChatControllerV2 통합 테스트")
class AiChatControllerV2IntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChatServiceV2 chatServiceV2;

    private CustomUserDetails mockUser;

    @BeforeEach
    void setUp() {
        mockUser = mock(CustomUserDetails.class);
        when(mockUser.getUserSqno()).thenReturn(1L);
    }

    @Test
    @DisplayName("POST /api/ai/v2/chat/stream: 인증된 사용자의 스트리밍 요청 처리")
    void streamChat_shouldReturnSseEmitter() throws Exception {
        // Given
        ChatRequest req = new ChatRequest();
        ChatMessage msg = new ChatMessage();
        msg.setRole("user");
        msg.setContent("Test message");
        req.setMessages(List.of(msg));

        // When & Then
        mockMvc.perform(post("/api/ai/v2/chat/stream")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(chatServiceV2).stream(any(ChatRequest.class), eq(1L), any());
    }

    @Test
    @DisplayName("POST /api/ai/v2/chat/translate: 번역 요청이 서비스로 전달되어야 함")
    void translate_shouldCallService() throws Exception {
        // Given
        java.util.Map<String, String> req = new java.util.HashMap<>();
        req.put("text", "Hello");
        req.put("target", "ko");

        when(chatServiceV2.translate("Hello", "ko")).thenReturn("안녕");

        // When & Then
        mockMvc.perform(post("/api/ai/v2/chat/translate")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(chatServiceV2).translate("Hello", "ko");
    }
}
