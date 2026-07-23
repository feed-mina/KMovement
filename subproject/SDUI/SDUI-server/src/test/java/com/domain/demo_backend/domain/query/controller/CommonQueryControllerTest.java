package com.domain.demo_backend.domain.query.controller;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.query.repository.DynamicExecutor;
import com.domain.demo_backend.domain.query.service.QueryMasterService;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CommonQueryControllerTest {

    private final QueryMasterService queryMasterService = mock(QueryMasterService.class);
    private final DynamicExecutor dynamicExecutor = mock(DynamicExecutor.class);
    private final CommonQueryController controller = new CommonQueryController(queryMasterService, dynamicExecutor);

    @Test
    void unknownQueryReturnsStandardizedNotFoundInsteadOfSilentSuccess() {
        when(queryMasterService.getQueryInfo("MISSING_QUERY")).thenReturn(null);
        MockHttpServletRequest request = request("MISSING_QUERY");
        request.addHeader("X-Request-Id", "query-test-404");

        ResponseEntity<ApiResponse<Object>> response = execute(
                "MISSING_QUERY", Map.of(), null, null, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("error");
        assertThat(response.getBody().getCode()).isEqualTo("QUERY_NOT_FOUND");
        assertThat(response.getBody().getError()).isEqualTo("QUERY_NOT_FOUND");
        assertThat(response.getBody().getRequestId()).isEqualTo("query-test-404");
        assertThat(response.getBody().getPath()).isEqualTo("/api/execute/MISSING_QUERY");
        verify(dynamicExecutor, never()).executeList(any(), any());
        verify(dynamicExecutor, never()).executeUpdate(any(), any());
    }

    @Test
    void malformedMetadataReturnsStandardizedConfigurationError() {
        QueryMaster query = queryMaster(
                "KPOP_EVENTS", "SELECT * FROM event WHERE region = :region", "MULTI",
                "not-json", "{\"region\":\"string\"}");
        when(queryMasterService.getQueryInfo("KPOP_EVENTS")).thenReturn(query);
        MockHttpServletRequest request = request("KPOP_EVENTS");

        ResponseEntity<ApiResponse<Object>> response = execute(
                "KPOP_EVENTS", Map.of("region", "private-value"), null, null, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("error");
        assertThat(response.getBody().getCode()).isEqualTo("QUERY_CONFIGURATION_ERROR");
        assertThat(response.getBody().getMessage()).doesNotContain("private-value");
        verify(dynamicExecutor, never()).executeList(any(), any());
    }

    @Test
    void identityOverrideIsRejectedAtControllerBoundary() {
        QueryMaster query = queryMaster(
                "MY_COURSES", "SELECT * FROM course WHERE user_sqno = :userSqno", "MULTI",
                "[]", "{}");
        when(queryMasterService.getQueryInfo("MY_COURSES")).thenReturn(query);

        ResponseEntity<ApiResponse<Object>> response = execute(
                "MY_COURSES",
                Map.of("userSqno", "999"),
                null,
                authentication(),
                request("MY_COURSES"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("IDENTITY_PARAMETER_FORBIDDEN");
        assertThat(response.getBody().getMessage()).doesNotContain("999");
        assertThat(response.getBody().getData()).isEqualTo(
                Map.of("parameterNames", java.util.Set.of("userSqno")));
        verify(dynamicExecutor, never()).executeList(any(), any());
    }

    @Test
    void normalizedValuesAndServerIdentityArePassedToExecutor() {
        QueryMaster query = queryMaster(
                "MY_EVENTS",
                "SELECT * FROM event WHERE user_sqno = :userSqno AND capacity >= :capacity",
                "MULTI",
                "[\"capacity\"]",
                "{\"capacity\":\"integer\"}");
        when(queryMasterService.getQueryInfo("MY_EVENTS")).thenReturn(query);
        when(dynamicExecutor.executeList(eq(query.getQueryText()), any()))
                .thenReturn(List.of(Map.of("id", 7L)));

        ResponseEntity<ApiResponse<Object>> response = execute(
                "MY_EVENTS",
                Map.of("capacity", "25"),
                null,
                authentication(),
                request("MY_EVENTS"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("success");
        assertThat(response.getBody().getData()).isEqualTo(List.of(Map.of("id", 7L)));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> params = ArgumentCaptor.forClass(Map.class);
        verify(dynamicExecutor).executeList(eq(query.getQueryText()), params.capture());
        assertThat(params.getValue())
                .containsEntry("capacity", 25)
                .containsEntry("userSqno", 42L);
    }

    @Test
    void executionFailureDoesNotExposeSqlExceptionOrParameterValues() {
        QueryMaster query = queryMaster(
                "KPOP_ARTISTS",
                "SELECT * FROM artist WHERE query = :query",
                "MULTI",
                "[]",
                "{\"query\":\"string\"}");
        when(queryMasterService.getQueryInfo("KPOP_ARTISTS")).thenReturn(query);
        when(dynamicExecutor.executeList(eq(query.getQueryText()), any()))
                .thenThrow(new IllegalStateException("password=secret; SELECT private_table"));
        MockHttpServletRequest request = request("KPOP_ARTISTS");
        request.addHeader("X-Request-Id", "query-test-500");

        ResponseEntity<ApiResponse<Object>> response = execute(
                "KPOP_ARTISTS", Map.of("query", "private-search"), null, null, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("QUERY_EXECUTION_FAILED");
        assertThat(response.getBody().getRequestId()).isEqualTo("query-test-500");
        assertThat(response.getBody().getMessage())
                .isEqualTo("The query could not be completed.")
                .doesNotContain("secret", "private_table", "private-search");
        assertThat(response.getBody().getData()).isEqualTo(
                Map.of("parameterNames", java.util.Set.of("query")));
    }

    private ResponseEntity<ApiResponse<Object>> execute(
            String sqlKey,
            Map<String, Object> queryParams,
            Map<String, Object> bodyParams,
            Authentication authentication,
            MockHttpServletRequest request) {
        return controller.execute(sqlKey, queryParams, bodyParams, authentication, request);
    }

    private MockHttpServletRequest request(String sqlKey) {
        return new MockHttpServletRequest("GET", "/api/execute/" + sqlKey);
    }

    private Authentication authentication() {
        User user = User.builder()
                .userSqno(42L)
                .userId("member-42")
                .email("member-42@example.test")
                .role("ROLE_USER")
                .delYn("N")
                .build();
        CustomUserDetails principal = new CustomUserDetails(user);
        return new UsernamePasswordAuthenticationToken(
                principal, "not-used", principal.getAuthorities());
    }

    private QueryMaster queryMaster(
            String sqlKey,
            String queryText,
            String returnType,
            String requiredParams,
            String paramMapping) {
        QueryMaster query = new QueryMaster();
        ReflectionTestUtils.setField(query, "sqlKey", sqlKey);
        ReflectionTestUtils.setField(query, "queryText", queryText);
        ReflectionTestUtils.setField(query, "returnType", returnType);
        ReflectionTestUtils.setField(query, "requiredParams", requiredParams);
        ReflectionTestUtils.setField(query, "paramMapping", paramMapping);
        return query;
    }
}
