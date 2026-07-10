package com.domain.demo_backend.domain.aigate;

import java.time.Duration;

/**
 * 사용량 카운터 추상화. 단위 테스트에서 모킹할 수 있도록 인터페이스로 분리한다.
 */
public interface UsageCounter {

    /**
     * key의 값을 1 증가시키고 증가 후 값을 반환한다.
     * 최초 증가 시(값이 1이 될 때) ttl 만료시간을 설정한다.
     */
    long incrementAndGet(String key, Duration ttl);
}
