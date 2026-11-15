package com.domain.kride.domain.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

/**
 * RBAC: 카카오 로그인 후 추가 정보 입력용 DTO (2026-03-01 추가)
 * ROLE_GUEST → ROLE_USER 승격 시 사용
 */
@Getter
@Setter
public class AdditionalInfoRequest {

    @NotBlank(message = "핸드폰 번호는 필수 입력 값입니다.")
    @Pattern(regexp = "^01(?:0|1|[6-9])-?(?:\\d{3}|\\d{4})-?\\d{4}$", message = "올바른 핸드폰 번호 형식이 아닙니다.")
    private String phone;

    @NotBlank(message = "우편번호는 필수입니다.")
    private String zipCode;

    @NotBlank(message = "도로명 주소는 필수입니다.")
    private String roadAddress;

    private String detailAddress; // 선택 항목
}
