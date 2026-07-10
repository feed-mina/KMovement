package com.domain.demo_backend.domain.aigate;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDate;

/**
 * SDUI 제품화 — AI 서버검증 게이트.
 * API 키 검증 + 키당 1일 쿼터를 판정한다.
 *
 * 비파괴 원칙: enabled=false(기본)면 항상 ALLOWED → 기존 라이브 엔드포인트에 영향 없음.
 * 아직 어떤 컨트롤러에도 연결하지 않았다(향후 SaaS 공개 API에 연결).
 */
@Component
public class AiUsageGate {

    private static final String BUCKET_PREFIX = "aigate:usage:";

    private final AiGateProperties properties;
    private final UsageCounter usageCounter;

    public AiUsageGate(AiGateProperties properties, UsageCounter usageCounter) {
        this.properties = properties;
        this.usageCounter = usageCounter;
    }

    public GateResult check(String apiKey) {
        // 게이트 비활성 → 무조건 통과(기존 앱 보호)
        if (!properties.isEnabled()) {
            return GateResult.ALLOWED;
        }

        // 키 검증
        if (apiKey == null || !properties.getKeys().contains(apiKey)) {
            return GateResult.INVALID_KEY;
        }

        // 쿼터 미설정(0 이하) → 검증만 하고 통과
        long quota = properties.getDailyQuota();
        if (quota <= 0) {
            return GateResult.ALLOWED;
        }

        // 일일 버킷 카운팅
        String bucket = BUCKET_PREFIX + apiKey + ":" + LocalDate.now();
        long used = usageCounter.incrementAndGet(bucket, Duration.ofDays(1));
        if (used > quota) {
            return GateResult.QUOTA_EXCEEDED;
        }
        return GateResult.ALLOWED;
    }
}
