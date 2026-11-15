// V2 — 테스트용 TTS 컨트롤러
package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.client.OpenAiClientV2;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai/v2")
public class AiTtsControllerV2 {

    private final OpenAiClientV2 openAiClientV2;

    /**
     * GET /api/ai/v2/tts
     * 텍스트를 음성으로 변환 (OpenAI TTS 사용)
     * voice: alloy, echo, fable, onyx, nova, shimmer 선택 가능
     */
    @GetMapping("/tts")
    public ResponseEntity<byte[]> generateSpeech(
            @RequestParam("text") String text,
            @RequestParam(value = "voice", defaultValue = "alloy") String voice) {
        try {
            byte[] audioData = openAiClientV2.generateSpeech(text, voice);

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, "audio/mpeg")
                    .body(audioData);
        } catch (Exception e) {
            log.error("[V2] TTS 생성 실패", e);
            return ResponseEntity.internalServerError().build();
        }
    }
}
