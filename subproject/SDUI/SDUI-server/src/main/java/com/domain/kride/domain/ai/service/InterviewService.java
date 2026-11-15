package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.GoogleDocumentAiClient;
import com.domain.kride.domain.ai.client.OpenAiClient;
import com.domain.kride.domain.ai.dto.InterviewAnswerRequest;
import com.domain.kride.domain.ai.dto.InterviewStartRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InterviewService {

    private static final String SYSTEM_PROMPT_KO = """
            당신은 경력 면접관입니다. 아래 이력서를 바탕으로 면접을 진행하세요.
            - 질문은 1개씩 차례로 합니다.
            - 구체적인 경험과 역량을 검증하는 질문을 합니다.
            - 이전 답변을 참조해 후속 질문을 자연스럽게 이어가세요.
            """;

    private static final String SYSTEM_PROMPT_EN = """
            You are an experienced interviewer. Conduct an interview based on the resume below.
            - Ask one question at a time.
            - Focus on verifying specific experience and competencies.
            - Follow up naturally based on previous answers.
            """;

    private final OpenAiClient openAiClient;
    private final S3Service s3Service;
    private final GoogleDocumentAiClient documentAiClient;

    /**
     * 면접 시작: resumeFileKey 유형에 따라 분기
     * - image (jpg/png/webp): S3 Presigned URL → GPT-4o Vision API
     * - pdf:                  S3 다운로드 → Google Document AI OCR → 텍스트 → GPT-4o
     * - 없음:                 resumeText 텍스트 직접 경로
     */
    public void startInterview(InterviewStartRequest req, SseEmitter emitter) {
        boolean hasFileKey = req.getResumeFileKey() != null && !req.getResumeFileKey().isBlank();
        String template = req.getSystemPromptTemplate();

        if (hasFileKey) {
            String fileType = s3Service.detectFileType(req.getResumeFileKey());
            if ("image".equals(fileType)) {
                startInterviewWithVision(req.getLanguage(), req.getResumeFileKey(), template, emitter);
            } else if ("pdf".equals(fileType)) {
                startInterviewWithPdf(req.getLanguage(), req.getResumeFileKey(), template, emitter);
            } else {
                log.warn("지원하지 않는 파일 유형 — 텍스트 경로로 fallback: key={}", req.getResumeFileKey());
                startInterviewWithText(req.getLanguage(), req.getResumeText(), template, emitter);
            }
        } else {
            startInterviewWithText(req.getLanguage(), req.getResumeText(), template, emitter);
        }
    }

    /** 텍스트 경로 */
    private void startInterviewWithText(String language, String resumeText, String template, SseEmitter emitter) {
        String systemPrompt = buildSystemPrompt(language, resumeText, template);
        String startMessage = "ko".equals(language)
                ? "면접을 시작해주세요."
                : "Please start the interview.";

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", startMessage)
        );

        streamToEmitter(messages, emitter, "면접 시작(텍스트)");
    }

    /** Vision 경로: S3 Presigned URL → GPT-4o Vision API (이미지) */
    private void startInterviewWithVision(String language, String fileKey, String template, SseEmitter emitter) {
        try {
            String presignedUrl = s3Service.generatePresignedUrl(fileKey, 15);
            String systemPrompt = buildSystemPromptBase(language, template);
            String promptText = "ko".equals(language)
                    ? "이 이력서를 분석하고 면접관으로서 첫 질문을 해주세요."
                    : "Analyze this resume and ask your first interview question.";

            List<Map<String, Object>> messages = List.of(
                    Map.of("role", "system", "content", (Object) systemPrompt),
                    Map.of("role", "user", "content", (Object) List.of(
                            Map.of("type", "text", "text", promptText),
                            Map.of("type", "image_url", "image_url", Map.of("url", presignedUrl))
                    ))
            );

            streamToEmitterObjects(messages, emitter, "면접 시작(Vision)");
        } catch (Exception e) {
            log.error("Vision 면접 시작 실패: key={}", fileKey, e);
            emitter.completeWithError(e);
        }
    }

    /** PDF 경로: S3 다운로드 → Google Document AI OCR → 텍스트 → GPT-4o */
    private void startInterviewWithPdf(String language, String fileKey, String template, SseEmitter emitter) {
        try {
            byte[] pdfBytes = s3Service.downloadBytes(fileKey);
            String extractedText = documentAiClient.extractTextFromPdf(pdfBytes);
            log.info("PDF OCR 완료: key={}, 추출 {}자", fileKey, extractedText.length());
            startInterviewWithText(language, extractedText, template, emitter);
        } catch (Exception e) {
            log.error("PDF 면접 시작 실패: key={}", fileKey, e);
            emitter.completeWithError(e);
        }
    }

    /**
     * 면접 답변 제출: 대화 이력 + 새 답변 → 후속 질문 SSE 스트리밍
     */
    public void continueInterview(InterviewAnswerRequest req, SseEmitter emitter) {
        String systemPrompt = buildSystemPrompt(req.getLanguage(), req.getResumeText(), req.getSystemPromptTemplate());

        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));

        if (req.getHistory() != null) {
            for (var msg : req.getHistory()) {
                messages.add(Map.of("role", msg.getRole(), "content", msg.getContent()));
            }
        }

        messages.add(Map.of("role", "user", "content", req.getAnswerText()));
        streamToEmitter(messages, emitter, "면접 답변");
    }

    private String buildSystemPromptBase(String language, String template) {
        if (template != null && !template.isBlank()) return template;
        return "ko".equals(language) ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN;
    }

    private String buildSystemPrompt(String language, String resumeText, String template) {
        String base = buildSystemPromptBase(language, template);
        if (resumeText == null || resumeText.isBlank()) return base;
        String resumeLabel = "ko".equals(language) ? "\n\n이력서:\n" : "\n\nResume:\n";
        return base + resumeLabel + resumeText;
    }

    private void streamToEmitterObjects(List<Map<String, Object>> messages, SseEmitter emitter, String context) {
        try {
            openAiClient.streamChatObjects(
                    messages,
                    chunk -> {
                        try {
                            emitter.send(SseEmitter.event()
                                    .data("{\"chunk\":\"" + escapeJson(chunk) + "\"}"));
                        } catch (Exception e) {
                            log.warn("SSE 청크 전송 실패 ({})", context, e);
                        }
                    },
                    () -> {
                        try {
                            emitter.send(SseEmitter.event().data("[DONE]"));
                            emitter.complete();
                        } catch (Exception e) {
                            log.warn("SSE 완료 전송 실패 ({})", context, e);
                        }
                    }
            );
        } catch (Exception e) {
            log.error("인터뷰 스트리밍 실패 ({})", context, e);
            emitter.completeWithError(e);
        }
    }

    private void streamToEmitter(List<Map<String, String>> messages, SseEmitter emitter, String context) {
        try {
            openAiClient.streamChat(
                    messages,
                    chunk -> {
                        try {
                            emitter.send(SseEmitter.event()
                                    .data("{\"chunk\":\"" + escapeJson(chunk) + "\"}"));
                        } catch (Exception e) {
                            log.warn("SSE 청크 전송 실패 ({})", context, e);
                        }
                    },
                    () -> {
                        try {
                            emitter.send(SseEmitter.event().data("[DONE]"));
                            emitter.complete();
                        } catch (Exception e) {
                            log.warn("SSE 완료 전송 실패 ({})", context, e);
                        }
                    }
            );
        } catch (Exception e) {
            log.error("인터뷰 스트리밍 실패 ({})", context, e);
            emitter.completeWithError(e);
        }
    }

    private String escapeJson(String text) {
        return text.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
