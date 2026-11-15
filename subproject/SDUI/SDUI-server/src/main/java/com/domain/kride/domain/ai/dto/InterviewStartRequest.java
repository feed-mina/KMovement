package com.domain.kride.domain.ai.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class InterviewStartRequest {
    private String resumeText;            // 텍스트 직접 입력
    private String resumeFileKey;         // S3 key — 이미지 또는 PDF 업로드 후 반환된 값
    private String language;              // "en" | "ko"
    private String systemPromptTemplate;  // DB에서 전달된 시스템 프롬프트 (null 시 기본값 사용)
}
