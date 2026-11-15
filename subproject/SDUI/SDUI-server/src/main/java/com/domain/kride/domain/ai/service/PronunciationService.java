package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.OpenAiClientV2;
import com.domain.kride.domain.ai.dto.PronunciationRequest;
import com.domain.kride.domain.ai.dto.PronunciationResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class PronunciationService {

    private final OpenAiClientV2 openAiClientV2;

    /**
     * GPT로 사용자 발화의 표현 품질 평가
     * - spoken 텍스트를 GPT에게 전달하여 점수, 피드백, 이상적 표현 반환
     * - FastAPI SequenceMatcher 방식 대체 (비교 기준 텍스트 불필요)
     */
    public PronunciationResponse score(PronunciationRequest req) {
        try {
            Map<String, Object> result = openAiClientV2.evaluateExpression(
                    req.getSpoken(), req.getLanguage()
            );

            int score = result.containsKey("score")
                    ? ((Number) result.get("score")).intValue()
                    : 0;
            String feedback = (String) result.getOrDefault("feedback", "");
            String idealExpression = (String) result.getOrDefault("idealExpression", "");

            log.info("표현 평가 완료: score={}, lang={}", score, req.getLanguage());
            return new PronunciationResponse(score, feedback, idealExpression);

        } catch (Exception e) {
            log.error("표현 평가 실패: {}", e.getMessage());
            throw new IllegalStateException("표현 평가에 실패했습니다: " + e.getMessage());
        }
    }
}
