package com.domain.demo_backend.domain.kridechat;

import com.domain.demo_backend.domain.kridechat.dto.ChatQueryRequest;
import com.domain.demo_backend.domain.kridechat.dto.ChatQueryResponse;
import com.domain.demo_backend.domain.kridechat.service.FastApiChatClient;
import com.domain.demo_backend.domain.kridechat.service.KrideChatService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("KrideChatService 단위 테스트")
class KrideChatServiceTest {

    @Mock
    private FastApiChatClient fastApiClient;

    @InjectMocks
    private KrideChatService chatService;

    @Test
    @DisplayName("의도 분류 — '추천' 키워드로 recommend 의도 인식")
    void chat_recommendIntent() {
        // Given
        ChatQueryRequest request = new ChatQueryRequest();
        request.setMessage("서울에서 BTS 관련 맛집 추천해줘");
        request.setArtists(List.of("BTS"));
        request.setRegions(List.of("서울"));

        Map<String, Object> mockResult = Map.of(
                "pois", List.of(Map.of("name", "경복궁", "poi_id", "poi_14")),
                "recommendation_text", "BTS 관련 서울 추천 장소입니다.",
                "count", 1
        );
        when(fastApiClient.recommendAi(any(), any(), any(), any(), any()))
                .thenReturn(Mono.just(mockResult));

        // When
        ChatQueryResponse response = chatService.chat(request);

        // Then
        assertThat(response.getIntent()).isEqualTo("recommend");
        assertThat(response.getReply()).contains("BTS");
        assertThat(response.getPois()).isNotNull();
        assertThat(response.getPois()).hasSize(1);
    }

    @Test
    @DisplayName("의도 분류 — '일정' 키워드로 itinerary 의도 인식")
    void chat_itineraryIntent() {
        ChatQueryRequest request = new ChatQueryRequest();
        request.setMessage("서울 2박3일 일정 짜줘");
        request.setRegions(List.of("서울"));
        request.setDuration(3);

        Map<String, Object> mockResult = Map.of(
                "itinerary", List.of(Map.of("day", 1, "morning", Map.of())),
                "mapData", Map.of("markers", List.of())
        );
        when(fastApiClient.generateItinerary(any(), any(), any(), any(), anyInt(), any()))
                .thenReturn(Mono.just(mockResult));

        ChatQueryResponse response = chatService.chat(request);

        assertThat(response.getIntent()).isEqualTo("itinerary");
        assertThat(response.getItinerary()).isNotNull();
    }

    @Test
    @DisplayName("의도 분류 — 일반 질문은 qa 의도")
    void chat_qaIntent() {
        when(fastApiClient.chatSync(any())).thenReturn("K-RIDE QA response");
        ChatQueryRequest request = new ChatQueryRequest();
        request.setMessage("한국 관광 가이드북 내용 알려줘");

        ChatQueryResponse response = chatService.chat(request);

        assertThat(response.getIntent()).isEqualTo("qa");
        assertThat(response.getReply()).isNotNull();
    }

    @Test
    @DisplayName("명시적 intent 지정 시 해당 intent 사용")
    void chat_explicitIntent() {
        ChatQueryRequest request = new ChatQueryRequest();
        request.setMessage("아무 메시지");
        request.setIntent("recommend");
        request.setArtists(List.of("BLACKPINK"));

        Map<String, Object> mockResult = Map.of(
                "pois", List.of(),
                "recommendation_text", "추천 결과",
                "count", 0
        );
        when(fastApiClient.recommendAi(any(), any(), any(), any(), any()))
                .thenReturn(Mono.just(mockResult));

        ChatQueryResponse response = chatService.chat(request);

        assertThat(response.getIntent()).isEqualTo("recommend");
    }

    @Test
    @DisplayName("FastAPI 연결 실패 시 fallback 응답")
    void chat_fastApiFail_fallback() {
        ChatQueryRequest request = new ChatQueryRequest();
        request.setMessage("맛집 추천해줘");
        request.setArtists(List.of("BTS"));

        when(fastApiClient.recommendAi(any(), any(), any(), any(), any()))
                .thenReturn(Mono.error(new RuntimeException("Connection refused")));

        ChatQueryResponse response = chatService.chat(request);

        assertThat(response.getIntent()).isEqualTo("recommend");
        assertThat(response.getReply()).contains("실패");
    }
}
