package com.domain.kride.domain.token.domain;


import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;



@Data

@AllArgsConstructor

@NoArgsConstructor

@Builder // 객체 생성을 유연하게 하기 위해 추가

public class TokenResponse {

    private String accessToken;

    private String refreshToken;

    private String userId;      // 사용자 아이디

    private Long userSqno;      // 사용자 일련번호 (PK)

    private String email;       // 사용자 이메일

    private String role;        // RBAC를 위한 권한 정보 (예: ROLE_USER, ROLE_ADMIN)

}