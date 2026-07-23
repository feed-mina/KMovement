package com.domain.demo_backend.domain.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommunityModerationAuditRepository extends JpaRepository<CommunityModerationAudit, Long> {

    @EntityGraph(attributePaths = {"adminActor"})
    Page<CommunityModerationAudit> findByTargetTypeStartingWithOrderByCreatedAtDescAuditIdDesc(
            String targetTypePrefix, Pageable pageable);
}
