package com.domain.demo_backend.domain.query.controller;

import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.query.repository.DynamicExecutor;
import com.domain.demo_backend.domain.query.service.QueryMasterService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
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
    void rejectsUnsupportedParamsWhenRequiredParamsAreConfigured() {
        QueryMaster query = queryMaster("KPOP_EVENTS", "SELECT 1", "MULTI");
        ReflectionTestUtils.setField(query, "requiredParams", "[\"region\"]");
        when(queryMasterService.getQueryInfo("KPOP_EVENTS")).thenReturn(query);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/execute/KPOP_EVENTS");
        ResponseEntity<?> response = controller.execute(
                "KPOP_EVENTS",
                Map.of("region", "서울", "unsafe", "1"),
                null,
                null,
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("status")).isEqualTo("error");
        assertThat(body.get("rejectedParams").toString()).contains("unsafe");
        verify(dynamicExecutor, never()).executeList(any(), any());
        verify(dynamicExecutor, never()).executeUpdate(any(), any());
    }

    @Test
    void allowsConfiguredParamMappingKeysAndExecutesQuery() {
        QueryMaster query = queryMaster("KPOP_ARTISTS", "SELECT 1", "MULTI");
        ReflectionTestUtils.setField(query, "paramMapping", "{\"q\":\"string\"}");
        when(queryMasterService.getQueryInfo("KPOP_ARTISTS")).thenReturn(query);
        when(dynamicExecutor.executeList(eq("SELECT 1"), any())).thenReturn(List.of(Map.of("id", 1L)));

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/execute/KPOP_ARTISTS");
        ResponseEntity<?> response = controller.execute(
                "KPOP_ARTISTS",
                Map.of("q", "BTS"),
                null,
                null,
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isInstanceOf(Map.class);
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertThat(body.get("status")).isEqualTo("success");
        assertThat(body.get("sqlKey")).isEqualTo("KPOP_ARTISTS");
    }

    private QueryMaster queryMaster(String sqlKey, String queryText, String returnType) {
        QueryMaster query = new QueryMaster();
        ReflectionTestUtils.setField(query, "sqlKey", sqlKey);
        ReflectionTestUtils.setField(query, "queryText", queryText);
        ReflectionTestUtils.setField(query, "returnType", returnType);
        return query;
    }
}
