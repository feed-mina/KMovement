package com.domain.demo_backend.domain.query.controller;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.kpop.service.KpopCacheService;
import com.domain.demo_backend.domain.query.repository.DynamicExecutor;
import com.domain.demo_backend.domain.query.service.QueryMasterService;
import com.domain.demo_backend.domain.query.service.QueryParameterPolicy;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.common.util.RequestIdSupport;
import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.time.Duration;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/execute")
public class CommonQueryController {

    private static final Set<String> RETURN_TYPES = Set.of("SINGLE", "MULTI", "COMMAND");

    private final QueryMasterService queryMasterService;
    private final DynamicExecutor dynamicExecutor;
    private final QueryParameterPolicy parameterPolicy;
    private final BackendOperationalTelemetry telemetry;
    private final KpopCacheService kpopCacheService;

    @Autowired
    public CommonQueryController(
            QueryMasterService queryMasterService,
            DynamicExecutor dynamicExecutor,
            QueryParameterPolicy parameterPolicy,
            BackendOperationalTelemetry telemetry,
            KpopCacheService kpopCacheService) {
        this.queryMasterService = queryMasterService;
        this.dynamicExecutor = dynamicExecutor;
        this.parameterPolicy = parameterPolicy;
        this.telemetry = telemetry;
        this.kpopCacheService = kpopCacheService;
    }

    public CommonQueryController(QueryMasterService queryMasterService, DynamicExecutor dynamicExecutor) {
        this(queryMasterService, dynamicExecutor,
                new QueryParameterPolicy(new ObjectMapper()),
                BackendOperationalTelemetry.noop(),
                null);
    }

    @RequestMapping(value = "/{sqlKey}", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<ApiResponse<Object>> execute(
            @PathVariable String sqlKey,
            @RequestParam(required = false) Map<String, Object> queryParams,
            @RequestBody(required = false) Map<String, Object> bodyParams,
            Authentication authentication,
            HttpServletRequest request) {
        String requestId = RequestIdSupport.getOrCreate(request);
        QueryMaster queryMaster = queryMasterService.getQueryInfo(sqlKey);
        if (queryMaster == null) {
            telemetry.record("query_lookup", "not_found", sqlKey, Set.of());
            return error(HttpStatus.NOT_FOUND, "QUERY_NOT_FOUND",
                    "The requested query is not registered.", request, requestId, Set.of());
        }

        CustomUserDetails principal = authenticatedPrincipal(authentication);
        ResponseEntity<ApiResponse<Object>> roleError = authorize(queryMaster, authentication, request, requestId);
        if (roleError != null) return roleError;

        Map<String, Object> clientParams = new LinkedHashMap<>();
        if (queryParams != null) clientParams.putAll(queryParams);
        if (bodyParams != null) {
            Set<String> duplicateKeys = new TreeSet<>(clientParams.keySet());
            duplicateKeys.retainAll(bodyParams.keySet());
            if (!duplicateKeys.isEmpty()) {
                telemetry.record("query_policy", "duplicate", sqlKey, duplicateKeys);
                return error(HttpStatus.BAD_REQUEST, "QUERY_PARAMETER_DUPLICATE",
                        "A parameter cannot be supplied in both query and body.",
                        request, requestId, duplicateKeys);
            }
            clientParams.putAll(bodyParams);
        }

        String returnType = normalizedReturnType(queryMaster.getReturnType());
        if (!RETURN_TYPES.contains(returnType)) {
            telemetry.record("query_policy", "configuration_error", sqlKey, Set.of());
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "QUERY_CONFIGURATION_ERROR",
                    "The query return type is not configured safely.",
                    request, requestId, Set.of());
        }

        QueryParameterPolicy.ValidationResult validated;
        try {
            validated = parameterPolicy.validate(queryMaster, clientParams, principal);
        } catch (QueryParameterPolicy.PolicyException exception) {
            telemetry.record("query_policy",
                    exception.getStatus().is5xxServerError() ? "configuration_error" : "rejected",
                    sqlKey,
                    exception.getKeyNames());
            return error(exception.getStatus(), exception.getCode(), exception.getMessage(),
                    request, requestId, exception.getKeyNames());
        }

        try {
            Object result = executeQuery(queryMaster, validated.parameters(), returnType);
            telemetry.record("query_execution", "success", sqlKey, validated.clientKeyNames());
            return ResponseEntity.ok(ApiResponse.success(result));
        } catch (Exception exception) {
            telemetry.record("query_execution", "failure", sqlKey, validated.clientKeyNames());
            return error(HttpStatus.INTERNAL_SERVER_ERROR, "QUERY_EXECUTION_FAILED",
                    "The query could not be completed.", request, requestId,
                    validated.clientKeyNames());
        }
    }

    private ResponseEntity<ApiResponse<Object>> authorize(
            QueryMaster queryMaster,
            Authentication authentication,
            HttpServletRequest request,
            String requestId) {
        String requiredRole = queryMaster.getRequiredRole();
        if (requiredRole == null || requiredRole.isBlank()) return null;
        if (authentication == null || !authentication.isAuthenticated()) {
            telemetry.record("query_authorization", "unauthorized", queryMaster.getSqlKey(), Set.of());
            return error(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_REQUIRED",
                    "Authentication is required.", request, requestId, Set.of());
        }
        boolean hasRole = authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals(requiredRole));
        if (!hasRole) {
            telemetry.record("query_authorization", "forbidden", queryMaster.getSqlKey(), Set.of());
            return error(HttpStatus.FORBIDDEN, "INSUFFICIENT_ROLE",
                    "The authenticated user does not have access to this query.",
                    request, requestId, Set.of());
        }
        return null;
    }

    private CustomUserDetails authenticatedPrincipal(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) return null;
        return authentication.getPrincipal() instanceof CustomUserDetails details ? details : null;
    }

    private Object executeQuery(
            QueryMaster queryMaster, Map<String, Object> parameters, String returnType) {
        java.util.function.Supplier<Object> databaseLoader = () -> {
            if ("COMMAND".equals(returnType)) {
                return dynamicExecutor.executeUpdate(queryMaster.getQueryText(), parameters);
            }
            List<Map<String, Object>> rows = dynamicExecutor.executeList(
                    queryMaster.getQueryText(), parameters);
            return "SINGLE".equals(returnType)
                    ? rows == null || rows.isEmpty() ? Map.of() : rows.get(0)
                    : rows == null ? List.of() : rows;
        };
        boolean userScoped = parameters.containsKey("userSqno") || parameters.containsKey("userId");
        boolean cacheable = kpopCacheService != null
                && queryMaster.getSqlKey().startsWith("kpop_")
                && "Y".equalsIgnoreCase(queryMaster.getUseRedisYn())
                && !"COMMAND".equals(returnType)
                && !userScoped;
        if (!cacheable) return databaseLoader.get();
        int ttlSeconds = queryMaster.getRedisTtlSec() == null
                ? 180 : Math.min(3600, Math.max(30, queryMaster.getRedisTtlSec()));
        return kpopCacheService.query(
                queryMaster.getSqlKey(),
                parameters,
                Duration.ofSeconds(ttlSeconds),
                new TypeReference<Object>() {},
                databaseLoader);
    }

    private String normalizedReturnType(String returnType) {
        return returnType == null ? "" : returnType.trim().toUpperCase(Locale.ROOT);
    }

    private ResponseEntity<ApiResponse<Object>> error(
            HttpStatus status,
            String code,
            String message,
            HttpServletRequest request,
            String requestId,
            Set<String> keyNames) {
        Map<String, Object> details = keyNames.isEmpty()
                ? Map.of()
                : Map.of("parameterNames", new TreeSet<>(keyNames));
        ApiResponse<Object> response = ApiResponse.builder()
                .status("error")
                .message(message)
                .error(code)
                .code(code)
                .requestId(requestId)
                .path(request.getRequestURI())
                .timestamp(LocalDateTime.now())
                .data(details.isEmpty() ? null : details)
                .build();
        return ResponseEntity.status(status).body(response);
    }
}
