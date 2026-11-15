package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.PronunciationResponse;
import com.domain.kride.domain.ai.service.PronunciationService;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AiPronunciationController 통합 테스트")
class AiPronunciationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PronunciationService pronunciationService;

    private CustomUserDetails mockUser;

    @BeforeEach
    void setUp() {
        mockUser = mock(CustomUserDetails.class);
        when(mockUser.getUserSqno()).thenReturn(1L);
    }

    @Test
    @DisplayName("POST /api/ai/pronunciation: 인증된 요청 시 평가 결과를 반환해야 함")
    void checkPronunciation_shouldReturnOkWithData() throws Exception {
        // Given
        PronunciationResponse response = new PronunciationResponse(
                85, "Great expression!", "What a beautiful day it is!"
        );
        when(pronunciationService.score(any())).thenReturn(response);

        String requestJson = objectMapper.writeValueAsString(
                Map.of("spoken", "It's a beautiful day", "language", "en")
        );

        // When / Then
        mockMvc.perform(post("/api/ai/pronunciation")
                        .with(user(mockUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.score").value(85))
                .andExpect(jsonPath("$.data.feedback").value("Great expression!"))
                .andExpect(jsonPath("$.data.idealExpression").value("What a beautiful day it is!"));

        verify(pronunciationService, times(1)).score(any());
    }

    @Test
    @DisplayName("POST /api/ai/pronunciation: 일본어 요청도 정상 처리해야 함")
    void checkPronunciation_shouldHandleJapaneseRequest() throws Exception {
        // Given
        PronunciationResponse response = new PronunciationResponse(
                90, "自然な表現です", "今日は良いお天気ですね"
        );
        when(pronunciationService.score(any())).thenReturn(response);

        String requestJson = objectMapper.writeValueAsString(
                Map.of("spoken", "今日はいい天気ですね", "language", "ja")
        );

        // When / Then
        mockMvc.perform(post("/api/ai/pronunciation")
                        .with(user(mockUser))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.score").value(90));

        verify(pronunciationService, times(1)).score(any());
    }

    @Test
    @DisplayName("POST /api/ai/pronunciation: 미인증 요청은 거부되어야 함")
    void checkPronunciation_shouldRejectUnauthenticated() throws Exception {
        // Given
        String requestJson = objectMapper.writeValueAsString(
                Map.of("spoken", "Hello", "language", "en")
        );

        // When / Then
        mockMvc.perform(post("/api/ai/pronunciation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(requestJson))
                .andExpect(status().isForbidden());

        verifyNoInteractions(pronunciationService);
    }
}
