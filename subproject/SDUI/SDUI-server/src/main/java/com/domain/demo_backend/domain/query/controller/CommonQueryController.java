package com.domain.demo_backend.domain.query.controller;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.query.repository.DynamicExecutor;
import com.domain.demo_backend.domain.query.service.QueryMasterService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/execute")
public class CommonQueryController {
    private final QueryMasterService queryMasterService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final DynamicExecutor dynamicExecutor; // 실행기 추가

    @Autowired
    public CommonQueryController(QueryMasterService queryMasterService, DynamicExecutor dynamicExecutor) {
        this.queryMasterService = queryMasterService;
        this.dynamicExecutor = dynamicExecutor;
    }
    // GET과 POST를 모두 수용하도록 변경
    @RequestMapping(value = "/{sqlKey}", method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<?> execute(
            @PathVariable String sqlKey,
            @RequestParam(required = false) Map<String, Object> queryParams, // GET 파라미터
            @RequestBody(required = false) Map<String, Object> bodyParams,  // POST 파라미터
            Authentication authentication,
            HttpServletRequest request) {

        //  파라미터 통합 처리 (GET과 POST 데이터 합치기)
        Map<String, Object> params = new HashMap<>();
        if (queryParams != null) params.putAll(queryParams);
        if (bodyParams != null) params.putAll(bodyParams);

        boolean isGet = "GET".equalsIgnoreCase(request.getMethod());

        QueryMaster queryMaster = queryMasterService.getQueryInfo(sqlKey);
        if (queryMaster == null) {
            // GET(조회) 요청은 데이터 없음으로 처리 (프론트 오류 방지)
            if (isGet) {
                return ResponseEntity.ok(Map.of("status", "success", "data", List.of()));
            }
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", "등록되지 않은 SQL 키 입니다"));
        }

        // [P0 Security Fix] required_role 검증
        String requiredRole = queryMaster.getRequiredRole();
        if (requiredRole != null && !requiredRole.isBlank()) {
            if (authentication == null || !authentication.isAuthenticated()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "로그인이 필요합니다."));
            }
            boolean hasRole = authentication.getAuthorities().stream()
                    .anyMatch(a -> a.getAuthority().equals(requiredRole));
            if (!hasRole) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "권한이 없습니다."));
            }
        }

        // todo : 동적 쿼리 실행기 (DynamicExecutor) 호출 로직이 들어간다
        // 서비스 로부터 SQL 설계도(Query text)를 가져온다. (Redis 또는 DB)
        String query = queryMaster.getQueryText();
        String returnType = queryMaster.getReturnType();

        //  보안 파라미터 주입
        if (authentication != null) {
            CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
            params.put("userSqno", userDetails.getUserSqno());
            params.put("userId", userDetails.getUserId());
        }

        ResponseEntity<?> paramError = validateAllowedParams(queryMaster, params);
        if (paramError != null) {
            return paramError;
        }

        try {
            Object result;
            if ("COMMAND".equals(returnType)) {
                // INSERT, UPDATE, DELETE인 경우
                result = dynamicExecutor.executeUpdate(query, params);
            } else {
                // SELECT인 경우 (SINGLE, MULTI등)
                List<Map<String, Object>> list = dynamicExecutor.executeList(query, params);
                // SINGLE 타입이면 첫 번째 객체만, MULTI면 리스트 전체 반환

                if ("SINGLE".equals(returnType)) {
                    //
                    if (list != null && !list.isEmpty()) {
                        result = list.get(0);
                    } else {
                        // 결과가 없으면 null 혹은 빈 객체 반환
                        result = null;
                    }
                } else {
                    // MULTI 타입인 경우 리스트 통째로 반환
                    result = list;
                }
            }

            return ResponseEntity.ok().body(Map.of(
                    "status", "success", "sqlKey", sqlKey, "data", result != null ? result : List.of()
            ));
        } catch (Exception e) {
            // GET(조회) 실패는 빈 데이터로 응답 (화면 오류 방지)
            if (isGet) {
                return ResponseEntity.ok(Map.of("status", "success", "data", List.of()));
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "쿼리 실행 중 오류가 발생했습니다.", "error", e.getMessage()));
        }
    }

    private ResponseEntity<?> validateAllowedParams(QueryMaster queryMaster, Map<String, Object> params) {
        Set<String> allowed = new LinkedHashSet<>();
        allowed.add("userSqno");
        allowed.add("userId");
        addRequiredParams(allowed, queryMaster.getRequiredParams());
        addParamMappingKeys(allowed, queryMaster.getParamMapping());

        if (allowed.size() <= 2) {
            return null;
        }

        Set<String> rejected = new LinkedHashSet<>(params.keySet());
        rejected.removeAll(allowed);
        if (rejected.isEmpty()) {
            return null;
        }

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of(
                "status", "error",
                "message", "Unsupported query parameter.",
                "sqlKey", queryMaster.getSqlKey(),
                "rejectedParams", rejected
        ));
    }

    private void addRequiredParams(Set<String> allowed, String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return;
        }
        try {
            List<String> names = objectMapper.readValue(rawJson, new TypeReference<List<String>>() {});
            allowed.addAll(names);
        } catch (Exception ignored) {
        }
    }

    private void addParamMappingKeys(Set<String> allowed, String rawJson) {
        if (rawJson == null || rawJson.isBlank()) {
            return;
        }
        try {
            Map<String, Object> mapping = objectMapper.readValue(rawJson, new TypeReference<Map<String, Object>>() {});
            allowed.addAll(mapping.keySet());
        } catch (Exception ignored) {
        }
    }
}
