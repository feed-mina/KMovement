package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.SetOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KpopCacheServiceTest {

    private static final String CATALOG_INDEX = "kpop:v1:index:catalog";
    private static final String QUERY_INDEX = "kpop:v1:index:query";

    private final StringRedisTemplate redis = mock(StringRedisTemplate.class);
    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> values = mock(ValueOperations.class);
    @SuppressWarnings("unchecked")
    private final SetOperations<String, String> sets = mock(SetOperations.class);
    private final KpopCacheService cache = new KpopCacheService(
            redis, new ObjectMapper(), BackendOperationalTelemetry.noop());

    @BeforeEach
    void setUp() {
        when(redis.opsForValue()).thenReturn(values);
        when(redis.opsForSet()).thenReturn(sets);
    }

    @Test
    void cacheHitReturnsRedisValueWithoutCallingDatabase() {
        String key = cache.key("catalog:artists", Map.of("page", 1, "q", "BTS"));
        when(values.get(key)).thenReturn("[1,2]");
        @SuppressWarnings("unchecked")
        Supplier<List<Long>> database = mock(Supplier.class);

        List<Long> result = cache.catalog(
                "artists",
                Map.of("q", "BTS", "page", 1),
                Duration.ofMinutes(5),
                new TypeReference<List<Long>>() {},
                database);

        assertThat(result).containsExactly(1L, 2L);
        verify(database, never()).get();
        verify(values, never()).set(key, "[1,2]", Duration.ofMinutes(5));
    }

    @Test
    void cacheMissLoadsDatabaseAndRegistersBoundedTtlKey() {
        String key = cache.key("catalog:artists", Map.of("page", 1));
        when(values.get(key)).thenReturn(null);
        @SuppressWarnings("unchecked")
        Supplier<List<Long>> database = mock(Supplier.class);
        when(database.get()).thenReturn(List.of(3L, 4L));

        List<Long> result = cache.catalog(
                "artists",
                Map.of("page", 1),
                Duration.ofHours(4),
                new TypeReference<List<Long>>() {},
                database);

        assertThat(result).containsExactly(3L, 4L);
        verify(database).get();
        verify(values).set(key, "[3,4]", Duration.ofHours(1));
        verify(sets).add(CATALOG_INDEX, key);
        verify(redis).expire(CATALOG_INDEX, Duration.ofHours(2));
    }

    @Test
    void redisReadAndWriteFailuresFallBackToAuthoritativeDatabase() {
        String key = cache.key("query:kpop_event_cards", Map.of("region", "Seoul"));
        when(values.get(key)).thenThrow(new IllegalStateException("redis unavailable"));
        doThrow(new IllegalStateException("redis unavailable"))
                .when(values).set(key, "[9]", Duration.ofMinutes(3));
        @SuppressWarnings("unchecked")
        Supplier<List<Long>> database = mock(Supplier.class);
        when(database.get()).thenReturn(List.of(9L));

        List<Long> result = cache.query(
                "kpop_event_cards",
                Map.of("region", "Seoul"),
                Duration.ofMinutes(3),
                new TypeReference<List<Long>>() {},
                database);

        assertThat(result).containsExactly(9L);
        verify(database).get();
        verify(sets, never()).add(QUERY_INDEX, key);
    }

    @Test
    void corruptCacheEntryIsDeletedAndReplacedFromDatabase() {
        String key = cache.key("catalog:artist-detail", Map.of("artistId", 7L));
        when(values.get(key)).thenReturn("not-json");
        @SuppressWarnings("unchecked")
        Supplier<Map<String, Object>> database = mock(Supplier.class);
        when(database.get()).thenReturn(Map.of("artistId", 7));

        Map<String, Object> result = cache.catalog(
                "artist-detail",
                Map.of("artistId", 7L),
                Duration.ofMinutes(5),
                new TypeReference<Map<String, Object>>() {},
                database);

        assertThat(result).containsEntry("artistId", 7);
        verify(redis).delete(key);
        verify(database).get();
        verify(sets).add(CATALOG_INDEX, key);
    }

    @Test
    void catalogInvalidationEvictsBothCatalogAndQueryRegistries() {
        String catalogKey = cache.key("catalog:artists", Map.of("page", 1));
        String queryKey = cache.key("query:kpop_event_cards", Map.of("region", "Seoul"));
        when(sets.members(CATALOG_INDEX)).thenReturn(Set.of(catalogKey));
        when(sets.members(QUERY_INDEX)).thenReturn(Set.of(queryKey));

        cache.invalidateCatalog();

        verify(redis).delete(Set.of(catalogKey));
        verify(redis).delete(Set.of(queryKey));
        verify(redis).delete(CATALOG_INDEX);
        verify(redis).delete(QUERY_INDEX);
    }

    @Test
    void redisInvalidationFailureDoesNotBreakMutationPath() {
        when(sets.members(CATALOG_INDEX)).thenThrow(new IllegalStateException("redis unavailable"));

        assertThatCode(cache::invalidateCatalog).doesNotThrowAnyException();

        verify(sets).members(QUERY_INDEX);
    }
}
