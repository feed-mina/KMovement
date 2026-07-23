package com.domain.demo_backend.domain.celery.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CeleryJobRepository extends JpaRepository<CeleryJob, Long> {

    Optional<CeleryJob> findByCeleryTaskId(String celeryTaskId);

    Optional<CeleryJob> findByCeleryTaskIdAndRequestedBy(String celeryTaskId, Long requestedBy);

    Optional<CeleryJob> findByIdAndRequestedBy(Long id, Long requestedBy);

    Optional<CeleryJob> findByRequestedByAndIdempotencyKey(Long requestedBy, String idempotencyKey);

    long countByRequestedByAndTaskTypeInAndStatusNotIn(
            Long requestedBy,
            Collection<String> taskTypes,
            Collection<String> terminalStatuses
    );

    long countByRequestedByAndTaskTypeInAndCreatedAtGreaterThanEqual(
            Long requestedBy,
            Collection<String> taskTypes,
            LocalDateTime createdAt
    );

    long countByRequestedByAndTaskTypeAndCreatedAtGreaterThanEqual(
            Long requestedBy,
            String taskType,
            LocalDateTime createdAt
    );

    List<CeleryJob> findByStatusNotInAndNotifSentFalse(Collection<String> terminalStatuses);

    List<CeleryJob> findByRequestedByAndTaskTypeOrderByCreatedAtDesc(
            Long requestedBy, String taskType
    );
}
