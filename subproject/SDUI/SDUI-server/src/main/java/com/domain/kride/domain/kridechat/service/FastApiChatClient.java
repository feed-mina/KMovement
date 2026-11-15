package com.domain.kride.domain.kridechat.service;

import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class FastApiChatClient {

    /** 연결이 3초 안에 안 되면 실패로 본다. */
    static final int CONNECT_TIMEOUT_MILLIS = 3_000;
    /** 추천·일정 생성은 LLM 호출이 들어가 오래 걸릴 수 있어 40초까지 기다린다. */
    static final Duration RECOMMEND_TIMEOUT = Duration.ofSeconds(40);
    /** 짧은 질문 답변(QA)은 15초까지 기다린다. */
    static final Duration QA_TIMEOUT = Duration.ofSeconds(15);
    /** 스트리밍 답변은 조각 사이 간격이 60초를 넘으면 끊는다(전체 길이는 제한하지 않음). */
    static final Duration STREAM_IDLE_TIMEOUT = Duration.ofSeconds(60);

    private final WebClient webClient;
    private final Duration retryFirstBackoff;

    @Autowired
    public FastApiChatClient(
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl) {
        this(fastApiUrl, Duration.ofMillis(500));
    }

    FastApiChatClient(String fastApiUrl, Duration retryFirstBackoff) {
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, CONNECT_TIMEOUT_MILLIS);
        this.webClient = WebClient.builder()
                .baseUrl(fastApiUrl)
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
        this.retryFirstBackoff = retryFirstBackoff;
    }

    /**
     * 일시 오류(연결 실패, 502·503·504)일 때만 0.5초 → 1초 간격으로 최대 2번 다시 시도한다.
     * 시간 초과·4xx·500은 다시 시도하지 않는다(같은 결과가 반복되거나 대기 시간만 늘어나기 때문).
     */
    <T> Mono<T> withRetry(Mono<T> call, Duration timeout) {
        return call.timeout(timeout)
                .retryWhen(Retry.backoff(2, retryFirstBackoff)
                        .maxBackoff(Duration.ofSeconds(2))
                        .jitter(0.5)
                        .filter(FastApiChatClient::isTransient)
                        .onRetryExhaustedThrow((spec, signal) -> signal.failure())
                        .doBeforeRetry(signal -> log.warn("FastAPI call retry {} after {}",
                                signal.totalRetries() + 1, signal.failure().toString())));
    }

    static boolean isTransient(Throwable error) {
        if (error instanceof WebClientRequestException) return true;
        if (error instanceof WebClientResponseException response) {
            int status = response.getStatusCode().value();
            return status == 502 || status == 503 || status == 504;
        }
        return false;
    }

    private String toDurationLabel(int duration) {
        return switch (duration) {
            case 1 -> "\uB2F9\uC77C\uCE58\uAE30";
            case 3 -> "2\uBC153\uC77C";
            default -> "1\uBC152\uC77C";
        };
    }

    public Mono<Map<String, Object>> recommendAi(
            String message, List<String> artists, List<String> regions, List<String> purposes, Map<String, Integer> budget) {
        return recommendAi(message, artists, regions, purposes, budget, null, null);
    }

    public Mono<Map<String, Object>> recommendAi(
            String message, List<String> artists, List<String> regions, List<String> purposes,
            Map<String, Integer> budget, Long userSqno, String userId) {
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("message", message != null ? message : "");
        body.put("artists", artists != null ? artists : List.of());
        body.put("regions", regions != null ? regions : List.of());
        body.put("purposes", purposes != null ? purposes : List.of());
        putUserContext(body, userSqno, userId);
        if (budget != null) {
            body.put("budget", budget);
        }

        return withRetry(webClient.post()
                .uri("/api/recommend/ai")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}), RECOMMEND_TIMEOUT);
    }

    public Mono<Map<String, Object>> recommendAi(List<String> artists, List<String> regions, List<String> purposes) {
        return recommendAi("", artists, regions, purposes, null);
    }

    public Mono<Map<String, Object>> generateItinerary(
            String message, List<String> artists, List<String> regions, List<String> purposes, int duration, Map<String, Integer> budget) {
        return generateItinerary(message, artists, regions, purposes, duration, budget, null, null);
    }

    public Mono<Map<String, Object>> generateItinerary(
            String message, List<String> artists, List<String> regions, List<String> purposes,
            int duration, Map<String, Integer> budget, Long userSqno, String userId) {
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("message", message != null ? message : "");
        body.put("artists", artists != null ? artists : List.of());
        body.put("regions", regions != null ? regions : List.of());
        body.put("purposes", purposes != null ? purposes : List.of());
        body.put("duration", toDurationLabel(duration));
        putUserContext(body, userSqno, userId);
        if (budget != null) {
            body.put("budget", budget);
        }

        return withRetry(webClient.post()
                .uri("/api/recommend/itinerary")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}), RECOMMEND_TIMEOUT);
    }

    public Mono<Map<String, Object>> generateItinerary(
            List<String> artists, List<String> regions, List<String> purposes, int duration) {
        return generateItinerary("", artists, regions, purposes, duration, null);
    }

    /** 스트리밍은 다시 시도하지 않는다. 이미 화면에 나간 답의 앞부분이 두 번 나오기 때문이다. */
    public Flux<String> streamChat(String message) {
        return webClient.post()
                .uri("/api/chat/stream")
                .bodyValue(Map.of("message", message))
                .retrieve()
                .bodyToFlux(String.class)
                .timeout(STREAM_IDLE_TIMEOUT);
    }

    /**
     * Non-streaming QA 호출 — FastAPI POST /api/chat/qa
     * @return {"reply": "..."} 에서 reply 문자열
     */
    public String chatSync(String message) {
        Map<String, Object> result = withRetry(webClient.post()
                .uri("/api/chat/qa")
                .bodyValue(Map.of("message", message != null ? message : ""))
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {}), QA_TIMEOUT)
                .block();
        if (result == null) return "답변을 가져올 수 없습니다.";
        Object reply = result.get("reply");
        return reply != null ? reply.toString() : "답변을 가져올 수 없습니다.";
    }

    private void putUserContext(Map<String, Object> body, Long userSqno, String userId) {
        if (userSqno != null) {
            body.put("user_sqno", userSqno);
        }
        if (userId != null && !userId.isBlank()) {
            body.put("user_id", userId);
        }
    }
}
