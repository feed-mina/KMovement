package com.domain.demo_backend.domain.celery.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CeleryJobRepository extends JpaRepository<CeleryJob, Long> {

    Optional<CeleryJob> findByCeleryTaskId(String celeryTaskId);

    List<CeleryJob> findByStatusInAndNotifSentFalse(List<String> statuses);

    List<CeleryJob> findByRequestedByAndTaskTypeOrderByCreatedAtDesc(
            Long requestedBy, String taskType
    );
}
