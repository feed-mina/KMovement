package com.domain.demo_backend.domain.aigate;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * AI 게이트 순수 단위 테스트(Spring 컨텍스트·Redis 불필요, UsageCounter 모킹).
 */
class AiUsageGateTest {

    private AiGateProperties props;
    private UsageCounter counter;
    private AiUsageGate gate;

    @BeforeEach
    void setUp() {
        props = new AiGateProperties();
        counter = mock(UsageCounter.class);
        gate = new AiUsageGate(props, counter);
    }

    @Test
    @DisplayName("비활성 게이트는 항상 통과하고 카운터를 건드리지 않는다(기존 앱 보호)")
    void disabledGateAllowsEverything() {
        props.setEnabled(false);

        assertThat(gate.check(null)).isEqualTo(GateResult.ALLOWED);
        assertThat(gate.check("anything")).isEqualTo(GateResult.ALLOWED);
        verifyNoInteractions(counter);
    }

    @Test
    @DisplayName("활성 상태에서 미등록/누락 키는 INVALID_KEY")
    void unknownKeyRejectedWhenEnabled() {
        props.setEnabled(true);
        props.setKeys(List.of("valid-key"));

        assertThat(gate.check("bad-key")).isEqualTo(GateResult.INVALID_KEY);
        assertThat(gate.check(null)).isEqualTo(GateResult.INVALID_KEY);
        verifyNoInteractions(counter);
    }

    @Test
    @DisplayName("쿼터 이내면 ALLOWED")
    void withinQuotaAllowed() {
        props.setEnabled(true);
        props.setKeys(List.of("k"));
        props.setDailyQuota(5);
        when(counter.incrementAndGet(anyString(), any(Duration.class))).thenReturn(3L);

        assertThat(gate.check("k")).isEqualTo(GateResult.ALLOWED);
    }

    @Test
    @DisplayName("쿼터 초과면 QUOTA_EXCEEDED")
    void overQuotaBlocked() {
        props.setEnabled(true);
        props.setKeys(List.of("k"));
        props.setDailyQuota(5);
        when(counter.incrementAndGet(anyString(), any(Duration.class))).thenReturn(6L);

        assertThat(gate.check("k")).isEqualTo(GateResult.QUOTA_EXCEEDED);
    }

    @Test
    @DisplayName("쿼터 0 이하면 무제한(검증만 하고 통과, 카운터 미사용)")
    void zeroQuotaMeansUnlimited() {
        props.setEnabled(true);
        props.setKeys(List.of("k"));
        props.setDailyQuota(0);

        assertThat(gate.check("k")).isEqualTo(GateResult.ALLOWED);
        verifyNoInteractions(counter);
    }
}
