package com.domain.kride.domain.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserFollowRepository extends JpaRepository<UserFollow, Long> {

    Optional<UserFollow> findByFollower_UserSqnoAndFollowee_UserSqno(Long followerSqno, Long followeeSqno);

    boolean existsByFollower_UserSqnoAndFollowee_UserSqno(Long followerSqno, Long followeeSqno);

    long countByFollowee_UserSqno(Long followeeSqno);

    long countByFollower_UserSqno(Long followerSqno);
}
