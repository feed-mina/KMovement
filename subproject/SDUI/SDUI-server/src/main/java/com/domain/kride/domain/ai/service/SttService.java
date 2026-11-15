package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.OpenAiClient;
import com.domain.kride.domain.ai.dto.SttResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Slf4j
@Service
@RequiredArgsConstructor
public class SttService {

    private final OpenAiClient openAiClient;

    public SttResponse transcribe(MultipartFile audio, String language) {
        try {
            String text = openAiClient.transcribe(audio, language);
            log.info("STT 완료: {}자", text.length());
            return new SttResponse(text);
        } catch (Exception e) {
            log.error("STT 처리 실패", e);
            throw new IllegalStateException("음성 인식에 실패했습니다: " + e.getMessage());
        }
    }
}
