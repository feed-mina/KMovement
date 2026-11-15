package com.domain.kride.domain.admin.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AdminUserResponse {
    private Long userSqno;
    private String userId;
    private String email;
    private String role;
}
