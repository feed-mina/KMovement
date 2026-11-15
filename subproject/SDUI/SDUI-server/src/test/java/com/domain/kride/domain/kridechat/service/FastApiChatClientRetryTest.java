package com.domain.kride.domain.kridechat.service;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/** FastAPI 호출의 시간제한·재시도 규칙: 일시 오류만 최대 2번 다시 시도한다. */
class FastApiChatClientRetryTest {

    private HttpServer server;
    private ExecutorService executor;
    private FastApiChatClient client;
    private final AtomicInteger recommendCalls = new AtomicInteger();
    private final AtomicInteger qaCalls = new AtomicInteger();

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        executor = Executors.newFixedThreadPool(2);
        server.setExecutor(executor);
        // 처음 두 번은 503, 세 번째에 성공
        server.createContext("/api/recommend/ai", exchange -> {
            int call = recommendCalls.incrementAndGet();
            if (call < 3) respond(exchange, 503, "{\"detail\":\"busy\"}");
            else respond(exchange, 200, "{\"count\":1}");
        });
        // 500은 다시 시도하지 않는다
        server.createContext("/api/chat/qa", exchange -> {
            qaCalls.incrementAndGet();
            respond(exchange, 500, "{\"detail\":\"boom\"}");
        });
        server.start();
        client = new FastApiChatClient("http://localhost:" + server.getAddress().getPort(), Duration.ofMillis(10));
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
        executor.shutdownNow();
    }

    @Test
    void retriesServiceUnavailableUpToTwice() {
        var result = client.recommendAi(List.of(), List.of(), List.of()).block(Duration.ofSeconds(10));
        assertThat(result).containsEntry("count", 1);
        assertThat(recommendCalls.get()).isEqualTo(3);
    }

    @Test
    void doesNotRetryInternalServerError() {
        assertThatThrownBy(() -> client.chatSync("hi")).isInstanceOf(WebClientResponseException.class);
        assertThat(qaCalls.get()).isEqualTo(1);
    }

    @Test
    void transientErrorsAreConnectionFailuresAnd5xxGatewayCodes() {
        assertThat(FastApiChatClient.isTransient(mock(WebClientRequestException.class))).isTrue();
        assertThat(FastApiChatClient.isTransient(WebClientResponseException.create(503, "", null, null, null))).isTrue();
        assertThat(FastApiChatClient.isTransient(WebClientResponseException.create(504, "", null, null, null))).isTrue();
        assertThat(FastApiChatClient.isTransient(WebClientResponseException.create(500, "", null, null, null))).isFalse();
        assertThat(FastApiChatClient.isTransient(WebClientResponseException.create(400, "", null, null, null))).isFalse();
        assertThat(FastApiChatClient.isTransient(new java.util.concurrent.TimeoutException())).isFalse();
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        exchange.getRequestBody().readAllBytes();
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(bytes);
        }
    }
}
