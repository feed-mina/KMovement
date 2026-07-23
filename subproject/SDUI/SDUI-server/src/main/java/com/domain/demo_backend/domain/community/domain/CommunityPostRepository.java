package com.domain.demo_backend.domain.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.Optional;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    @EntityGraph(attributePaths = {"author", "images"})
    Page<CommunityPost> findByDelYnOrderByCreatedAtDesc(String delYn, Pageable pageable);

    @EntityGraph(attributePaths = {"author", "images"})
    Page<CommunityPost> findByDelYnAndModerationStatusOrderByCreatedAtDesc(
            String delYn, ContentModerationStatus moderationStatus, Pageable pageable);

    @EntityGraph(attributePaths = {"author", "images"})
    @Query("SELECT p FROM CommunityPost p WHERE p.postId = :postId AND p.delYn = 'N'")
    Optional<CommunityPost> findByPostIdWithDetails(@Param("postId") Long postId);

    @EntityGraph(attributePaths = {"author", "images"})
    @Query("SELECT p FROM CommunityPost p WHERE p.postId = :postId AND p.delYn = 'N' "
            + "AND p.moderationStatus = 'APPROVED'")
    Optional<CommunityPost> findApprovedByPostIdWithDetails(@Param("postId") Long postId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"author", "moderatedBy"})
    @Query("SELECT p FROM CommunityPost p WHERE p.postId = :postId AND p.delYn = 'N'")
    Optional<CommunityPost> findByIdForModeration(@Param("postId") Long postId);

    @EntityGraph(attributePaths = {"author", "moderatedBy"})
    Page<CommunityPost> findByModerationStatusAndDelYnOrderByModerationDueAtAscPostIdAsc(
            ContentModerationStatus moderationStatus, String delYn, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CommunityPost p JOIN FETCH p.author WHERE p.postId = :postId AND p.delYn = 'N'")
    Optional<CommunityPost> findByPostIdForAnimationUpdate(@Param("postId") Long postId);

    @EntityGraph(attributePaths = {"author"})
    Page<CommunityPost> findByAuthorSqnoAndDelYnOrderByCreatedAtDesc(
            Long authorSqno, String delYn, Pageable pageable);
}
