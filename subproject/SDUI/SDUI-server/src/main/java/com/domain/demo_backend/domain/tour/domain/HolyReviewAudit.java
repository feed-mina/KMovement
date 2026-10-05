package com.domain.demo_backend.domain.tour.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Entity
@Table(name="holy_review_audit")
@Getter
@NoArgsConstructor
public class HolyReviewAudit {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY)
    @Column(name="audit_id") private Long auditId;
    @Column(name="poi_sqno",nullable=false) private Long poiSqno;
    @Column(name="previous_status",nullable=false,length=12) private String previousStatus;
    @Column(name="next_status",nullable=false,length=12) private String nextStatus;
    @Column(nullable=false,length=60) private String reviewer;
    @Column(length=500) private String reason;
    @Column(name="reviewed_at",nullable=false) private LocalDateTime reviewedAt;
    public HolyReviewAudit(Long poiSqno,String nextStatus,String reviewer,String reason,LocalDateTime at) {
        this.poiSqno=poiSqno;this.previousStatus="PENDING";this.nextStatus=nextStatus;
        this.reviewer=reviewer;this.reason=reason;this.reviewedAt=at;
    }
}
