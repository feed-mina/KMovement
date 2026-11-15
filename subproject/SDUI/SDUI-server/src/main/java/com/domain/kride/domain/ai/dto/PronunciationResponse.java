package com.domain.kride.domain.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@AllArgsConstructor
@NoArgsConstructor
public class PronunciationResponse {
    private int score;              // 0~100 표현 품질 점수
    private String feedback;        // 피드백 메시지
    private String idealExpression; // GPT가 생성한 이상적 표현
}
