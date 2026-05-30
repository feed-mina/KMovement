package com.domain.demo_backend.domain.community.scheduler;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.domain.AnimationJobRepository;
import com.domain.demo_backend.domain.kakao.service.KakaoNotificationService;
import com.domain.demo_backend.domain.user.domain.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class AnimationJobPollingScheduler {

    private final AnimationJobRepository animationJobRepository;
    private final KakaoNotificationService kakaoNotificationService;
    private final Logger log = LoggerFactory.getLogger(AnimationJobPollingScheduler.class);

    @Value("${kride.fastapi.url:http://localhost:8000}")
    private String fastApiUrl;

    @Scheduled(fixedDelay = 60000)
    public void pollRunPodJobs() {
        List<AnimationJob> pendingJobs = animationJobRepository
                .findByStatusInAndNotifSentFalse(List.of("QUEUED", "RUNNING"));

        if (pendingJobs.isEmpty()) {
            return;
        }

        WebClient client = WebClient.create(fastApiUrl);

        for (AnimationJob job : pendingJobs) {
            if (job.getRunpodJobId() == null) {
                continue;
            }

            try {
                Map<String, Object> statusResponse = client.get()
                        .uri("/jobs/runpod/{jobId}", job.getRunpodJobId())
                        .retrieve()
                        .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                        .block();

                if (statusResponse == null) {
                    continue;
                }

                String runpodStatus = String.valueOf(statusResponse.get("status"));

                switch (runpodStatus) {
                    case "COMPLETED" -> {
                        job.setStatus("COMPLETED");
                        Object output = statusResponse.get("output");
                        if (output instanceof Map<?, ?> outputMap) {
                            Object resultUrl = outputMap.get("result_url");
                            if (resultUrl != null) {
                                job.setResultUrl(String.valueOf(resultUrl));
                            }
                        }
                        animationJobRepository.save(job);
                        sendNotification(job, true);
                    }
                    case "FAILED" -> {
                        job.setStatus("FAILED");
                        job.setErrorMessage(String.valueOf(
                                statusResponse.getOrDefault("error", "RunPod 작업 실패")));
                        animationJobRepository.save(job);
                        sendNotification(job, false);
                    }
                    case "IN_PROGRESS" -> {
                        if (!"RUNNING".equals(job.getStatus())) {
                            job.setStatus("RUNNING");
                            animationJobRepository.save(job);
                        }
                    }
                    default -> { /* QUEUED 등 유지 */ }
                }
            } catch (Exception e) {
                log.warn("AnimationJobPoller-RunPod 상태 조회 실패. jobId={}, error={}",
                        job.getRunpodJobId(), e.getMessage());
            }
        }
    }

    private void sendNotification(AnimationJob job, boolean success) {
        try {
            User author = job.getPost().getAuthor();
            if (author == null || author.getKakaoAccessToken() == null) {
                log.debug("AnimationJobPoller-카카오 토큰 없음, 알림 skip. jobId={}", job.getId());
                job.setNotifSent(true);
                animationJobRepository.save(job);
                return;
            }

            if (success) {
                kakaoNotificationService.sendAnimationComplete(author, job);
            } else {
                kakaoNotificationService.sendAnimationFailed(author, job);
            }

            job.setNotifSent(true);
            animationJobRepository.save(job);
            log.info("AnimationJobPoller-카카오 알림 발송 완료. jobId={}, success={}", job.getId(), success);
        } catch (Exception e) {
            log.error("AnimationJobPoller-카카오 알림 발송 실패. jobId={}", job.getId(), e);
        }
    }
}
