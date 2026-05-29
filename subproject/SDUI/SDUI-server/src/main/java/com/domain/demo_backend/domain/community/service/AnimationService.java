package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.domain.AnimationJobRepository;
import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class AnimationService {

    private static final Set<String> ALLOWED_ROUTES = Set.of(
            "animated_drawings_worker",
            "cogvideox_real",
            "3d_photo_inpainting_real"
    );

    private final AnimationJobRepository animationJobRepository;
    private final CommunityPostRepository postRepository;
    private final WebClient gatewayClient;

    public AnimationService(
            AnimationJobRepository animationJobRepository,
            CommunityPostRepository postRepository,
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl) {
        this.animationJobRepository = animationJobRepository;
        this.postRepository = postRepository;
        this.gatewayClient = WebClient.builder().baseUrl(fastApiUrl).build();
    }

    @Transactional
    public AnimationJob submitAnimation(Long postId, String imageBase64, String route) {
        if (!ALLOWED_ROUTES.contains(route)) {
            throw new IllegalArgumentException("지원하지 않는 route입니다: " + route);
        }

        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));

        Map<String, Object> payload = new HashMap<>();
        payload.put("route", route);
        payload.put("case_id", "community_" + postId);
        payload.put("place", "Community Post");
        payload.put("image_base64", imageBase64);
        payload.put("tts_text", post.getTitle() != null ? post.getTitle() : "커뮤니티 영상");
        payload.put("bgm_key", "bright_travel");
        payload.put("allow_fallback", true);

        Map<String, Object> response;
        try {
            response = gatewayClient.post()
                    .uri("/jobs/runpod")
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();
        } catch (Exception e) {
            log.error("RunPod 제출 실패: {}", e.getMessage());
            AnimationJob job = AnimationJob.builder()
                    .post(post)
                    .status("FAILED")
                    .errorMessage("RunPod 제출 실패: " + e.getMessage())
                    .build();
            return animationJobRepository.save(job);
        }

        String runpodJobId = response != null ? String.valueOf(response.get("id")) : null;
        AnimationJob job = AnimationJob.builder()
                .post(post)
                .runpodJobId(runpodJobId)
                .status("QUEUED")
                .build();

        return animationJobRepository.save(job);
    }

    @Transactional
    public AnimationJob getAnimationStatus(Long postId) {
        AnimationJob job = animationJobRepository.findTopByPostPostIdOrderByCreatedAtDesc(postId)
                .orElseThrow(() -> new IllegalArgumentException("애니메이션 작업을 찾을 수 없습니다."));

        if ("COMPLETED".equals(job.getStatus()) || "FAILED".equals(job.getStatus())) {
            return job;
        }

        if (job.getRunpodJobId() == null) {
            return job;
        }

        try {
            Map<String, Object> statusResponse = gatewayClient.get()
                    .uri("/jobs/runpod/{jobId}", job.getRunpodJobId())
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

            if (statusResponse != null) {
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
                    }
                    case "FAILED" -> {
                        job.setStatus("FAILED");
                        job.setErrorMessage(String.valueOf(statusResponse.getOrDefault("error", "RunPod 작업 실패")));
                    }
                    case "IN_PROGRESS" -> job.setStatus("RUNNING");
                    default -> { /* QUEUED 등 유지 */ }
                }
                animationJobRepository.save(job);
            }
        } catch (Exception e) {
            log.warn("RunPod 상태 조회 실패: {}", e.getMessage());
        }

        return job;
    }
}
