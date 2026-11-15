package com.domain.kride.domain.membership.dto;

import com.domain.kride.domain.membership.domain.UserMembership;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class UserMembershipResponse {
    private final Long id;
    private final Long userId;
    private final MembershipResponse membership;
    private final LocalDateTime startedAt;
    private final LocalDateTime expiresAt;
    private final String status;
    private final String grantedBy;
    private final boolean active;

    public UserMembershipResponse(UserMembership um) {
        this.id         = um.getId();
        this.userId     = um.getUserId();
        this.membership = new MembershipResponse(um.getMembership());
        this.startedAt  = um.getStartedAt();
        this.expiresAt  = um.getExpiresAt();
        this.status     = um.getStatus();
        this.grantedBy  = um.getGrantedBy();
        this.active     = um.isActive();
    }
}
