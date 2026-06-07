package com.domain.demo_backend.domain.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface AnimationJobRepository extends JpaRepository<AnimationJob, Long> {

    Optional<AnimationJob> findTopByPostPostIdOrderByCreatedAtDesc(Long postId);

    List<AnimationJob> findByStatusInAndNotifSentFalse(List<String> statuses);

    boolean existsByPost_PostIdAndStatusIn(Long postId, List<String> statuses);

    long countByPost_Author_UserSqnoAndStatusIn(Long userSqno, List<String> statuses);

    long countByPost_Author_UserSqnoAndCreatedAtGreaterThanEqual(
            Long userSqno,
            LocalDateTime createdAt
    );
}
