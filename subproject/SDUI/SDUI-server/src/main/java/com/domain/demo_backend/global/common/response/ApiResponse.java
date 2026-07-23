package com.domain.demo_backend.global.common.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * API 공통 응답 형식
 * 프론트엔드 에러 처리 유틸리티와 호환되도록 설계
 */
@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final String status;      // "success" | "error"
    private final String message;     // 사용자에게 표시할 메시지
    private final T data;             // 성공 시 데이터
    private final String error;       // 실패 시 상세 에러 정보
    private final String code;        // 클라이언트가 분기할 수 있는 안정적인 오류 코드
    private final String requestId;   // 서버 로그와 응답을 연결하는 요청 식별자
    private final LocalDateTime timestamp;
    private final String path;

    // 성공 응답 (데이터 포함)
    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .status("success")
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 성공 응답 (메시지 포함)
    public static <T> ApiResponse<T> success(String message, T data) {
        return ApiResponse.<T>builder()
                .status("success")
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 실패 응답 (메시지만)
    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder()
                .status("error")
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 실패 응답 (메시지 + 상세 에러)
    public static <T> ApiResponse<T> error(String message, String error) {
        return ApiResponse.<T>builder()
                .status("error")
                .message(message)
                .error(error)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 실패 응답 (메시지 + 상세 에러 + 경로)
    public static <T> ApiResponse<T> error(String message, String error, String path) {
        return ApiResponse.<T>builder()
                .status("error")
                .message(message)
                .error(error)
                .code(error)
                .path(path)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> error(
            String message, String code, String path, String requestId) {
        return ApiResponse.<T>builder()
                .status("error")
                .message(message)
                .error(code)
                .code(code)
                .requestId(requestId)
                .path(path)
                .timestamp(LocalDateTime.now())
                .build();
    }

    // 간단한 Map 응답 (하위 호환성)
    public static Map<String, Object> simpleError(String message) {
        return Map.of(
                "status", "error",
                "message", message,
                "timestamp", LocalDateTime.now()
        );
    }

    public static Map<String, Object> simpleSuccess(String message) {
        return Map.of(
                "status", "success",
                "message", message,
                "timestamp", LocalDateTime.now()
        );
    }
}
