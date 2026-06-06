package com.domain.demo_backend.domain.community.service;

import java.util.List;
import java.util.Map;

final class AnimationRunPodOutput {

    private AnimationRunPodOutput() {
    }

    static Parsed parse(Object output) {
        if (!(output instanceof Map<?, ?> outputMap)) {
            return new Parsed(null, "RunPod completed without a valid output object.");
        }

        String error = nonBlank(outputMap.get("error"));
        if (error != null) {
            return new Parsed(null, error);
        }

        String outputStatus = nonBlank(outputMap.get("status"));
        if ("failed".equalsIgnoreCase(outputStatus)) {
            return new Parsed(null, "RunPod worker reported a failed result.");
        }

        String resultUrl = firstNonBlank(
                nonBlank(outputMap.get("result_url")),
                nonBlank(outputMap.get("resultUrl"))
        );
        if (resultUrl == null) {
            resultUrl = findUrl(outputMap.get("artifacts"), "final_video");
        }
        if (resultUrl == null) {
            resultUrl = findUrl(outputMap.get("uploads"), "final_video");
        }

        if (resultUrl == null) {
            return new Parsed(
                    null,
                    "RunPod completed, but the worker did not return a public result URL."
            );
        }
        return new Parsed(resultUrl, null);
    }

    private static String findUrl(Object value, String preferredKind) {
        if (!(value instanceof List<?> items)) {
            return null;
        }

        String firstUrl = null;
        for (Object item : items) {
            if (!(item instanceof Map<?, ?> itemMap)) {
                continue;
            }
            String url = firstNonBlank(
                    nonBlank(itemMap.get("url")),
                    nonBlank(itemMap.get("result_url")),
                    nonBlank(itemMap.get("resultUrl"))
            );
            if (url == null) {
                continue;
            }
            if (preferredKind.equals(nonBlank(itemMap.get("kind")))) {
                return url;
            }
            if (firstUrl == null) {
                firstUrl = url;
            }
        }
        return firstUrl;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String nonBlank(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() || "null".equalsIgnoreCase(text) ? null : text;
    }

    record Parsed(String resultUrl, String errorMessage) {
        boolean succeeded() {
            return resultUrl != null;
        }
    }
}
