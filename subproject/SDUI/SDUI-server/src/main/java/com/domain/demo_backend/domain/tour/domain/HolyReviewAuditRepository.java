package com.domain.demo_backend.domain.tour.domain;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface HolyReviewAuditRepository extends JpaRepository<HolyReviewAudit,Long> {
    List<HolyReviewAudit> findByPoiSqnoOrderByAuditIdAsc(Long poiSqno);
}
