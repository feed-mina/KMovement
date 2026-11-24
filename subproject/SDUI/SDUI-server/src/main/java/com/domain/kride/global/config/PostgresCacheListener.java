package com.domain.kride.global.config;

import com.domain.kride.domain.kpop.service.KpopCacheService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * DB 트리거(V88 kpop_catalog)가 보내는 cache_eviction_channel 알림을 듣고 K-POP 캐시를 비운다.
 * 연결이 끊기면 1초부터 최대 30초까지 늘려 가며 다시 연결한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PostgresCacheListener {

    static final String CHANNEL = "cache_eviction_channel";
    static final long INITIAL_BACKOFF_MS = 1_000L;
    static final long MAX_BACKOFF_MS = 30_000L;

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;
    private final KpopCacheService kpopCacheService;

    private volatile boolean running = true;
    private Thread listenerThread;

    @PostConstruct
    public void startListener() {
        listenerThread = new Thread(this::runLoop, "postgres-cache-listener");
        listenerThread.setDaemon(true);
        listenerThread.start();
    }

    @PreDestroy
    public void stopListener() {
        running = false;
        if (listenerThread != null) {
            listenerThread.interrupt();
        }
    }

    void runLoop() {
        long backoff = INITIAL_BACKOFF_MS;
        while (running && !Thread.currentThread().isInterrupted()) {
            try {
                listenOnce();
                backoff = INITIAL_BACKOFF_MS;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
                log.error("Postgres Listener Error, reconnecting in {} ms", backoff, e);
                // 끊긴 동안 놓친 알림이 있을 수 있으니 다시 붙기 전에 한 번 비운다.
                safeInvalidate();
                try {
                    Thread.sleep(backoff);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    return;
                }
                backoff = nextBackoff(backoff);
            }
        }
    }

    static long nextBackoff(long current) {
        return Math.min(current * 2, MAX_BACKOFF_MS);
    }

    private void listenOnce() throws Exception {
        try (Connection connection = dataSource.getConnection();
             Statement stmt = connection.createStatement()) {
            PGConnection pgConnection = connection.unwrap(PGConnection.class);
            stmt.execute("LISTEN " + CHANNEL);
            log.info("Postgres cache listener connected ({})", CHANNEL);

            while (running && !Thread.currentThread().isInterrupted()) {
                // 0.5초마다 신호 확인. 연결이 끊기면 SQLException 이 나서 바깥에서 다시 연결한다.
                PGNotification[] notifications = pgConnection.getNotifications(500);
                if (notifications != null) {
                    for (PGNotification notification : notifications) {
                        processNotification(notification.getParameter());
                    }
                }
                if (connection.isClosed()) {
                    throw new IllegalStateException("listener connection closed");
                }
            }
            if (Thread.currentThread().isInterrupted()) {
                throw new InterruptedException();
            }
        }
    }

    void processNotification(String payload) {
        try {
            JsonNode node = objectMapper.readTree(payload);
            JsonNode table = node == null ? null : node.get("table");
            // 트리거가 달린 곳은 V88 의 kpop_catalog 하나뿐이다.
            if (table != null && "kpop_catalog".equals(table.asText())) {
                kpopCacheService.invalidateCatalog();
                log.info("Database Triggered Cache Evict: kpop_catalog");
            }
        } catch (Exception e) {
            log.error("캐시 알림 처리 실패: {}", payload, e);
        }
    }

    private void safeInvalidate() {
        try {
            kpopCacheService.invalidateCatalog();
        } catch (Exception e) {
            log.warn("K-POP 캐시 비우기 실패(Redis 확인 필요): {}", e.getMessage());
        }
    }
}
