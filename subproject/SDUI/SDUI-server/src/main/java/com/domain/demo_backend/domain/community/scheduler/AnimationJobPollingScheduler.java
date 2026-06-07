package com.domain.demo_backend.domain.community.scheduler;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.domain.AnimationJobRepository;
import com.domain.demo_backend.domain.community.service.AnimationService;
import com.domain.demo_backend.domain.notification.service.UnifiedNotificationService;
import com.domain.demo_backend.domain.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class AnimationJobPollingScheduler {

    private static final List<String> ACTIVE_STATUSES = List.of("QUEUED", "RUNNING");
    private static final List<String> TERMINAL_STATUSES =
            List.of("COMPLETED", "FAILED", "TIMED_OUT");

    private final AnimationJobRepository animationJobRepository;
    private final AnimationService animationService;
    private final UnifiedNotificationService unifiedNotificationService;
    private final Logger log = LoggerFactory.getLogger(AnimationJobPollingScheduler.class);

    @Scheduled(fixedDelay = 60000)
    public void pollRunPodJobs() {
        List<AnimationJob> pendingJobs = animationJobRepository
                .findByStatusInAndNotifSentFalse(ACTIVE_STATUSES);

        for (AnimationJob job : pendingJobs) {
            if (job.getRunpodJobId() == null) {
                continue;
            }
            try {
                animationService.refreshAnimationJob(job);
            } catch (Exception e) {
                log.warn(
                        "Animation job polling failed. runpodJobId={}, error={}",
                        job.getRunpodJobId(),
                        e.getMessage()
                );
            }
        }

        animationJobRepository
                .findByStatusInAndNotifSentFalse(TERMINAL_STATUSES)
                .forEach(this::sendTerminalNotification);
    }

    private void sendTerminalNotification(AnimationJob job) {
        try {
            User author = job.getPost().getAuthor();
            if (author == null) {
                job.setNotifSent(true);
                animationJobRepository.save(job);
                return;
            }

            if ("COMPLETED".equals(job.getStatus())) {
                unifiedNotificationService.sendAnimationComplete(author, job);
            } else {
                unifiedNotificationService.sendAnimationFailed(author, job);
            }

            job.setNotifSent(true);
            animationJobRepository.save(job);
        } catch (Exception e) {
            log.error("Animation notification failed. jobId={}", job.getId(), e);
        }
    }
}
