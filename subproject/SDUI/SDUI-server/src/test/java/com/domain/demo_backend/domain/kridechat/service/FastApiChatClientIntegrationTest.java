package com.domain.demo_backend.domain.kridechat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("FastAPI chat client integration test")
class FastApiChatClientIntegrationTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private HttpServer server;
    private ExecutorService executor;
    private FastApiChatClient client;
    private final Map<String, String> requestBodies = new HashMap<>();

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        executor = Executors.newSingleThreadExecutor();
        server.setExecutor(executor);
        server.createContext("/api/recommend/ai", exchange -> {
            requestBodies.put(exchange.getRequestURI().getPath(), readBody(exchange));
            respond(exchange, 200, "application/json", """
                    {
                      "pois": [{"poi_id": "poi_1", "name": "Seoul Hall"}],
                      "recommendation_text": "Recommended K-Ride POI",
                      "count": 1
                    }
                    """);
        });
        server.createContext("/api/recommend/itinerary", exchange -> {
            requestBodies.put(exchange.getRequestURI().getPath(), readBody(exchange));
            respond(exchange, 200, "application/json", """
                    {
                      "itinerary": [{"day": 1, "morning": {"places": []}}],
                      "mapData": {"markers": []}
                    }
                    """);
        });
        server.createContext("/api/chat/stream", exchange -> {
            requestBodies.put(exchange.getRequestURI().getPath(), readBody(exchange));
            respond(exchange, 200, "text/plain; charset=utf-8", "chunk-one\nchunk-two");
        });
        server.start();

        client = new FastApiChatClient("http://localhost:" + server.getAddress().getPort());
    }

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    @Test
    @DisplayName("recommendAi posts the SDUI payload and reads FastAPI response")
    void recommendAi_postsExpectedPayloadAndReadsResponse() throws Exception {
        Map<String, Object> response = client.recommendAi(
                List.of("BTS"),
                List.of("Seoul"),
                List.of("food")
        ).block();

        assertThat(response).isNotNull();
        assertThat(response.get("recommendation_text")).isEqualTo("Recommended K-Ride POI");
        assertThat(response.get("count")).isEqualTo(1);

        JsonNode body = OBJECT_MAPPER.readTree(requestBodies.get("/api/recommend/ai"));
        assertThat(body.get("artists").get(0).asText()).isEqualTo("BTS");
        assertThat(body.get("regions").get(0).asText()).isEqualTo("Seoul");
        assertThat(body.get("purposes").get(0).asText()).isEqualTo("food");
    }

    @Test
    @DisplayName("generateItinerary posts duration and reads itinerary response")
    void generateItinerary_postsDurationAndReadsResponse() throws Exception {
        Map<String, Object> response = client.generateItinerary(
                List.of("BLACKPINK"),
                List.of("Busan"),
                List.of("photo"),
                2
        ).block();

        assertThat(response).isNotNull();
        assertThat(response).containsKeys("itinerary", "mapData");

        JsonNode body = OBJECT_MAPPER.readTree(requestBodies.get("/api/recommend/itinerary"));
        assertThat(body.get("artists").get(0).asText()).isEqualTo("BLACKPINK");
        assertThat(body.get("regions").get(0).asText()).isEqualTo("Busan");
        assertThat(body.get("purposes").get(0).asText()).isEqualTo("photo");
        assertThat(body.get("duration").asInt()).isEqualTo(2);
    }

    @Test
    @DisplayName("streamChat posts the message and reads streaming chunks")
    void streamChat_postsMessageAndReadsChunks() throws Exception {
        String response = String.join("", client.streamChat("hello kride").collectList().block());

        assertThat(response).contains("chunk-one");
        assertThat(response).contains("chunk-two");

        JsonNode body = OBJECT_MAPPER.readTree(requestBodies.get("/api/chat/stream"));
        assertThat(body.get("message").asText()).isEqualTo("hello kride");
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
    }

    private static void respond(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", contentType);
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(bytes);
        }
    }
}
