package com.domain.demo_backend.domain.community.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;

final class AnimationRunPodOutput {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private AnimationRunPodOutput() {
    }

    static Parsed parse(Object output) {
        if (!(output instanceof Map<?, ?> outputMap)) {
            return Parsed.failure("RunPod completed without a valid output object.");
        }

        String error = nonBlank(outputMap.get("error"));
        if (error != null) {
            return Parsed.failure(error);
        }

        String outputStatus = nonBlank(outputMap.get("status"));
        if ("failed".equalsIgnoreCase(outputStatus)) {
            return Parsed.failure("RunPod worker reported a failed result.");
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
            return Parsed.failure(
                    "RunPod completed, but the worker did not return a public result URL.");
        }

        Map<?, ?> metadata = outputMap.get("metadata") instanceof Map<?, ?> value
                ? value
                : Map.of();
        Integer processedImages = integerValue(metadata.get("processed_images"));
        Boolean actualModelExecuted = booleanValue(metadata.get("actual_model_executed"));
        String actualModel = firstNonBlank(
                nonBlank(metadata.get("actual_model")),
                nonBlank(metadata.get("model_id")),
                nonBlank(metadata.get("route"))
        );
        String fallbackType = firstNonBlank(
                nonBlank(metadata.get("fallback_type")),
                nonBlank(outputMap.get("fallback_type"))
        );
        boolean fallbackUsed = "fallback_used".equalsIgnoreCase(outputStatus)
                || Boolean.FALSE.equals(actualModelExecuted)
                || fallbackType != null;
        String fallbackReason = fallbackUsed
                ? truncate(firstNonBlank(
                        nonBlank(metadata.get("fallback_reason")),
                        nonBlank(outputMap.get("fallback_reason")),
                        nonBlank(metadata.get("real_model_error")),
                        nonBlank(metadata.get("tora_error")),
                        "Worker completed with a fallback route."
                ))
                : null;
        String failedImageIndexes = jsonValue(metadata.get("failed_image_indexes"));

        return new Parsed(
                resultUrl,
                null,
                processedImages,
                actualModel,
                actualModelExecuted,
                fallbackType,
                fallbackReason,
                failedImageIndexes
        );
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

    private static Integer integerValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return value == null ? null : Integer.valueOf(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static Boolean booleanValue(Object value) {
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        if ("true".equalsIgnoreCase(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text)) {
            return false;
        }
        return null;
    }

    private static String truncate(String value) {
        if (value == null || value.length() <= 500) {
            return value;
        }
        return value.substring(0, 500);
    }

    private static String jsonValue(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof String text) {
            return text.isBlank() ? null : text;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(value);
        } catch (JsonProcessingException ignored) {
            return String.valueOf(value);
        }
    }

    record Parsed(
            String resultUrl,
            String errorMessage,
            Integer processedImages,
            String actualModel,
            Boolean actualModelExecuted,
            String fallbackType,
            String fallbackReason,
            String failedImageIndexes
    ) {
        static Parsed failure(String errorMessage) {
            return new Parsed(null, errorMessage, null, null, null, null, null, null);
        }

        boolean succeeded() {
            return resultUrl != null;
        }
    }
}
