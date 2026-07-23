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

public interface PostReportRepository extends JpaRepository<PostReport, Long> {

    boolean existsByPost_PostIdAndReporter_UserSqno(Long postId, Long reporterSqno);

    @EntityGraph(attributePaths = {"post", "reporter", "assignedAdmin"})
    Page<PostReport> findByStatusOrderByReviewDueAtAscPostReportIdAsc(
            PostReportStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"post", "reporter", "assignedAdmin"})
    @Query("SELECT r FROM PostReport r WHERE r.postReportId = :reportId")
    Optional<PostReport> findByIdForModeration(@Param("reportId") Long reportId);
}
