package com.domain.kride.domain.membership.service;

import com.domain.kride.domain.membership.domain.Membership;
import com.domain.kride.domain.membership.domain.MembershipRepository;
import com.domain.kride.domain.membership.domain.UserMembership;
import com.domain.kride.domain.membership.domain.UserMembershipRepository;
import com.domain.kride.domain.membership.dto.UserMembershipRequest;
import com.domain.kride.domain.membership.dto.UserMembershipResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserMembershipService {

    private final UserMembershipRepository userMembershipRepository;
    private final MembershipRepository membershipRepository;

    @Transactional(readOnly = true)
    public UserMembershipResponse findCurrent(Long userId) {
        return userMembershipRepository
                .findActiveByUserId(userId, LocalDateTime.now())
                .map(UserMembershipResponse::new)
                .orElse(null);
    }

    @Transactional
    public UserMembershipResponse grant(UserMembershipRequest req) {
        Membership membership = membershipRepository.findById(req.getMembershipId())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 멤버십입니다: " + req.getMembershipId()));

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startedAt = req.getStartedAt() != null ? req.getStartedAt() : now;
        LocalDateTime expiresAt = startedAt.plusDays(membership.getDurationDays());

        userMembershipRepository.cancelActiveByUserId(req.getUserId(), now);

        UserMembership userMembership = UserMembership.builder()
                .userId(req.getUserId())
                .membership(membership)
                .startedAt(startedAt)
                .expiresAt(expiresAt)
                .status("active")
                .grantedBy(req.getGrantedBy() != null ? req.getGrantedBy() : "purchase")
                .build();

        log.info("멤버십 부여 - userId={}, membership={}, expires={}", req.getUserId(), membership.getName(), expiresAt);

        return new UserMembershipResponse(userMembershipRepository.save(userMembership));
    }

    @Transactional
    public void grantByMembershipName(Long userId, String membershipName, String grantedBy) {
        membershipRepository.findByName(membershipName).ifPresent(membership -> {
            LocalDateTime now = LocalDateTime.now();
            userMembershipRepository.cancelActiveByUserId(userId, now);
            UserMembership userMembership = UserMembership.builder()
                    .userId(userId)
                    .membership(membership)
                    .startedAt(now)
                    .expiresAt(now.plusDays(membership.getDurationDays()))
                    .status("active")
                    .grantedBy(grantedBy)
                    .build();
            log.info("회원가입 프리미엄 자동 부여 - userId={}, membership={}", userId, membershipName);
            userMembershipRepository.save(userMembership);
        });
    }

    @Transactional(readOnly = true)
    public boolean canConverse(Long userId) {
        return userMembershipRepository.findActiveByUserId(userId, LocalDateTime.now())
                .map(um -> um.getMembership().isCanConverse())
                .orElse(false);
    }
}
