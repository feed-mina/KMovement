package com.domain.kride.domain.user.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {
    //    private String userId;
    @JsonProperty("user_pw")
    private String password;
//    private String hashedPassword;

    @JsonProperty("user_email")
    private String email;
}
