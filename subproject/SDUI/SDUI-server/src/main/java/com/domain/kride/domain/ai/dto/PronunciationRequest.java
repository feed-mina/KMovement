package com.domain.kride.domain.ai.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class PronunciationRequest {
    private String spoken;   // 사용자가 실제로 말한 텍스트 (STT 결과)
    private String expected; // 기대 텍스트 (AI가 제시한 문장)
    private String language; // 언어 코드 (en, ja, ko)
}
