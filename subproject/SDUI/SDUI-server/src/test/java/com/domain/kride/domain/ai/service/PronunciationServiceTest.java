package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.OpenAiClientV2;
import com.domain.kride.domain.ai.dto.PronunciationRequest;
import com.domain.kride.domain.ai.dto.PronunciationResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PronunciationService 단위 테스트")
class PronunciationServiceTest {

    @Mock
    private OpenAiClientV2 openAiClientV2;

    @InjectMocks
    private PronunciationService pronunciationService;

    private PronunciationRequest buildRequest(String spoken, String language) {
        PronunciationRequest req = new PronunciationRequest();
        req.setSpoken(spoken);
        req.setLanguage(language);
        return req;
    }

    @Test
    @DisplayName("score: GPT 평가 결과를 PronunciationResponse로 변환해야 함")
    void score_shouldReturnMappedResponse() throws Exception {
        // Given
        PronunciationRequest req = buildRequest("It's a beautiful day", "en");

        Map<String, Object> gptResult = new HashMap<>();
        gptResult.put("score", 85);
        gptResult.put("feedback", "Great expression!");
        gptResult.put("idealExpression", "What a beautiful day it is!");

        when(openAiClientV2.evaluateExpression("It's a beautiful day", "en")).thenReturn(gptResult);

        // When
        PronunciationResponse result = pronunciationService.score(req);

        // Then
        assertThat(result.getScore()).isEqualTo(85);
        assertThat(result.getFeedback()).isEqualTo("Great expression!");
        assertThat(result.getIdealExpression()).isEqualTo("What a beautiful day it is!");
        verify(openAiClientV2, times(1)).evaluateExpression("It's a beautiful day", "en");
    }

    @Test
    @DisplayName("score: 일본어 language 코드로도 정상 처리해야 함")
    void score_shouldHandleJapaneseLanguage() throws Exception {
        // Given
        PronunciationRequest req = buildRequest("今日はいい天気ですね", "ja");

        Map<String, Object> gptResult = new HashMap<>();
        gptResult.put("score", 90);
        gptResult.put("feedback", "自然な表現です");
        gptResult.put("idealExpression", "今日は良いお天気ですね");

        when(openAiClientV2.evaluateExpression("今日はいい天気ですね", "ja")).thenReturn(gptResult);

        // When
        PronunciationResponse result = pronunciationService.score(req);

        // Then
        assertThat(result.getScore()).isEqualTo(90);
        assertThat(result.getFeedback()).isEqualTo("自然な表現です");
        assertThat(result.getIdealExpression()).isEqualTo("今日は良いお天気ですね");
        verify(openAiClientV2, times(1)).evaluateExpression("今日はいい天気ですね", "ja");
    }

    @Test
    @DisplayName("score: GPT 응답에 score 키가 없으면 0을 반환해야 함")
    void score_shouldReturnZeroWhenScoreKeyMissing() throws Exception {
        // Given
        PronunciationRequest req = buildRequest("hello", "en");

        Map<String, Object> gptResult = new HashMap<>();
        gptResult.put("feedback", "Some feedback");
        gptResult.put("idealExpression", "Hello!");

        when(openAiClientV2.evaluateExpression("hello", "en")).thenReturn(gptResult);

        // When
        PronunciationResponse result = pronunciationService.score(req);

        // Then
        assertThat(result.getScore()).isEqualTo(0);
        assertThat(result.getFeedback()).isEqualTo("Some feedback");
    }

    @Test
    @DisplayName("score: GPT 응답에 feedback/idealExpression이 없으면 빈 문자열을 반환해야 함")
    void score_shouldReturnEmptyStringsWhenOptionalFieldsMissing() throws Exception {
        // Given
        PronunciationRequest req = buildRequest("test", "en");

        Map<String, Object> gptResult = new HashMap<>();
        gptResult.put("score", 50);

        when(openAiClientV2.evaluateExpression("test", "en")).thenReturn(gptResult);

        // When
        PronunciationResponse result = pronunciationService.score(req);

        // Then
        assertThat(result.getScore()).isEqualTo(50);
        assertThat(result.getFeedback()).isEqualTo("");
        assertThat(result.getIdealExpression()).isEqualTo("");
    }

    @Test
    @DisplayName("score: OpenAI 호출 실패 시 IllegalStateException을 던져야 함")
    void score_shouldThrowIllegalStateExceptionOnFailure() throws Exception {
        // Given
        PronunciationRequest req = buildRequest("test", "en");

        when(openAiClientV2.evaluateExpression("test", "en"))
                .thenThrow(new RuntimeException("OpenAI API error"));

        // When / Then
        assertThatThrownBy(() -> pronunciationService.score(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("표현 평가에 실패했습니다");
    }
}
