package com.domain.kride.domain.membership.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface UserMembershipRepository extends JpaRepository<UserMembership, Long> {

    @Query("SELECT um FROM UserMembership um JOIN FETCH um.membership " +
           "WHERE um.userId = :userId AND um.status = 'active' AND um.expiresAt > :now " +
           "ORDER BY um.createdAt DESC")
    Optional<UserMembership> findActiveByUserId(
            @Param("userId") Long userId,
            @Param("now") LocalDateTime now
    );

    @Modifying
    @Query("UPDATE UserMembership um SET um.status = 'cancelled', um.updatedAt = :now " +
           "WHERE um.userId = :userId AND um.status = 'active'")
    void cancelActiveByUserId(
            @Param("userId") Long userId,
            @Param("now") LocalDateTime now
    );
}
