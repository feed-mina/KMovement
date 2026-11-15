package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.client.GoogleDocumentAiClient;
import com.domain.kride.domain.ai.dto.InterviewAnswerRequest;
import com.domain.kride.domain.ai.dto.InterviewStartRequest;
import com.domain.kride.domain.ai.service.InterviewService;
import com.domain.kride.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.concurrent.Executor;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("AiInterviewController 통합 테스트")
class AiInterviewIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private InterviewService interviewService;

    @MockBean
    private GoogleDocumentAiClient googleDocumentAiClient;

    @MockBean
    @Qualifier("sseExecutor")
    private Executor sseExecutor;

    private CustomUserDetails mockUser;

    @BeforeEach
    void setUp() {
        mockUser = mock(CustomUserDetails.class);
        when(mockUser.getUserSqno()).thenReturn(1L);
        // sseExecutor를 동기 실행으로 설정: verify()가 즉시 동작하도록
        doAnswer(inv -> { ((Runnable) inv.getArgument(0)).run(); return null; })
                .when(sseExecutor).execute(any());
    }

    @Test
    @DisplayName("POST /api/ai/interview/start: 면접 시작 요청 처리")
    void startInterview_shouldReturnOk() throws Exception {
        InterviewStartRequest req = new InterviewStartRequest();
        req.setLanguage("en");

        mockMvc.perform(post("/api/ai/interview/start")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(interviewService).startInterview(any(), any());
    }

    @Test
    @DisplayName("POST /api/ai/interview/answer: 면접 답변 제출 처리")
    void submitAnswer_shouldReturnOk() throws Exception {
        InterviewAnswerRequest req = new InterviewAnswerRequest();
        req.setHistory(new ArrayList<>());

        mockMvc.perform(post("/api/ai/interview/answer")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(interviewService).continueInterview(any(), any());
    }

    @Test
    @DisplayName("POST /api/ai/interview/start: systemPromptTemplate 포함 시 정상 처리")
    void startInterview_withSystemPromptTemplate_shouldReturnOk() throws Exception {
        InterviewStartRequest req = new InterviewStartRequest();
        req.setLanguage("ko");
        req.setSystemPromptTemplate("당신은 Java 백엔드 전문 면접관입니다.");

        mockMvc.perform(post("/api/ai/interview/start")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(interviewService).startInterview(any(), any());
    }

    @Test
    @DisplayName("POST /api/ai/interview/answer: systemPromptTemplate 포함 답변 제출 처리")
    void submitAnswer_withSystemPromptTemplate_shouldReturnOk() throws Exception {
        InterviewAnswerRequest req = new InterviewAnswerRequest();
        req.setHistory(new ArrayList<>());
        req.setAnswerText("저는 3년간 Spring Boot 프로젝트를 담당했습니다.");
        req.setSystemPromptTemplate("당신은 Java 백엔드 전문 면접관입니다.");

        mockMvc.perform(post("/api/ai/interview/answer")
                .with(user(mockUser))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());

        verify(interviewService).continueInterview(any(), any());
    }
}
