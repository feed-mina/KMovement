package com.domain.demo_backend.domain.aigate;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Redis 기반 사용량 카운터. 기존 redisStringTemplate 빈을 재사용한다.
 * 스키마 변경 없이 일일 쿼터 카운팅을 제공한다.
 */
@Component
public class RedisUsageCounter implements UsageCounter {

    private final RedisTemplate<String, String> redis;

    public RedisUsageCounter(@Qualifier("redisStringTemplate") RedisTemplate<String, String> redis) {
        this.redis = redis;
    }

    @Override
    public long incrementAndGet(String key, Duration ttl) {
        Long value = redis.opsForValue().increment(key);
        long used = value == null ? 0L : value;
        // 최초 카운트일 때만 TTL 설정(일일 버킷 자동 만료)
        if (used == 1L) {
            redis.expire(key, ttl);
        }
        return used;
    }
}
