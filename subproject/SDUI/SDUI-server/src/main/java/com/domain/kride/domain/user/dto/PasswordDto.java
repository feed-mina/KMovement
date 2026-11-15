package com.domain.kride.domain.user.dto;

import lombok.Data;

@Data
public class PasswordDto {
    private String currentPassword; // 현재 비밀번호 (보안 강화)
    private String newPassword;
    private String checkNewPassword;
    private String token;
    private String email;
}
