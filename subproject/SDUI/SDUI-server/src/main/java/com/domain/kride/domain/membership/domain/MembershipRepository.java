package com.domain.kride.domain.membership.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MembershipRepository extends JpaRepository<Membership, Long> {
    boolean existsByName(String name);
    Optional<Membership> findByName(String name);
}
