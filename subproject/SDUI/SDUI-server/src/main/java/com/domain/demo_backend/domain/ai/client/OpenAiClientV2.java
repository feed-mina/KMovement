// V2 — 테스트용 복사본 (OpenAiClient.java 기반)
// 수정사항: language=null 이면 파라미터 미전송 (Whisper 자동 감지)
package com.domain.demo_backend.domain.ai.client;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.ratelimiter.annotation.RateLimiter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Slf4j
@Component
public class OpenAiClientV2 {

    private static final String OPENAI_BASE_URL = "https://api.openai.com/v1";

    @Value("${openai.api-key}")
    private String apiKey;

    @Value("${openai.model:gpt-4o}")
    private String model;

    @Value("${openai.whisper-model:whisper-1}")
    private String whisperModel;

    private final WebClient webClient = WebClient.create();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * STT V2: language=null이면 파라미터 전송 안 함 → Whisper 자동 감지
     */
    @CircuitBreaker(name = "openai", fallbackMethod = "transcribeFallback")
    @RateLimiter(name = "openai")
    @SuppressWarnings("unchecked")
    public String transcribe(MultipartFile audio, String language) throws IOException {
        byte[] audioBytes = audio.getBytes();
        String originalFilename = audio.getOriginalFilename() != null
                ? audio.getOriginalFilename() : "audio.webm";

        ByteArrayResource audioResource = new ByteArrayResource(audioBytes) {
            @Override
            public String getFilename() { return originalFilename; }
        };

        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        builder.part("file", audioResource).filename(originalFilename);
        builder.part("model", whisperModel);
        // ✅ V2 핵심 수정: null이면 language 파라미터 자체를 전송 안 함
        if (language != null && !language.isBlank()) {
            builder.part("language", language);
            log.debug("[V2] STT language 강제 설정: {}", language);
        } else {
            log.debug("[V2] STT language 미설정 → Whisper 자동 감지");
        }

        Map<String, Object> response = webClient.post()
                .uri(OPENAI_BASE_URL + "/audio/transcriptions")
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(BodyInserters.fromMultipartData(builder.build()))
                .retrieve()
                .bodyToMono(Map.class)
                .block();

        if (response == null || response.get("text") == null) {
            throw new IllegalStateException("Whisper API 응답이 비어 있습니다.");
        }
        return response.get("text").toString();
    }

    /**
     * Chat Completions SSE 스트리밍 V2
     * ✅ V2 추가 로깅: 청크 수신 확인용
     */
    @CircuitBreaker(name = "openai", fallbackMethod = "streamChatFallback")
    @RateLimiter(name = "openai")
    public void streamChat(
            List<Map<String, String>> messages,
            Consumer<String> onChunk,
            Runnable onComplete) throws Exception {

        String jsonBody = objectMapper.writeValueAsString(Map.of(
                "model", model,
                "messages", messages,
                "stream", true
        ));

        log.info("[V2] Chat 스트리밍 시작, model={}, messages={}", model, messages.size());

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_BASE_URL + "/chat/completions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<InputStream> response = httpClient.send(
                request, HttpResponse.BodyHandlers.ofInputStream()
        );

        if (response.statusCode() != 200) {
            String errorBody = new String(response.body().readAllBytes());
            throw new IllegalStateException("OpenAI API 오류: HTTP " + response.statusCode() + " - " + errorBody);
        }

        int chunkCount = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(response.body(), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.startsWith("data: ") && !line.equals("data: [DONE]")) {
                    String json = line.substring(6).trim();
                    try {
                        String chunk = extractChunkContent(json);
                        if (chunk != null && !chunk.isEmpty()) {
                            onChunk.accept(chunk);
                            chunkCount++;
                        }
                    } catch (Exception e) {
                        log.warn("[V2] SSE 청크 파싱 실패 (무시): {}", json);
                    }
                }
            }
        }
        log.info("[V2] Chat 스트리밍 완료, 총 {}개 청크 전송", chunkCount);
        onComplete.run();
    }

    /**
     * TTS V2: OpenAI TTS API 호출
     * model: tts-1, voice: alloy/nova 등 선택 가능
     */
    @CircuitBreaker(name = "openai", fallbackMethod = "generateSpeechFallback")
    @RateLimiter(name = "openai")
    public byte[] generateSpeech(String text, String voice) throws Exception {
        Map<String, Object> body = Map.of(
                "input", text,
                "voice", (voice != null && !voice.isBlank()) ? voice : "alloy"
        );
        body = new java.util.HashMap<>(body);
        body.put("model", "tts-1");

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_BASE_URL + "/audio/speech"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();

        log.info("[V2] TTS 요청 시작: {}자", text.length());
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() != 200) {
            String errorMsg = new String(response.body());
            throw new IllegalStateException("OpenAI TTS 오류: " + errorMsg);
        }

        return response.body();
    }

    /**
     * Translate V2: OpenAI Chat Completions API를 사용한 고도화된 번역
     */
    @CircuitBreaker(name = "openai", fallbackMethod = "translateFallback")
    @RateLimiter(name = "openai")
    public String translate(String text, String targetLanguage) throws Exception {
        String prompt = String.format(
                "Translate the following text into %s. Respond ONLY with the translated text. do not add any explanation or quotes.\n\nText: %s",
                targetLanguage, text
        );

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", "You are a professional translator."),
                Map.of("role", "user", "content", prompt)
        );

        String jsonBody = objectMapper.writeValueAsString(Map.of(
                "model", model,
                "messages", messages,
                "temperature", 0.0
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_BASE_URL + "/chat/completions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        log.info("[V2] Translation 요청 시작: target={}, length={}", targetLanguage, text.length());
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new IllegalStateException("OpenAI Translation 오류: HTTP " + response.statusCode() + " - " + response.body());
        }

        Map<String, Object> data = objectMapper.readValue(response.body(), Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) data.get("choices");
        if (choices == null || choices.isEmpty()) return text;

        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        return message.get("content").toString().trim();
    }

    /**
     * Expression Evaluation: GPT로 사용자 발화의 표현 품질 평가
     * @CircuitBreaker + @RateLimiter 적용
     * @param spoken   사용자 발화 텍스트 (STT 결과)
     * @param language 언어 코드 (en, ja)
     * @return Map with keys: score(Number), feedback(String), idealExpression(String)
     */
    @CircuitBreaker(name = "openai", fallbackMethod = "evaluateExpressionFallback")
    @RateLimiter(name = "openai")
    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluateExpression(String spoken, String language) throws Exception {
        String targetLangName = "ja".equals(language) ? "Japanese" : "English";
        String feedbackLangName = "ja".equals(language) ? "Korean" : "English";
        String prompt = String.format(
                "User said the following in %s: \"%s\"\n\n" +
                "Evaluate their expression quality. Respond ONLY in JSON:\n" +
                "{\"score\": <0-100>, \"feedback\": \"<one sentence in %s>\", \"idealExpression\": \"<natural corrected version in %s>\"}\n\n" +
                "- score: 100 = perfectly natural native-speaker expression\n" +
                "- feedback: point out the main issue or praise the expression (MUST be written in %s)\n" +
                "- idealExpression: natural version of what the user tried to say (MUST be written in %s)",
                targetLangName, spoken, feedbackLangName, targetLangName, feedbackLangName, targetLangName
        );

        List<Map<String, String>> messages = List.of(
                Map.of("role", "system", "content", "You are an expert language teacher evaluating student expression quality."),
                Map.of("role", "user", "content", prompt)
        );

        Map<String, Object> requestBody = new java.util.HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", messages);
        requestBody.put("temperature", 0.2);
        requestBody.put("response_format", Map.of("type", "json_object"));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(OPENAI_BASE_URL + "/chat/completions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(requestBody)))
                .build();

        log.info("[V2] Expression 평가 요청: lang={}, spoken={}", language,
                spoken.length() > 30 ? spoken.substring(0, 30) + "..." : spoken);
        HttpResponse<String> httpResp = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (httpResp.statusCode() != 200) {
            throw new IllegalStateException("OpenAI Expression 평가 오류: HTTP " + httpResp.statusCode() + " - " + httpResp.body());
        }

        Map<String, Object> data = objectMapper.readValue(httpResp.body(), Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) data.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new IllegalStateException("OpenAI 응답에 choices가 없습니다.");
        }

        Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
        String content = message.get("content").toString().trim();
        return objectMapper.readValue(content, Map.class);
    }

    @SuppressWarnings("unchecked")
    private String extractChunkContent(String json) throws Exception {
        Map<String, Object> data = objectMapper.readValue(json, Map.class);
        List<Map<String, Object>> choices = (List<Map<String, Object>>) data.get("choices");
        if (choices == null || choices.isEmpty()) return null;

        Map<String, Object> delta = (Map<String, Object>) choices.get(0).get("delta");
        if (delta == null) return null;

        Object content = delta.get("content");
        return content != null ? content.toString() : null;
    }

    // ── Resilience4j Fallback 메서드 ──

    @SuppressWarnings("unused")
    private String transcribeFallback(MultipartFile audio, String language, Throwable t) {
        log.warn("[CircuitBreaker-V2] STT fallback: {}", t.getMessage());
        throw new IllegalStateException("AI 서비스가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.");
    }

    @SuppressWarnings("unused")
    private void streamChatFallback(List<Map<String, String>> messages, Consumer<String> onChunk, Runnable onComplete, Throwable t) {
        log.warn("[CircuitBreaker-V2] streamChat fallback: {}", t.getMessage());
        onChunk.accept("AI 서비스가 일시적으로 이용 불가합니다. 잠시 후 다시 시도해주세요.");
        onComplete.run();
    }

    @SuppressWarnings("unused")
    private byte[] generateSpeechFallback(String text, String voice, Throwable t) {
        log.warn("[CircuitBreaker-V2] TTS fallback: {}", t.getMessage());
        throw new IllegalStateException("TTS 서비스가 일시적으로 이용 불가합니다.");
    }

    @SuppressWarnings("unused")
    private String translateFallback(String text, String targetLanguage, Throwable t) {
        log.warn("[CircuitBreaker-V2] translate fallback: {}", t.getMessage());
        return text; // 번역 실패 시 원문 반환
    }

    @SuppressWarnings("unused")
    private Map<String, Object> evaluateExpressionFallback(String spoken, String language, Throwable t) {
        log.warn("[CircuitBreaker-V2] evaluateExpression fallback: {}", t.getMessage());
        return Map.of("score", 0, "feedback", "평가 서비스가 일시적으로 이용 불가합니다.", "idealExpression", spoken);
    }
}
