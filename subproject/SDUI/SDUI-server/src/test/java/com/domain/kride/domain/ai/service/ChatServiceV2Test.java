package com.domain.kride.domain.ai.service;

import com.domain.kride.domain.ai.client.OpenAiClientV2;
import com.domain.kride.domain.ai.dto.ChatRequest;
import com.domain.kride.domain.ai.dto.ChatMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;
import java.util.function.Consumer;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatServiceV2 단위 테스트")
class ChatServiceV2Test {

    @Mock
    private OpenAiClientV2 openAiClientV2;

    @InjectMocks
    private ChatServiceV2 chatServiceV2;

    private ChatRequest chatRequest;

    @BeforeEach
    void setUp() {
        chatRequest = new ChatRequest();
        ChatMessage msg = new ChatMessage();
        msg.setRole("user");
        msg.setContent("Hello AI");
        chatRequest.setMessages(List.of(msg));
    }

    @Test
    @DisplayName("stream: OpenAI 클라이언트를 호출하고 SSE 이벤트를 전송해야 함")
    void stream_shouldCallClientAndSendEvents() throws Exception {
        // Given
        Long userId = 1L;
        SseEmitter emitter = mock(SseEmitter.class);

        // When
        doAnswer(invocation -> {
            Consumer<String> onChunk = invocation.getArgument(1);
            Runnable onComplete = invocation.getArgument(2);
            
            onChunk.accept("Hello");
            onChunk.accept(" world");
            onComplete.run();
            return null;
        }).when(openAiClientV2).streamChat(anyList(), any(), any());

        chatServiceV2.stream(chatRequest, userId, emitter);

        // Then
        verify(openAiClientV2, times(1)).streamChat(anyList(), any(), any());
        verify(emitter, atLeastOnce()).send(any(SseEmitter.SseEventBuilder.class));
        verify(emitter, times(1)).complete();
    }

    @Test
    @DisplayName("translate: OpenAI 번역 API를 호출하고 결과를 반환해야 함")
    void translate_shouldReturnTranslatedText() throws Exception {
        // Given
        String text = "안녕하세요";
        String target = "en";
        String expected = "Hello";
        when(openAiClientV2.translate(text, target)).thenReturn(expected);

        // When
        String actual = chatServiceV2.translate(text, target);

        // Then
        assertThat(actual).isEqualTo(expected);
        verify(openAiClientV2, times(1)).translate(text, target);
    }
}
