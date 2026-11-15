package com.domain.kride.global.common;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@ToString
@EqualsAndHashCode
public class ApiResponseDto<T> {
    private String message;
    private String code;
    private T data;


    // 생성자
    public ApiResponseDto(String message, String code) {
        this.message = message;
        this.code = code;
    }

    public ApiResponseDto(String message, String code, T data) {
        this.message = message;
        this.code = code;
        this.data = data;
    }

    // 성공응답
    public static <T> ApiResponseDto<T> success(T data) {
        return new ApiResponseDto<>("Success", "200", data);
    }

    // 오류 응답
    public static <T> ApiResponseDto<T> error(String message) {
        return new ApiResponseDto<>(message, "500", null);
    }


}
