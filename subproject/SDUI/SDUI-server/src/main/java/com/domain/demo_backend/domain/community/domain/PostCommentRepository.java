package com.domain.demo_backend.domain.community.domain;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface PostCommentRepository extends JpaRepository<PostComment, Long> {

    @EntityGraph(attributePaths = {"author"})
    Page<PostComment> findByPost_PostIdAndModerationStatusAndDelYnOrderByCreatedAtAsc(
            Long postId, ContentModerationStatus moderationStatus, String delYn, Pageable pageable);

    @EntityGraph(attributePaths = {"author", "post"})
    @Query("SELECT c FROM PostComment c WHERE c.commentId = :commentId AND c.delYn = 'N'")
    Optional<PostComment> findVisibleByIdWithDetails(@Param("commentId") Long commentId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"author", "post", "moderatedBy"})
    @Query("SELECT c FROM PostComment c WHERE c.commentId = :commentId AND c.delYn = 'N'")
    Optional<PostComment> findByIdForModeration(@Param("commentId") Long commentId);

    @EntityGraph(attributePaths = {"author", "moderatedBy", "post"})
    Page<PostComment> findByModerationStatusAndDelYnOrderByModerationDueAtAscCommentIdAsc(
            ContentModerationStatus moderationStatus, String delYn, Pageable pageable);
}
