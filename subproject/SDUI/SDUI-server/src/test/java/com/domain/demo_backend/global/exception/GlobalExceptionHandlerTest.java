package com.domain.demo_backend.global.exception;

import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.mock.http.MockHttpInputMessage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class GlobalExceptionHandlerTest {

    private final OperationAlertService alerts = mock(OperationAlertService.class);
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler(alerts);

    @ParameterizedTest
    @CsvSource({
            "KPOP_ANALYSIS_WINDOW_LIMIT,37",
            "KPOP_ANALYSIS_ACTIVE_LIMIT,60",
            "KPOP_ANALYSIS_DAILY_LIMIT,30"
    })
    void rateLimitUsesStableCodeSafeRequestIdAndRetryAfter(String code, long retryAfter) {
        MockHttpServletRequest request = request("POST", "/api/v1/kpop/analysis-jobs");
        request.addHeader("X-Request-Id", "client-request_123");

        ResponseEntity<ApiResponse<Void>> response = handler.handleKpopRateLimit(
                new KpopRateLimitException(
                        code,
                        "Too many analysis submissions were made.",
                        retryAfter
                ),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getHeaders().getFirst("Retry-After"))
                .isEqualTo(String.valueOf(retryAfter));
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("error");
        assertThat(response.getBody().getCode()).isEqualTo(code);
        assertThat(response.getBody().getError()).isEqualTo(code);
        assertThat(response.getBody().getRequestId()).isEqualTo("client-request_123");
        assertThat(response.getBody().getPath()).isEqualTo("/api/v1/kpop/analysis-jobs");
    }

    @Test
    void codedHttpErrorPreservesCodeWithoutLeakingImplementationDetails() {
        MockHttpServletRequest request = request("POST", "/api/v1/kpop/analysis-jobs");
        request.addHeader("X-Request-Id", "conflict-request");

        ResponseEntity<ApiResponse<Void>> response = handler.handleResponseStatusException(
                new CodedResponseStatusException(
                        HttpStatus.CONFLICT,
                        "IDEMPOTENCY_CONFLICT",
                        "The idempotency key was already used for a different analysis payload."
                ),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("IDEMPOTENCY_CONFLICT");
        assertThat(response.getBody().getRequestId()).isEqualTo("conflict-request");
        assertThat(response.getBody().getMessage())
                .doesNotContain("SELECT", "redis", "stack trace");
    }

    @Test
    void unsafeSuppliedRequestIdIsReplacedAndGenericErrorIsSanitized() {
        MockHttpServletRequest request = request("GET", "/api/internal/query");
        request.addHeader("X-Request-Id", "unsafe request id with spaces");
        RuntimeException failure = new RuntimeException(
                "SELECT secret_token FROM credentials WHERE password='do-not-expose'"
        );

        ResponseEntity<ApiResponse<Void>> response = handler.handleGenericException(failure, request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("InternalError");
        assertThat(response.getBody().getRequestId())
                .isNotBlank()
                .isNotEqualTo("unsafe request id with spaces")
                .matches("[A-Za-z0-9._-]{1,64}");
        assertThat(response.getBody().getMessage())
                .doesNotContain("secret_token", "password", "do-not-expose", "SELECT");
        verify(alerts).sendError(
                "RuntimeException",
                failure.getMessage(),
                "/api/internal/query"
        );
    }

    @Test
    void ordinaryResponseStatusGetsDeterministicHttpCode() {
        MockHttpServletRequest request = request("GET", "/api/v1/kpop/analysis-jobs/999");

        ResponseEntity<ApiResponse<Void>> response = handler.handleResponseStatusException(
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Analysis job was not found."),
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getCode()).isEqualTo("HTTP_404");
        assertThat(response.getBody().getRequestId()).matches("[A-Za-z0-9._-]{1,64}");
    }

    @Test
    void malformedJsonReturnsSafeStableBadRequestWithRequestId() {
        MockHttpServletRequest request = request("POST", "/api/v1/kpop/analysis-jobs");
        request.addHeader("X-Request-Id", "malformed-json-request");
        HttpMessageNotReadableException failure = new HttpMessageNotReadableException(
                "Unexpected token near secret_token and password",
                new MockHttpInputMessage("{broken-json".getBytes())
        );

        ResponseEntity<ApiResponse<Void>> response = handler.handleHttpMessageNotReadable(
                failure,
                request
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("error");
        assertThat(response.getBody().getCode()).isEqualTo("MALFORMED_JSON");
        assertThat(response.getBody().getError()).isEqualTo("MALFORMED_JSON");
        assertThat(response.getBody().getRequestId()).isEqualTo("malformed-json-request");
        assertThat(response.getBody().getPath()).isEqualTo("/api/v1/kpop/analysis-jobs");
        assertThat(response.getBody().getMessage())
                .doesNotContain("secret_token", "password", "broken-json", "Unexpected token");
    }

    private MockHttpServletRequest request(String method, String path) {
        return new MockHttpServletRequest(method, path);
    }
}
