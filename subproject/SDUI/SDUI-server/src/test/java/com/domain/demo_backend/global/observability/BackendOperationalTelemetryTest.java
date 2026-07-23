package com.domain.demo_backend.global.observability;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BackendOperationalTelemetryTest {

    @Test
    void unsafeMetricTagsAreCollapsedToBoundedFallbacks() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        BackendOperationalTelemetry telemetry = new BackendOperationalTelemetry(registry);

        telemetry.record(
                "query\nlookup",
                "unbounded outcome",
                "subject\r\nforged=true",
                List.of("safe_name", "unsafe-name"));

        assertThat(registry.find("kride.backend.operations")
                .tag("event", "unknown_event")
                .tag("outcome", "unknown_outcome")
                .counter()).isNotNull();
        assertThat(registry.find("kride.backend.operations")
                .tag("event", "query\nlookup")
                .counter()).isNull();
    }

    @Test
    void knownOperationalTagsRemainStable() {
        SimpleMeterRegistry registry = new SimpleMeterRegistry();
        BackendOperationalTelemetry telemetry = new BackendOperationalTelemetry(registry);

        telemetry.record("query_policy", "rejected", "kpop_event_cards", List.of("region"));

        assertThat(registry.find("kride.backend.operations")
                .tag("event", "query_policy")
                .tag("outcome", "rejected")
                .counter()).isNotNull();
    }
}
