package com.domain.demo_backend.global.common.util;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;

import java.util.UUID;
import java.util.regex.Pattern;

public final class RequestIdSupport {

    public static final String ATTRIBUTE = RequestIdSupport.class.getName() + ".requestId";
    public static final String HEADER = "X-Request-Id";
    private static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._-]{1,64}");

    private RequestIdSupport() {
    }

    public static String getOrCreate(HttpServletRequest request) {
        Object existing = request.getAttribute(ATTRIBUTE);
        if (existing instanceof String value && !value.isBlank()) return value;
        String supplied = request.getHeader(HEADER);
        String requestId = supplied != null && SAFE_ID.matcher(supplied).matches()
                ? supplied : UUID.randomUUID().toString();
        request.setAttribute(ATTRIBUTE, requestId);
        return requestId;
    }

    public static String current() {
        String requestId = MDC.get("requestId");
        return requestId == null ? "unavailable" : requestId;
    }
}
