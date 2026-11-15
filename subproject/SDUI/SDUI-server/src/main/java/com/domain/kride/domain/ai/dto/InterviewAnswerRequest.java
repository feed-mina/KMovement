// 설계 결정: 서버 세션 대신 클라이언트가 대화 이력(history)을 유지해 전달
//   → Redis 세션 불필요 (Phase 2 단순화), 필요 시 Phase 3에서 세션 도입
package com.domain.kride.domain.ai.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class InterviewAnswerRequest {
    private String answerText;
    private List<ChatMessage> history;    // 이전 면접 대화 이력 (클라이언트 유지)
    private String resumeText;            // 시스템 프롬프트 재구성용
    private String language;              // "en" | "ko"
    private String systemPromptTemplate;  // 면접 시작 시 동일 프롬프트 재사용
}
