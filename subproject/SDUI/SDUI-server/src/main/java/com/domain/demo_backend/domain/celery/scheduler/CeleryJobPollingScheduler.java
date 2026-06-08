package com.domain.demo_backend.domain.celery.scheduler;

import com.domain.demo_backend.domain.celery.domain.CeleryJob;
import com.domain.demo_backend.domain.celery.service.CeleryJobService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class CeleryJobPollingScheduler {

    private final CeleryJobService celeryJobService;
    private final Logger log = LoggerFactory.getLogger(CeleryJobPollingScheduler.class);

    @Scheduled(fixedDelay = 30000)
    public void pollCeleryJobs() {
        List<CeleryJob> activeJobs = celeryJobService.getActiveJobs();

        for (CeleryJob job : activeJobs) {
            if (job.getCeleryTaskId() == null) continue;
            try {
                celeryJobService.refreshJob(job);
            } catch (Exception e) {
                log.warn("Celery job polling failed. taskId={}, error={}",
                        job.getCeleryTaskId(), e.getMessage());
            }
        }
    }
}
