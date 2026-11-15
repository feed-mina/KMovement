package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.client.GoogleDocumentAiClient;
import com.domain.kride.global.security.CustomUserDetails;
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

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AI_JAPANESE_CHAT_PAGE 메타데이터 조회 테스트")
class AiJapaneseChatMetadataTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private GoogleDocumentAiClient googleDocumentAiClient;

    private CustomUserDetails mockUser;

    @BeforeEach
    void setUp() {
        mockUser = mock(CustomUserDetails.class);
        when(mockUser.getUserSqno()).thenReturn(1L);
        when(mockUser.getUsername()).thenReturn("testuser");
    }

    @Test
    @DisplayName("GET /api/ui/AI_JAPANESE_CHAT_PAGE: 일본어 채팅 페이지 메타데이터 조회")
    void getJapaneseChatMetadata_shouldReturnOk() throws Exception {
        mockMvc.perform(get("/api/ui/AI_JAPANESE_CHAT_PAGE")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }
}
