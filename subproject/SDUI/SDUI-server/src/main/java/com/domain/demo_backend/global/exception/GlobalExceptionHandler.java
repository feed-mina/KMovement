package com.domain.demo_backend.global.exception;

import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * 전역 예외 처리 핸들러
 * 모든 컨트롤러에서 발생하는 예외를 일관된 형식으로 처리
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private final OperationAlertService operationAlertService;

    public GlobalExceptionHandler(OperationAlertService operationAlertService) {
        this.operationAlertService = operationAlertService;
    }

    /**
     * 비즈니스 예외 처리 (커스텀)
     */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(
            BusinessException e,
            HttpServletRequest request
    ) {
        log.warn("[BusinessException] {}: {}", e.getClass().getSimpleName(), e.getMessage());

        ApiResponse<Void> response = ApiResponse.error(
                e.getMessage(),
                e.getClass().getSimpleName(),
                request.getRequestURI()
        );

        return ResponseEntity
                .status(e.getStatus())
                .body(response);
    }

    /**
     * Validation 예외 처리 (@Valid, @Validated)
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Map<String, String>>> handleValidationException(
            MethodArgumentNotValidException e,
            HttpServletRequest request
    ) {
        log.warn("[ValidationException] 입력값 검증 실패: {}", e.getBindingResult().getFieldError());

        Map<String, String> errors = new HashMap<>();
        e.getBindingResult().getFieldErrors().forEach(error ->
                errors.put(error.getField(), error.getDefaultMessage())
        );

        ApiResponse<Map<String, String>> response = ApiResponse.<Map<String, String>>builder()
                .status("error")
                .message("입력값을 확인해주세요")
                .data(errors)
                .path(request.getRequestURI())
                .build();

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * DB 제약 조건 위반 (중복 키, NOT NULL 등)
     */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleDataIntegrityViolation(
            DataIntegrityViolationException e,
            HttpServletRequest request
    ) {
        log.error("[DataIntegrityViolationException] DB 제약 조건 위반", e);

        String message = "데이터 저장에 실패했습니다";

        // 중복 키 에러 감지
        String errorMsg = e.getMostSpecificCause().getMessage();
        if (errorMsg != null) {
            if (errorMsg.contains("duplicate key") || errorMsg.contains("Duplicate entry")) {
                message = "이미 존재하는 데이터입니다";
            } else if (errorMsg.contains("cannot be null") || errorMsg.contains("not-null")) {
                message = "필수 항목이 누락되었습니다";
            }
        }

        ApiResponse<Void> response = ApiResponse.error(
                message,
                "DataIntegrityViolation",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * IllegalArgumentException 처리
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgumentException(
            IllegalArgumentException e,
            HttpServletRequest request
    ) {
        log.warn("[IllegalArgumentException] 잘못된 인자: {}", e.getMessage());

        ApiResponse<Void> response = ApiResponse.error(
                e.getMessage(),
                "IllegalArgument",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    /**
     * NullPointerException 처리
     */
    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<ApiResponse<Void>> handleNullPointerException(
            NullPointerException e,
            HttpServletRequest request
    ) {
        log.error("[NullPointerException] Null 참조 오류", e);
        operationAlertService.sendError("NullPointerException", e.getMessage(), request.getRequestURI());

        ApiResponse<Void> response = ApiResponse.error(
                "서버 내부 오류가 발생했습니다",
                "InternalError",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    /**
     * 기타 모든 예외 처리
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGenericException(
            Exception e,
            HttpServletRequest request
    ) {
        log.error("[Exception] 예상치 못한 오류 발생", e);
        operationAlertService.sendError(e.getClass().getSimpleName(), e.getMessage(), request.getRequestURI());

        ApiResponse<Void> response = ApiResponse.error(
                "서버 오류가 발생했습니다",
                "InternalError",
                request.getRequestURI()
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
