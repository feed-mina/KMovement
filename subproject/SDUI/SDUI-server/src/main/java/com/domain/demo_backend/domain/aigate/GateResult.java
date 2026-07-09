package com.domain.demo_backend.domain.aigate;

/**
 * AI 게이트 판정 결과.
 * ALLOWED 외에는 호출측이 각각 적절한 HTTP 상태(401/429 등)로 매핑한다.
 */
public enum GateResult {
    /** 통과(게이트 비활성 포함) */
    ALLOWED,
    /** 유효하지 않은/누락된 API 키 → 401 */
    INVALID_KEY,
    /** 1일 쿼터 초과 → 429 */
    QUOTA_EXCEEDED
}
