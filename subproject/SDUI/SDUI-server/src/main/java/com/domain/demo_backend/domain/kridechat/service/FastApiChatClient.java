package com.domain.demo_backend.domain.kridechat.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class FastApiChatClient {

    private final WebClient webClient;

    public FastApiChatClient(
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl) {
        this.webClient = WebClient.builder()
                .baseUrl(fastApiUrl)
                .build();
    }

    public Mono<Map<String, Object>> recommendAi(
            List<String> artists, List<String> regions, List<String> purposes, List<Integer> budget) {
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("artists", artists != null ? artists : List.of());
        body.put("regions", regions != null ? regions : List.of());
        body.put("purposes", purposes != null ? purposes : List.of());
        if (budget != null && budget.size() == 2) {
            body.put("budget_min", budget.get(0));
            body.put("budget_max", budget.get(1));
        }

        return webClient.post()
                .uri("/api/recommend/ai")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    public Mono<Map<String, Object>> generateItinerary(
            List<String> artists, List<String> regions, List<String> purposes, int duration, List<Integer> budget) {
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("artists", artists != null ? artists : List.of());
        body.put("regions", regions != null ? regions : List.of());
        body.put("purposes", purposes != null ? purposes : List.of());
        body.put("duration", duration);
        if (budget != null && budget.size() == 2) {
            body.put("budget_min", budget.get(0));
            body.put("budget_max", budget.get(1));
        }

        return webClient.post()
                .uri("/api/recommend/itinerary")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {});
    }

    public Flux<String> streamChat(String message) {
        return webClient.post()
                .uri("/api/chat/stream")
                .bodyValue(Map.of("message", message))
                .retrieve()
                .bodyToFlux(String.class);
    }

    /**
     * Non-streaming QA 호출 — FastAPI POST /api/chat/qa
     * @return {"reply": "..."} 에서 reply 문자열
     */
    public String chatSync(String message) {
        Map<String, Object> result = webClient.post()
                .uri("/api/chat/qa")
                .bodyValue(Map.of("message", message != null ? message : ""))
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                .block();
        if (result == null) return "답변을 가져올 수 없습니다.";
        Object reply = result.get("reply");
        return reply != null ? reply.toString() : "답변을 가져올 수 없습니다.";
    }
}
