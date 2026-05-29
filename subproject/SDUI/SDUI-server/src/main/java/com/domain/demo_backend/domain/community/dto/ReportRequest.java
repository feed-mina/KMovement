package com.domain.demo_backend.domain.community.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ReportRequest {
    @NotBlank(message = "신고 사유를 선택해주세요.")
    private String reasonCode;

    @Size(max = 1000, message = "상세 내용은 1000자 이내로 입력해주세요.")
    private String detailText;
}
