package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class KpopCacheService {

    public static final String PREFIX = "kpop:v1:";
    private static final String CATALOG_INDEX = PREFIX + "index:catalog";
    private static final String QUERY_INDEX = PREFIX + "index:query";
    private static final Duration MAX_TTL = Duration.ofHours(1);
    private static final Duration INDEX_TTL = Duration.ofHours(2);

    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final BackendOperationalTelemetry telemetry;

    public <T> T catalog(
            String resource,
            Map<String, ?> keyParts,
            Duration ttl,
            TypeReference<T> type,
            Supplier<T> databaseLoader) {
        return getOrLoad(key("catalog:" + resource, keyParts), CATALOG_INDEX,
                ttl, type, databaseLoader);
    }

    public <T> T query(
            String sqlKey,
            Map<String, ?> parameters,
            Duration ttl,
            TypeReference<T> type,
            Supplier<T> databaseLoader) {
        return getOrLoad(key("query:" + safeSegment(sqlKey), parameters), QUERY_INDEX,
                ttl, type, databaseLoader);
    }

    public void invalidateCatalog() {
        invalidateIndex(CATALOG_INDEX);
        invalidateIndex(QUERY_INDEX);
    }

    public String key(String scope, Map<String, ?> keyParts) {
        if (scope == null || !scope.matches("[A-Za-z0-9:_-]{1,120}")) {
            throw new IllegalArgumentException("Invalid KPOP cache scope.");
        }
        SortedMap<String, String> canonical = new TreeMap<>();
        if (keyParts != null) {
            keyParts.forEach((name, value) -> canonical.put(
                    safeSegment(name), value == null ? "<null>" : String.valueOf(value)));
        }
        String material = canonical.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .reduce((left, right) -> left + "&" + right)
                .orElse("none");
        return PREFIX + scope + ":" + sha256(material);
    }

    private <T> T getOrLoad(
            String key,
            String index,
            Duration requestedTtl,
            TypeReference<T> type,
            Supplier<T> databaseLoader) {
        Duration ttl = boundedTtl(requestedTtl);
        try {
            String cached = redis.opsForValue().get(key);
            if (cached != null) {
                try {
                    T value = objectMapper.readValue(cached, type);
                    telemetry.record("kpop_cache", "hit", cacheSubject(key), Set.of());
                    return value;
                } catch (Exception malformed) {
                    telemetry.record("kpop_cache", "corrupt", cacheSubject(key), Set.of());
                    safeDelete(key);
                }
            } else {
                telemetry.record("kpop_cache", "miss", cacheSubject(key), Set.of());
            }
        } catch (RuntimeException redisFailure) {
            telemetry.record("kpop_cache", "read_fallback", cacheSubject(key), Set.of());
        }

        T loaded = databaseLoader.get();
        try {
            redis.opsForValue().set(key, objectMapper.writeValueAsString(loaded), ttl);
            redis.opsForSet().add(index, key);
            redis.expire(index, INDEX_TTL);
            telemetry.record("kpop_cache", "write", cacheSubject(key), Set.of());
        } catch (Exception redisFailure) {
            telemetry.record("kpop_cache", "write_fallback", cacheSubject(key), Set.of());
        }
        return loaded;
    }

    private void invalidateIndex(String index) {
        try {
            Set<String> keys = redis.opsForSet().members(index);
            if (keys != null && !keys.isEmpty()) redis.delete(keys);
            redis.delete(index);
            telemetry.record("kpop_cache", "invalidated", index, Set.of());
        } catch (RuntimeException redisFailure) {
            telemetry.record("kpop_cache", "invalidation_deferred", index, Set.of());
        }
    }

    private void safeDelete(String key) {
        try {
            redis.delete(key);
        } catch (RuntimeException ignored) {
            telemetry.record("kpop_cache", "delete_fallback", cacheSubject(key), Set.of());
        }
    }

    private Duration boundedTtl(Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) return Duration.ofMinutes(3);
        return ttl.compareTo(MAX_TTL) > 0 ? MAX_TTL : ttl;
    }

    private String cacheSubject(String key) {
        int digestSeparator = key.lastIndexOf(':');
        return digestSeparator > PREFIX.length() ? key.substring(0, digestSeparator) : PREFIX;
    }

    private String safeSegment(String value) {
        if (value == null || !value.matches("[A-Za-z0-9_-]{1,80}")) {
            throw new IllegalArgumentException("Invalid KPOP cache key segment.");
        }
        return value;
    }

    private String sha256(String value) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }
}
