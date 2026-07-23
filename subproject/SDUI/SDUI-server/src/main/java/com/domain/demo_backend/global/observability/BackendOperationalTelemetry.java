package com.domain.demo_backend.global.observability;

import com.domain.demo_backend.global.common.util.RequestIdSupport;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.List;

@Slf4j
@Component
public class BackendOperationalTelemetry {

    private final MeterRegistry meterRegistry;

    @Autowired
    public BackendOperationalTelemetry(ObjectProvider<MeterRegistry> registryProvider) {
        this(registryProvider.getIfAvailable());
    }

    public BackendOperationalTelemetry(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    public static BackendOperationalTelemetry noop() {
        return new BackendOperationalTelemetry((MeterRegistry) null);
    }

    public void record(String event, String outcome, String subject, Collection<String> keyNames) {
        String safeEvent = safeValue(event, 64, "unknown_event");
        String safeOutcome = safeValue(outcome, 64, "unknown_outcome");
        String safeSubject = safeValue(subject, 120, "redacted");
        List<String> safeKeys = keyNames == null
                ? List.of()
                : keyNames.stream().filter(value -> value != null && value.matches("[A-Za-z0-9_]{1,64}"))
                        .sorted().limit(32).toList();
        log.info("audit_event={} outcome={} subject={} keyNames={} requestId={}",
                safeEvent, safeOutcome, safeSubject, safeKeys, RequestIdSupport.current());
        if (meterRegistry != null) {
            Counter.builder("kride.backend.operations")
                    .tag("event", safeEvent)
                    .tag("outcome", safeOutcome)
                    .register(meterRegistry)
                    .increment();
        }
    }

    private String safeValue(String value, int maxLength, String fallback) {
        if (value == null || value.length() > maxLength
                || !value.matches("[A-Za-z0-9:_-]+")) {
            return fallback;
        }
        return value;
    }
}
