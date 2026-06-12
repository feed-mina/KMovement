package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.domain.AnimationJobRepository;
import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import com.domain.demo_backend.domain.community.domain.PostImage;
import com.domain.demo_backend.domain.community.domain.PostImageRepository;
import com.domain.demo_backend.domain.community.dto.AnimationCreateRequest;
import com.domain.demo_backend.domain.community.dto.BatchAnimationImageRequest;
import com.domain.demo_backend.domain.community.dto.BatchAnimationRequest;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.net.URI;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Slf4j
@Service
public class AnimationService {

    private static final Set<String> ALLOWED_ROUTES = Set.of(
            "animated_drawings_worker",
            "cogvideox_real",
            "3d_photo_inpainting_real",
            "tora_cogvideox_i2v"
    );
    private static final Set<String> ALLOWED_PHOTO_ROUTES = Set.of(
            "auto",
            "cogvideox_real",
            "3d_photo_light",
            "tora_cogvideox_i2v"
    );
    private static final List<String> ACTIVE_STATUSES = List.of("QUEUED", "RUNNING");
    private static final Set<String> TERMINAL_STATUSES = Set.of(
            "COMPLETED",
            "FAILED",
            "TIMED_OUT"
    );
    private static final int MAX_CONCURRENT_JOBS_PER_USER = 2;
    private static final int MAX_DAILY_JOBS_PER_USER = 10;
    private static final long MAX_IMAGE_SIZE = 10L * 1024 * 1024;
    private static final long MAX_JOB_IMAGE_SIZE = 50L * 1024 * 1024;
    private static final Set<String> ALLOWED_OVERLAY_POSITIONS = Set.of(
            "main_w-overlay_w-10:main_h-overlay_h-10",
            "10:10",
            "main_w-overlay_w-10:10",
            "10:main_h-overlay_h-10",
            "(main_w-overlay_w)/2:(main_h-overlay_h)/2"
    );

    private final AnimationJobRepository animationJobRepository;
    private final CommunityPostRepository postRepository;
    private final PostImageRepository imageRepository;
    private final UserRepository userRepository;
    private final WebClient gatewayClient;
    private final int timeoutMinutes;

    public AnimationService(
            AnimationJobRepository animationJobRepository,
            CommunityPostRepository postRepository,
            PostImageRepository imageRepository,
            UserRepository userRepository,
            @Value("${kride.fastapi.url:http://localhost:8000}") String fastApiUrl,
            @Value("${fastapi.internal-api-key:sdui-internal-dev-key}") String internalApiKey,
            @Value("${kride.animation.timeout-minutes:60}") int timeoutMinutes
    ) {
        this.animationJobRepository = animationJobRepository;
        this.postRepository = postRepository;
        this.imageRepository = imageRepository;
        this.userRepository = userRepository;
        this.timeoutMinutes = timeoutMinutes;

        WebClient.Builder builder = WebClient.builder().baseUrl(fastApiUrl);
        if (internalApiKey != null && !internalApiKey.isBlank()) {
            builder.defaultHeader("X-Internal-Api-Key", internalApiKey);
        }
        this.gatewayClient = builder.build();
    }

    @Transactional
    public AnimationJob submitAnimation(
            Long postId,
            Long userSqno,
            AnimationCreateRequest request
    ) {
        String route = request.getRoute();
        if (!ALLOWED_ROUTES.contains(route)) {
            throw new BusinessException("지원하지 않는 영상 생성 방식입니다.", HttpStatus.BAD_REQUEST);
        }

        CommunityPost post = prepareSubmission(postId, userSqno);
        PostImage image = resolvePostImage(postId, request.getPostImageId());

        Map<String, Object> payload = new HashMap<>();
        payload.put("route", route);
        payload.put("case_id", uniqueCaseId("community_" + postId));
        payload.put("place", "Community Post");
        payload.put("image_url", image.getStorageUrl());
        payload.put("tts_text", defaultNarration(post));
        payload.put("bgm_key", "bright_travel");
        payload.put("allow_fallback", !"tora_cogvideox_i2v".equals(route));

        // Tora is trajectory-controlled: without a trajectory the worker hard-fails
        // and silently falls back to cogvideox_real. Always forward a preset
        // (the user's choice, or a sensible default) so real Tora runs.
        if ("tora_cogvideox_i2v".equals(route)) {
            String preset = request.getTrajectoryPreset();
            payload.put(
                    "trajectory_preset",
                    preset != null && !preset.isBlank() ? preset.trim() : "object_pan_right"
            );
            if (request.getOverlayPostImageId() != null) {
                PostImage overlayImage = resolvePostImage(
                        postId,
                        request.getOverlayPostImageId()
                );
                if (overlayImage.getPostImageId().equals(image.getPostImageId())) {
                    throw new BusinessException(
                            "배경 사진과 낙서 이미지는 서로 달라야 합니다.",
                            HttpStatus.BAD_REQUEST
                    );
                }
                payload.put("overlay_image_url", overlayImage.getStorageUrl());
                payload.put(
                        "overlay_position",
                        validatedOverlayPosition(request.getOverlayPosition())
                );
                payload.put("overlay_alpha", boundedOverlayAlpha(request.getOverlayAlpha()));
                payload.put("overlay_speed", boundedOverlaySpeed(request.getOverlaySpeed()));
                payload.put("overlay_scale_ratio", 0.2);
            }
        }

        return submitToGateway(post, route, 1, "/jobs/runpod", payload);
    }

    @Transactional
    public AnimationJob submitBatchAnimation(
            Long postId,
            Long userSqno,
            BatchAnimationRequest request
    ) {
        if (request.getImages() == null || request.getImages().isEmpty()) {
            throw new BusinessException("영상에 사용할 이미지를 선택해주세요.", HttpStatus.BAD_REQUEST);
        }
        if (!ALLOWED_PHOTO_ROUTES.contains(request.getPhotoRoute())) {
            throw new BusinessException("지원하지 않는 사진 영상 생성 방식입니다.", HttpStatus.BAD_REQUEST);
        }

        CommunityPost post = prepareSubmission(postId, userSqno);
        Set<Long> selectedIds = new HashSet<>();
        List<Map<String, Object>> images = new ArrayList<>();
        long totalBytes = 0;

        for (BatchAnimationImageRequest item : request.getImages()) {
            if (!selectedIds.add(item.getPostImageId())) {
                throw new BusinessException("같은 이미지를 중복 선택할 수 없습니다.", HttpStatus.BAD_REQUEST);
            }
            PostImage image = resolvePostImage(postId, item.getPostImageId());
            totalBytes += image.getFileSize() != null ? image.getFileSize() : 0;
            if (totalBytes > MAX_JOB_IMAGE_SIZE) {
                throw new BusinessException(
                        "한 작업의 이미지 전체 크기는 50MB를 초과할 수 없습니다.",
                        HttpStatus.PAYLOAD_TOO_LARGE
                );
            }

            Map<String, Object> imagePayload = new HashMap<>();
            imagePayload.put("image_url", image.getStorageUrl());
            // tts_text가 비어있으면 빈 문자열을 보내서 RunPod worker가
            // BLIP-2 이미지 캡셔닝으로 자동 생성하도록 한다.
            imagePayload.put(
                    "tts_text",
                    item.getTtsText() == null || item.getTtsText().isBlank()
                            ? ""
                            : item.getTtsText().trim()
            );
            imagePayload.put(
                    "image_type",
                    item.getImageType() == null ? "auto" : item.getImageType()
            );
            images.add(imagePayload);
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("case_id", uniqueCaseId("community_batch_" + postId));
        payload.put("place", "Community Post");
        payload.put("images", images);
        payload.put("bgm_key", request.getBgmKey());
        payload.put("photo_route", request.getPhotoRoute());
        payload.put("allow_fallback", true);
        payload.put("bgm_description", request.getBgmDescription() != null ? request.getBgmDescription() : "");
        payload.put("bgm_duration", request.getBgmDuration());
        // BLIP-2 캡셔닝 실패 시 fallback으로 사용할 게시글 제목
        payload.put("default_tts_text", defaultNarration(post));

        return submitToGateway(
                post,
                "batch_video",
                images.size(),
                "/jobs/runpod/batch",
                payload
        );
    }

    @Transactional
    public AnimationJob getAnimationStatus(Long postId) {
        AnimationJob job = animationJobRepository
                .findTopByPostPostIdOrderByCreatedAtDesc(postId)
                .orElseThrow(() -> new IllegalArgumentException("영상 생성 작업을 찾을 수 없습니다."));
        return refreshAnimationJob(job);
    }

    @Transactional
    public AnimationJob refreshAnimationJob(AnimationJob job) {
        if (TERMINAL_STATUSES.contains(job.getStatus()) || job.getRunpodJobId() == null) {
            return job;
        }

        if (job.getCreatedAt() != null
                && job.getCreatedAt().isBefore(LocalDateTime.now().minusMinutes(timeoutMinutes))) {
            job.setStatus("TIMED_OUT");
            job.setErrorMessage("영상 생성 제한 시간을 초과했습니다.");
            return animationJobRepository.save(job);
        }

        try {
            Map<String, Object> statusResponse = gatewayClient.get()
                    .uri("/jobs/runpod/{jobId}", job.getRunpodJobId())
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();
            applyRunPodStatus(job, statusResponse);
        } catch (Exception e) {
            log.warn(
                    "RunPod 상태 조회 실패. jobId={}, error={}",
                    job.getRunpodJobId(),
                    e.getMessage()
            );
        }
        return animationJobRepository.save(job);
    }

    @Transactional
    public void resetAnimationStatus(Long postId, Long userSqno) {
        AnimationJob job = animationJobRepository
                .findTopByPostPostIdOrderByCreatedAtDesc(postId)
                .orElseThrow(() -> new BusinessException(
                        "영상 생성 작업을 찾을 수 없습니다.",
                        HttpStatus.NOT_FOUND
                ));
        if (!isPostOwner(job, userSqno)) {
            throw new BusinessException(
                    "게시글 작성자만 초기화할 수 있습니다.",
                    HttpStatus.FORBIDDEN
            );
        }
        if (ACTIVE_STATUSES.contains(job.getStatus())) {
            throw new BusinessException(
                    "진행 중인 작업은 초기화할 수 없습니다.",
                    HttpStatus.CONFLICT
            );
        }
        animationJobRepository.delete(job);
    }

    public boolean isPostOwner(AnimationJob job, Long userSqno) {
        return userSqno != null
                && job.getPost() != null
                && job.getPost().getAuthor() != null
                && userSqno.equals(job.getPost().getAuthor().getUserSqno());
    }

    private CommunityPost prepareSubmission(Long postId, Long userSqno) {
        userRepository.findByUserSqnoForAnimationLimit(userSqno)
                .orElseThrow(() -> new BusinessException(
                        "사용자를 찾을 수 없습니다.",
                        HttpStatus.UNAUTHORIZED
                ));

        CommunityPost post = postRepository.findByPostIdForAnimationUpdate(postId)
                .orElseThrow(() -> new BusinessException(
                        "게시글을 찾을 수 없습니다.",
                        HttpStatus.NOT_FOUND
                ));
        if (post.getAuthor() == null
                || !userSqno.equals(post.getAuthor().getUserSqno())) {
            throw new BusinessException(
                    "게시글 작성자만 영상을 생성할 수 있습니다.",
                    HttpStatus.FORBIDDEN
            );
        }
        if (animationJobRepository.existsByPost_PostIdAndStatusIn(postId, ACTIVE_STATUSES)) {
            throw new BusinessException(
                    "이 게시글의 영상이 이미 생성 중입니다.",
                    HttpStatus.CONFLICT
            );
        }

        long concurrentJobs = animationJobRepository
                .countByPost_Author_UserSqnoAndStatusIn(userSqno, ACTIVE_STATUSES);
        if (concurrentJobs >= MAX_CONCURRENT_JOBS_PER_USER) {
            throw new BusinessException(
                    "동시에 생성할 수 있는 영상은 2개까지입니다.",
                    HttpStatus.TOO_MANY_REQUESTS
            );
        }

        LocalDateTime today = LocalDate.now().atStartOfDay();
        long dailyJobs = animationJobRepository
                .countByPost_Author_UserSqnoAndCreatedAtGreaterThanEqual(userSqno, today);
        if (dailyJobs >= MAX_DAILY_JOBS_PER_USER) {
            throw new BusinessException(
                    "하루 영상 생성 횟수 10회를 초과했습니다.",
                    HttpStatus.TOO_MANY_REQUESTS
            );
        }
        return post;
    }

    private PostImage resolvePostImage(Long postId, Long postImageId) {
        PostImage image = imageRepository
                .findByPostImageIdAndPost_PostId(postImageId, postId)
                .orElseThrow(() -> new BusinessException(
                        "게시글에 속한 이미지를 찾을 수 없습니다.",
                        HttpStatus.BAD_REQUEST
                ));

        if (image.getMimeType() == null || !image.getMimeType().startsWith("image/")) {
            throw new BusinessException("이미지 형식만 사용할 수 있습니다.", HttpStatus.BAD_REQUEST);
        }
        if (image.getFileSize() != null && image.getFileSize() > MAX_IMAGE_SIZE) {
            throw new BusinessException(
                    "이미지 한 장은 10MB를 초과할 수 없습니다.",
                    HttpStatus.PAYLOAD_TOO_LARGE
            );
        }

        try {
            URI uri = URI.create(image.getStorageUrl());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new BusinessException("안전한 이미지 URL이 아닙니다.", HttpStatus.BAD_REQUEST);
        }
        return image;
    }

    private AnimationJob submitToGateway(
            CommunityPost post,
            String route,
            int totalImages,
            String gatewayPath,
            Map<String, Object> payload
    ) {
        try {
            Map<String, Object> response = gatewayClient.post()
                    .uri(gatewayPath)
                    .bodyValue(payload)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<Map<String, Object>>() {})
                    .block();

            String runpodJobId = response == null ? null : text(response.get("id"));
            if (runpodJobId == null) {
                return saveFailedJob(
                        post,
                        route,
                        totalImages,
                        "RunPod가 작업 ID를 반환하지 않았습니다."
                );
            }

            return animationJobRepository.save(AnimationJob.builder()
                    .post(post)
                    .runpodJobId(runpodJobId)
                    .status("QUEUED")
                    .route(route)
                    .totalImages(totalImages)
                    .build());
        } catch (Exception e) {
            log.error("RunPod 작업 제출 실패. route={}, error={}", route, e.getMessage());
            return saveFailedJob(
                    post,
                    route,
                    totalImages,
                    "RunPod 작업 제출 실패: " + e.getMessage()
            );
        }
    }

    private AnimationJob saveFailedJob(
            CommunityPost post,
            String route,
            int totalImages,
            String errorMessage
    ) {
        return animationJobRepository.save(AnimationJob.builder()
                .post(post)
                .status("FAILED")
                .route(route)
                .totalImages(totalImages)
                .errorMessage(errorMessage)
                .build());
    }

    private void applyRunPodStatus(
            AnimationJob job,
            Map<String, Object> statusResponse
    ) {
        if (statusResponse == null) {
            return;
        }

        String runpodStatus = text(statusResponse.get("status"));
        if ("COMPLETED".equals(runpodStatus)) {
            AnimationRunPodOutput.Parsed parsed =
                    AnimationRunPodOutput.parse(statusResponse.get("output"));
            if (!parsed.succeeded()) {
                job.setStatus("FAILED");
                job.setErrorMessage(parsed.errorMessage());
                return;
            }
            job.setStatus("COMPLETED");
            job.setResultUrl(parsed.resultUrl());
            job.setErrorMessage(null);
            if (parsed.processedImages() != null) {
                job.setProcessedImages(parsed.processedImages());
            } else if (job.getTotalImages() != null) {
                job.setProcessedImages(job.getTotalImages());
            }
            job.setActualModel(parsed.actualModel());
            job.setFailedImageIndexes(parsed.failedImageIndexes());
            return;
        }

        if ("FAILED".equals(runpodStatus)) {
            job.setStatus("FAILED");
            job.setErrorMessage(
                    text(statusResponse.get("error")) != null
                            ? text(statusResponse.get("error"))
                            : "RunPod 작업이 실패했습니다."
            );
            return;
        }

        if ("IN_PROGRESS".equals(runpodStatus)) {
            job.setStatus("RUNNING");
        }
    }

    private String defaultNarration(CommunityPost post) {
        return post.getTitle() != null && !post.getTitle().isBlank()
                ? post.getTitle()
                : "커뮤니티 영상";
    }

    private String uniqueCaseId(String prefix) {
        return prefix + "_" + System.currentTimeMillis();
    }

    private String validatedOverlayPosition(String position) {
        if (position == null || position.isBlank()) {
            return "main_w-overlay_w-10:main_h-overlay_h-10";
        }
        String value = position.trim();
        if (!ALLOWED_OVERLAY_POSITIONS.contains(value)) {
            throw new BusinessException(
                    "지원하지 않는 GIF 배치 위치입니다.",
                    HttpStatus.BAD_REQUEST
            );
        }
        return value;
    }

    private double boundedOverlayAlpha(Double alpha) {
        double value = alpha == null ? 1.0 : alpha;
        if (value < 0.1 || value > 1.0) {
            throw new BusinessException(
                    "GIF 투명도는 0.1에서 1.0 사이여야 합니다.",
                    HttpStatus.BAD_REQUEST
            );
        }
        return value;
    }

    private double boundedOverlaySpeed(Double speed) {
        double value = speed == null ? 1.0 : speed;
        if (value < 0.5 || value > 2.0) {
            throw new BusinessException(
                    "GIF 재생 속도는 0.5에서 2.0 사이여야 합니다.",
                    HttpStatus.BAD_REQUEST
            );
        }
        return value;
    }

    private String text(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() || "null".equalsIgnoreCase(text) ? null : text;
    }
}
