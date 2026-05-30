package com.domain.demo_backend.domain.user.dto;

import com.domain.demo_backend.global.security.PasswordUtil;
import lombok.*;

import java.util.HashMap;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class KakaoUserInfo {
    private Long userSqno;       // DB: user_sqno
    private Long userId;  // 카카오 유저 ID
    private String connectedAt;
    private String password;
    private String hashedPassword;  // DB: hashed_password
    private String email;
    private boolean hasEmail;
    private boolean isEmailValid;
    private boolean isEmailVerified;
    private boolean hasAgeRange;
    private boolean hasBirthday;
    private boolean hasGender;


    public static KakaoUserInfo fromMap(Map<String, Object> body, String accessToken) {
        if (body == null) {
            throw new RuntimeException("카카오에서 사용자 정보를 받지 못했어요!");
        }

        Map<String, Object> kakaoAccount = (Map<String, Object>) body.getOrDefault("kakao_account", new HashMap<>());
        Map<String, Object> properties = (Map<String, Object>) body.getOrDefault("properties", new HashMap<>());
        String nickname = (String) properties.getOrDefault("nickname", "카카오 사용자");
        Long kakaoId = body.get("id") != null ? ((Number) body.get("id")).longValue() : null;
        String email = (String) kakaoAccount.getOrDefault("email", "");
        if (email == null || email.isBlank()) {
            email = "kakao_" + kakaoId + "@noemail.kakao";
        }
        return KakaoUserInfo.builder()
                .userId(kakaoId)
                .password(accessToken) // accessToken을 임시 password로 저장
                .hashedPassword(PasswordUtil.sha256(accessToken)) // 직접 구현한 유틸
                .userId(body.get("id") != null ? ((Number) body.get("id")).longValue() : null)
                .connectedAt((String) body.getOrDefault("connected_at", ""))
                .email(email)
                .hasEmail((Boolean) kakaoAccount.getOrDefault("has_email", false))
                .isEmailValid((Boolean) kakaoAccount.getOrDefault("is_email_valid", false))
                .isEmailVerified((Boolean) kakaoAccount.getOrDefault("is_email_verified", false))
                .hasAgeRange((Boolean) kakaoAccount.getOrDefault("has_age_range", false))
                .hasBirthday((Boolean) kakaoAccount.getOrDefault("has_birthday", false))
                .hasGender((Boolean) kakaoAccount.getOrDefault("has_gender", false))
                .build();
    }

}
