package com.domain.demo_backend.global.exception;

import org.springframework.http.HttpStatus;

public class KpopRateLimitException extends CodedResponseStatusException {

    private final long retryAfterSeconds;

    public KpopRateLimitException(String code, String reason, long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, code, reason);
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
