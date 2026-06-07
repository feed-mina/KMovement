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
        String actualModel = firstNonBlank(
                nonBlank(metadata.get("actual_model")),
                nonBlank(metadata.get("model_id")),
                nonBlank(metadata.get("route"))
        );
        String failedImageIndexes = jsonValue(metadata.get("failed_image_indexes"));

        return new Parsed(
                resultUrl,
                null,
                processedImages,
                actualModel,
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
            String failedImageIndexes
    ) {
        static Parsed failure(String errorMessage) {
            return new Parsed(null, errorMessage, null, null, null);
        }

        boolean succeeded() {
            return resultUrl != null;
        }
    }
}
