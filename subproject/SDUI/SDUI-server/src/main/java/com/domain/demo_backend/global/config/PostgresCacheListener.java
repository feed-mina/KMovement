package com.domain.demo_backend.global.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import com.domain.demo_backend.domain.kpop.service.KpopCacheService;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;


@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresCacheListener {


    private final DataSource dataSource;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final KpopCacheService kpopCacheService;

    @PostConstruct
    public void startListener() {
        // 백그라운드 스레드에서 실행
        Thread listenerThread = new Thread(() -> {
            try (Connection connection = dataSource.getConnection()) {
                // PostgreSQL 전용 커넥션으로 변환
                PGConnection pgConnection = connection.unwrap(PGConnection.class);
                Statement stmt = connection.createStatement();
                stmt.execute("LISTEN cache_eviction_channel");

                while (!Thread.currentThread().isInterrupted()) {
                    // 0.5초마다 신호 확인
                    PGNotification[] notifications = pgConnection.getNotifications(500);

                    if (notifications != null) {
                        for (PGNotification notification : notifications) {
                            processNotification(notification.getParameter());
                        }
                    }
                }
            } catch (Exception e) {
                log.error("Postgres Listener Error", e);
            }
        });
        listenerThread.setDaemon(true);
        listenerThread.start();
    }

    private void processNotification(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            String table = node.get("table").asText();
            String key = node.get("key").asText();

            String cacheKey = "";
            if ("ui_metadata".equals(table)) {
                cacheKey = "ui:metadata:" + key;
            } else if ("query_master".equals(table)) {
                cacheKey = "SQL:" + key;
                if (key.startsWith("kpop_")) {
                    kpopCacheService.invalidateCatalog();
                }
            } else if ("kpop_catalog".equals(table)) {
                kpopCacheService.invalidateCatalog();
            }

            if (!cacheKey.isEmpty()) {
                stringRedisTemplate.delete(cacheKey);
                log.info("Database Triggered Cache Evict: {}", cacheKey);
            }
        } catch (JsonProcessingException e) {
            log.error("JSON 파싱 에러: {}", payload, e);
        } catch (Exception e) {
            log.error("캐시 삭제 중 알 수 없는 에러 발생 (레디스 연결 확인 필요): {}", e.getMessage());
        }
    }
}
