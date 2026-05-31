package com.domain.demo_backend.domain.user.domain;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users") // DB의 user 테이블과 매핑
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY) // PostgreSQL의 SERIAL 자동생성
    @Column(name = "user_sqno")
    private Long userSqno;         // user_sqno

    @Column(name = "user_id", length = 50)
    private String userId;              // user_id

    private String password;            // password

    @Column(name = "hashed_password")
    private String hashedPassword;

    private String role;                // role
    private String phone;               // phone
    private String email;               // email
    private String nickname;            // nickname (added for V35)
    private String username;            // username (added for V35)

    @Transient // DB에는 저장하지 않은 필드
    private String repassword;          // repassword

    @Builder.Default
    @Column(name = "del_yn")
    private String delYn = "N"; // 기본값 설정

    @Builder.Default
    @Column(name = "verify_yn")
    private String verifyYn = "N";

    @Column(name = "social_type")
    private String socialType;

    @Column(name = "verification_code")
    private String verificationCode;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "withdraw_at")
    private LocalDateTime withdrawAt;

    // DB업데이트 시 SQL을 직접 지정하고 싶을때 Repository에서 사용
    @Column(name = "verification_expired_at")
    private LocalDateTime verificationExpiredAt;


    @Column(name = "time_using_type")
    private String timeUsingType;

    @Column(name = "drug_using_type")
    private String drugUsingType;

    private String zipCode;

    @Column(name = "kakao_access_token")
    private String kakaoAccessToken;

    @Column(name = "kakao_refresh_token")
    private String kakaoRefreshToken;

    @Column(name = "kakao_token_expires_at")
    private LocalDateTime kakaoTokenExpiresAt;

    @Column(name = "fcm_token")
    private String fcmToken;

    private String roadAddress;

    private String detailAddress;

    public User(String userId, String password, String hashedPassword, String role,  String delYn, String phone, String email, String zipCode, String roadAddress, String detailAddress, String verifyYn, String socialType, LocalDateTime createdAt, LocalDateTime updatedAt, String verificationCode, LocalDateTime withdrawAt, String timeUsingType, String drugUsingType) {
        this.userId = userId;
        this.password = password;
        this.hashedPassword = hashedPassword;
        this.role = role;
        this.delYn = delYn;
        this.phone = phone;
        this.email = email;
        this.zipCode = zipCode;
        this.roadAddress = roadAddress;
        this.detailAddress = detailAddress;
        this.verifyYn = verifyYn;
        this.socialType = socialType;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.verificationCode = verificationCode;
        this.withdrawAt = withdrawAt;
        this.timeUsingType = timeUsingType;
        this.drugUsingType = drugUsingType;
    }

    // JPA가 insert 하기 전 자동으로 시간을 넣어주는 기능
    @PrePersist
    public void prePersist() {

    }

    public void reRegister(@NotBlank(message = "비밀번호는 필수입니다.") String password, String s, @NotBlank(message = "핸드폰 번호는 필수 입력 값입니다.") @Pattern(regexp = "^01(?:0|1|[6-9])-(?:\\d{3}|\\d{4})-\\d{4}$", message = "올바른 핸드폰 번호 형식이 아닙니다.") String phone, @NotBlank(message = "우편번호는 필수입니다.") String zipCode, String roadAddress, String detailAddress) {
    }
}
