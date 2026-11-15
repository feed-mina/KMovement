package com.domain.kride.global.common;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ApiResponse<T> {
    private String status; // SUCESS 또는 ERROR
    private T data; // 실제 데이터 List<uiMetadata> 등이 들어감
    private String message; // 에러시 전달할 메시지

    // 성공 응답을 만드는 정ㅈ거 메서드
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>("success", data, null);
    }

    // 실패 응답을 만드는 정적 메서드
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>("error", null, message);
    }
}
