package com.domain.demo_backend.domain.celery.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "celery_jobs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CeleryJob {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "celery_task_id", length = 100, unique = true)
    private String celeryTaskId;

    @Column(name = "task_type", length = 50, nullable = false)
    private String taskType;

    @Builder.Default
    @Column(name = "status", length = 30)
    private String status = "QUEUED";

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "progress_step", length = 50)
    private String progressStep;

    @Column(name = "progress_pct")
    private Integer progressPct;

    @Column(name = "requested_by")
    private Long requestedBy;

    @Builder.Default
    @Column(name = "notif_sent", nullable = false)
    private boolean notifSent = false;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
