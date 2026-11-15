package com.domain.kride.domain.membership.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class UserMembershipRequest {
    private Long userId;
    private Long membershipId;
    private LocalDateTime startedAt;   // null이면 서버에서 NOW() 적용
    private String grantedBy;          // "purchase" | "admin" | "trial" (null이면 "purchase")
}
