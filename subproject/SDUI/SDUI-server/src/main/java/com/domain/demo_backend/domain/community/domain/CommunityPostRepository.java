package com.domain.demo_backend.domain.community.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Optional;

public interface CommunityPostRepository extends JpaRepository<CommunityPost, Long> {

    @EntityGraph(attributePaths = {"author", "images"})
    Page<CommunityPost> findByDelYnOrderByCreatedAtDesc(String delYn, Pageable pageable);

    @EntityGraph(attributePaths = {"author", "images"})
    @Query("SELECT p FROM CommunityPost p WHERE p.postId = :postId AND p.delYn = 'N'")
    Optional<CommunityPost> findByPostIdWithDetails(@Param("postId") Long postId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM CommunityPost p JOIN FETCH p.author WHERE p.postId = :postId AND p.delYn = 'N'")
    Optional<CommunityPost> findByPostIdForAnimationUpdate(@Param("postId") Long postId);

    @EntityGraph(attributePaths = {"author"})
    Page<CommunityPost> findByAuthorSqnoAndDelYnOrderByCreatedAtDesc(
            Long authorSqno, String delYn, Pageable pageable);

    // 어드민 통계용
    long countByDelYn(String delYn);

    long countByDelYnAndCreatedAtAfter(String delYn, LocalDateTime after);

    @EntityGraph(attributePaths = {"author"})
    Page<CommunityPost> findByDelYnOrderByLikeCountDesc(String delYn, Pageable pageable);
}
