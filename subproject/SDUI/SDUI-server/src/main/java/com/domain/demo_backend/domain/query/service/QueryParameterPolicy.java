package com.domain.demo_backend.domain.query.service;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

@Component
@RequiredArgsConstructor
public class QueryParameterPolicy {

    private static final Set<String> SERVER_IDENTITY_PARAMS = Set.of("userSqno", "userId");
    private static final Pattern SAFE_NAME = Pattern.compile("[A-Za-z][A-Za-z0-9_]{0,63}");
    private static final int MAX_TEXT_LENGTH = 2000;
    private static final int MAX_LIST_SIZE = 100;
    private static final int MAX_JSON_LENGTH = 20_000;

    private final ObjectMapper objectMapper;

    public ValidationResult validate(
            QueryMaster queryMaster,
            Map<String, Object> clientParams,
            CustomUserDetails principal) {
        Set<String> suppliedKeys = new TreeSet<>(clientParams.keySet());
        Set<String> identityOverrides = new TreeSet<>(suppliedKeys);
        identityOverrides.retainAll(SERVER_IDENTITY_PARAMS);
        if (!identityOverrides.isEmpty()) {
            throw requestError(
                    "IDENTITY_PARAMETER_FORBIDDEN",
                    "Identity parameters are supplied by the server.",
                    identityOverrides);
        }

        Set<String> sqlParams = extractNamedParameters(queryMaster.getQueryText());
        Set<String> required = parseRequiredParams(queryMaster);
        Map<String, ParameterSpec> specs = parseParameterMapping(queryMaster);
        required.forEach(name -> specs.compute(name, (ignored, current) ->
                current == null
                        ? new ParameterSpec(ParameterType.STRING, true)
                        : new ParameterSpec(current.type(), true)));

        validateConfiguration(sqlParams, required, specs);

        Set<String> rejected = new TreeSet<>(suppliedKeys);
        rejected.removeAll(specs.keySet());
        if (!rejected.isEmpty()) {
            throw requestError(
                    "QUERY_PARAMETER_NOT_ALLOWED",
                    "One or more query parameters are not allowed.",
                    rejected);
        }

        Set<String> missing = new TreeSet<>();
        required.forEach(name -> {
            Object value = clientParams.get(name);
            if (value == null || value instanceof String text && text.isBlank()) missing.add(name);
        });
        if (!missing.isEmpty()) {
            throw requestError(
                    "QUERY_PARAMETER_REQUIRED",
                    "One or more required query parameters are missing.",
                    missing);
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, ParameterSpec> entry : specs.entrySet()) {
            Object value = clientParams.get(entry.getKey());
            normalized.put(entry.getKey(), value == null
                    ? null : normalize(entry.getKey(), value, entry.getValue().type()));
        }

        Set<String> identityParams = new TreeSet<>(sqlParams);
        identityParams.retainAll(SERVER_IDENTITY_PARAMS);
        if (!identityParams.isEmpty() && principal == null) {
            throw new PolicyException(
                    HttpStatus.UNAUTHORIZED,
                    "QUERY_IDENTITY_REQUIRED",
                    "Authentication is required for this query.",
                    identityParams);
        }
        if (identityParams.contains("userSqno")) normalized.put("userSqno", principal.getUserSqno());
        if (identityParams.contains("userId")) normalized.put("userId", principal.getUserId());
        return new ValidationResult(Collections.unmodifiableMap(normalized), suppliedKeys);
    }

    Set<String> extractNamedParameters(String sql) {
        if (sql == null || sql.isBlank()) {
            throw configError("Query text is missing.", Set.of());
        }
        Set<String> names = new LinkedHashSet<>();
        boolean singleQuoted = false;
        boolean doubleQuoted = false;
        boolean lineComment = false;
        boolean blockComment = false;
        for (int i = 0; i < sql.length(); i++) {
            char current = sql.charAt(i);
            char next = i + 1 < sql.length() ? sql.charAt(i + 1) : '\0';
            if (lineComment) {
                if (current == '\n' || current == '\r') lineComment = false;
                continue;
            }
            if (blockComment) {
                if (current == '*' && next == '/') {
                    blockComment = false;
                    i++;
                }
                continue;
            }
            if (!singleQuoted && !doubleQuoted && current == '-' && next == '-') {
                lineComment = true;
                i++;
                continue;
            }
            if (!singleQuoted && !doubleQuoted && current == '/' && next == '*') {
                blockComment = true;
                i++;
                continue;
            }
            if (!doubleQuoted && current == '\'') {
                if (singleQuoted && next == '\'') {
                    i++;
                } else {
                    singleQuoted = !singleQuoted;
                }
                continue;
            }
            if (!singleQuoted && current == '"') {
                if (doubleQuoted && next == '"') {
                    i++;
                } else {
                    doubleQuoted = !doubleQuoted;
                }
                continue;
            }
            if (singleQuoted || doubleQuoted || current != ':' || next == ':') continue;
            if (i > 0 && sql.charAt(i - 1) == ':') continue;
            if (!Character.isLetter(next)) continue;
            int end = i + 2;
            while (end < sql.length()) {
                char candidate = sql.charAt(end);
                if (!Character.isLetterOrDigit(candidate) && candidate != '_') break;
                end++;
            }
            names.add(sql.substring(i + 1, end));
            i = end - 1;
        }
        return names;
    }

    private Set<String> parseRequiredParams(QueryMaster queryMaster) {
        String raw = queryMaster.getRequiredParams();
        if (raw == null || raw.isBlank()) return new LinkedHashSet<>();
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (!root.isArray()) throw new IllegalArgumentException();
            Set<String> names = new LinkedHashSet<>();
            for (JsonNode node : root) {
                if (!node.isTextual()) throw new IllegalArgumentException();
                String name = node.asText();
                validateConfiguredName(name);
                if (!names.add(name)) throw new IllegalArgumentException();
            }
            return names;
        } catch (Exception exception) {
            throw configError("required_params must be a JSON array of unique parameter names.", Set.of());
        }
    }

    private Map<String, ParameterSpec> parseParameterMapping(QueryMaster queryMaster) {
        String raw = queryMaster.getParamMapping();
        if (raw == null || raw.isBlank()) return new LinkedHashMap<>();
        try {
            JsonNode root = objectMapper.readTree(raw);
            if (!root.isObject()) throw new IllegalArgumentException();
            Map<String, ParameterSpec> specs = new LinkedHashMap<>();
            Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String name = field.getKey();
                validateConfiguredName(name);
                specs.put(name, parseSpec(name, field.getValue()));
            }
            return specs;
        } catch (PolicyException exception) {
            throw exception;
        } catch (Exception exception) {
            throw configError("param_mapping must be a typed JSON object.", Set.of());
        }
    }

    private ParameterSpec parseSpec(String name, JsonNode node) {
        if (node.isTextual()) {
            String text = node.asText().trim();
            if (text.startsWith("params.")) {
                if (!text.equals("params." + name)) {
                    throw configError("Parameter source does not match its allowlisted name.", Set.of(name));
                }
                return new ParameterSpec(ParameterType.STRING, false);
            }
            return new ParameterSpec(ParameterType.parse(text), false);
        }
        if (!node.isObject()) throw configError("Invalid parameter mapping entry.", Set.of(name));
        Set<String> unknownFields = new HashSet<>();
        node.fieldNames().forEachRemaining(field -> {
            if (!Set.of("source", "type", "required").contains(field)) unknownFields.add(field);
        });
        if (!unknownFields.isEmpty()) {
            throw configError("Unknown parameter mapping fields.", Set.of(name));
        }
        String source = node.path("source").asText("params." + name);
        if (!source.equals("params." + name)) {
            throw configError("Parameter source does not match its allowlisted name.", Set.of(name));
        }
        ParameterType type = ParameterType.parse(node.path("type").asText("string"));
        boolean required = node.path("required").asBoolean(false);
        return new ParameterSpec(type, required);
    }

    private void validateConfiguration(
            Set<String> sqlParams,
            Set<String> required,
            Map<String, ParameterSpec> specs) {
        specs.forEach((name, spec) -> {
            if (spec.required()) required.add(name);
        });
        Set<String> undeclared = new TreeSet<>(sqlParams);
        undeclared.removeAll(SERVER_IDENTITY_PARAMS);
        undeclared.removeAll(specs.keySet());
        if (!undeclared.isEmpty()) {
            throw configError("SQL contains parameters that are not declared in param_mapping.", undeclared);
        }
        Set<String> unused = new TreeSet<>(specs.keySet());
        unused.removeAll(sqlParams);
        if (!unused.isEmpty()) {
            throw configError("param_mapping contains parameters that are not used by SQL.", unused);
        }
        Set<String> unusedRequired = new TreeSet<>(required);
        unusedRequired.removeAll(sqlParams);
        if (!unusedRequired.isEmpty()) {
            throw configError("required_params contains parameters that are not used by SQL.", unusedRequired);
        }
    }

    private Object normalize(String name, Object value, ParameterType type) {
        try {
            return switch (type) {
                case STRING -> boundedText(value);
                case INTEGER -> Integer.valueOf(boundedText(value));
                case LONG -> Long.valueOf(boundedText(value));
                case DECIMAL -> new BigDecimal(boundedText(value));
                case BOOLEAN -> parseBoolean(value);
                case DATE -> LocalDate.parse(boundedText(value));
                case DATETIME -> LocalDateTime.parse(boundedText(value));
                case JSON -> boundedJson(value);
                case STRING_LIST -> normalizeList(value, false);
                case LONG_LIST -> normalizeList(value, true);
            };
        } catch (PolicyException exception) {
            throw exception;
        } catch (Exception exception) {
            throw requestError(
                    "QUERY_PARAMETER_TYPE_MISMATCH",
                    "A query parameter has an invalid type.",
                    Set.of(name));
        }
    }

    private String boundedText(Object value) {
        String text = String.valueOf(value);
        if (text.length() > MAX_TEXT_LENGTH) throw new IllegalArgumentException();
        return text;
    }

    private Boolean parseBoolean(Object value) {
        if (value instanceof Boolean bool) return bool;
        String text = boundedText(value);
        if ("true".equalsIgnoreCase(text)) return true;
        if ("false".equalsIgnoreCase(text)) return false;
        throw new IllegalArgumentException();
    }

    private String boundedJson(Object value) throws Exception {
        String json = value instanceof String text ? text : objectMapper.writeValueAsString(value);
        if (json.length() > MAX_JSON_LENGTH) throw new IllegalArgumentException();
        objectMapper.readTree(json);
        return json;
    }

    private List<?> normalizeList(Object value, boolean longs) {
        Collection<?> values;
        if (value instanceof Collection<?> collection) {
            values = collection;
        } else {
            String text = boundedText(value);
            values = text.isBlank() ? List.of() : Arrays.asList(text.split(","));
        }
        if (values.size() > MAX_LIST_SIZE) throw new IllegalArgumentException();
        return values.stream().map(item -> longs
                ? Long.valueOf(String.valueOf(item).trim())
                : boundedText(item).trim()).toList();
    }

    private void validateConfiguredName(String name) {
        if (!SAFE_NAME.matcher(name).matches() || SERVER_IDENTITY_PARAMS.contains(name)) {
            throw configError("Configured parameter name is invalid or reserved.", Set.of(name));
        }
    }

    private PolicyException requestError(String code, String message, Set<String> keys) {
        return new PolicyException(HttpStatus.BAD_REQUEST, code, message, keys);
    }

    private PolicyException configError(String message, Set<String> keys) {
        return new PolicyException(
                HttpStatus.INTERNAL_SERVER_ERROR, "QUERY_CONFIGURATION_ERROR", message, keys);
    }

    public record ValidationResult(Map<String, Object> parameters, Set<String> clientKeyNames) {
    }

    private record ParameterSpec(ParameterType type, boolean required) {
    }

    private enum ParameterType {
        STRING, INTEGER, LONG, DECIMAL, BOOLEAN, DATE, DATETIME, JSON, STRING_LIST, LONG_LIST;

        static ParameterType parse(String raw) {
            try {
                return valueOf(raw.trim().toUpperCase(Locale.ROOT).replace('-', '_'));
            } catch (Exception exception) {
                throw new IllegalArgumentException("Unsupported parameter type.");
            }
        }
    }

    @Getter
    public static class PolicyException extends RuntimeException {
        private final HttpStatus status;
        private final String code;
        private final Set<String> keyNames;

        PolicyException(HttpStatus status, String code, String message, Set<String> keyNames) {
            super(message);
            this.status = status;
            this.code = code;
            this.keyNames = Collections.unmodifiableSet(new TreeSet<>(keyNames));
        }
    }
}
