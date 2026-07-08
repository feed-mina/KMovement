package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.community.domain.AnimationJobRepository;
import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import com.domain.demo_backend.domain.community.domain.PostImage;
import com.domain.demo_backend.domain.community.domain.PostImageRepository;
import com.domain.demo_backend.domain.community.dto.AnimationCreateRequest;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.exception.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnimationServiceTest {

    @Mock
    private AnimationJobRepository animationJobRepository;
    @Mock
    private CommunityPostRepository postRepository;
    @Mock
    private PostImageRepository imageRepository;
    @Mock
    private UserRepository userRepository;

    private AnimationService animationService;

    @BeforeEach
    void setUp() {
        animationService = new AnimationService(
                animationJobRepository,
                postRepository,
                imageRepository,
                userRepository,
                "http://localhost:8000",
                "test-internal-key",
                60
        );
    }

    @Test
    void rejectsAnimationSubmissionFromNonOwner() {
        User requester = User.builder().userSqno(10L).build();
        User owner = User.builder().userSqno(20L).build();
        CommunityPost post = CommunityPost.builder()
                .postId(1L)
                .author(owner)
                .build();

        when(userRepository.findByUserSqnoForAnimationLimit(10L))
                .thenReturn(Optional.of(requester));
        when(postRepository.findByPostIdForAnimationUpdate(1L))
                .thenReturn(Optional.of(post));

        assertThatThrownBy(() -> animationService.submitAnimation(
                1L,
                10L,
                request(100L)
        )).isInstanceOfSatisfying(
                BusinessException.class,
                exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatus())
                        .isEqualTo(HttpStatus.FORBIDDEN)
        );

        verifyNoInteractions(imageRepository);
    }

    @Test
    void rejectsDuplicateActiveAnimationForPost() {
        User owner = User.builder().userSqno(10L).build();
        CommunityPost post = CommunityPost.builder()
                .postId(1L)
                .author(owner)
                .build();

        when(userRepository.findByUserSqnoForAnimationLimit(10L))
                .thenReturn(Optional.of(owner));
        when(postRepository.findByPostIdForAnimationUpdate(1L))
                .thenReturn(Optional.of(post));
        when(animationJobRepository.existsByPost_PostIdAndStatusIn(
                org.mockito.ArgumentMatchers.eq(1L),
                anyList()
        )).thenReturn(true);

        assertThatThrownBy(() -> animationService.submitAnimation(
                1L,
                10L,
                request(100L)
        )).isInstanceOfSatisfying(
                BusinessException.class,
                exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatus())
                        .isEqualTo(HttpStatus.CONFLICT)
        );

        verifyNoInteractions(imageRepository);
    }

    @Test
    void submitsToraPhotoOnlyWithTrajectoryPreset() throws Exception {
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/jobs/runpod", exchange -> {
            requestBody.set(new String(
                    exchange.getRequestBody().readAllBytes(),
                    StandardCharsets.UTF_8
            ));
            byte[] response = "{\"id\":\"runpod-job-41\"}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        try {
            animationService = new AnimationService(
                    animationJobRepository,
                    postRepository,
                    imageRepository,
                    userRepository,
                    "http://localhost:" + server.getAddress().getPort(),
                    "test-internal-key",
                    60
            );

            User owner = User.builder().userSqno(10L).build();
            CommunityPost post = CommunityPost.builder()
                    .postId(41L)
                    .author(owner)
                    .title("Tora doodle smoke")
                    .build();
            PostImage photo = PostImage.builder()
                    .postImageId(101L)
                    .post(post)
                    .storageUrl("https://example.supabase.co/photo.jpg")
                    .mimeType("image/jpeg")
                    .fileSize(1024L)
                    .build();

            when(userRepository.findByUserSqnoForAnimationLimit(10L))
                    .thenReturn(Optional.of(owner));
            when(postRepository.findByPostIdForAnimationUpdate(41L))
                    .thenReturn(Optional.of(post));
            when(imageRepository.findByPostImageIdAndPost_PostId(101L, 41L))
                    .thenReturn(Optional.of(photo));
            when(animationJobRepository.save(any(AnimationJob.class)))
                    .thenAnswer(invocation -> invocation.getArgument(0));

            AnimationCreateRequest request = new AnimationCreateRequest();
            request.setPostImageId(101L);
            request.setRoute("tora_cogvideox_i2v");
            request.setTrajectoryPreset("arc_up");

            AnimationJob job = animationService.submitAnimation(41L, 10L, request);
            Map<String, Object> payload = new ObjectMapper().readValue(
                    requestBody.get(),
                    new TypeReference<>() {}
            );

            assertThat(job.getRunpodJobId()).isEqualTo("runpod-job-41");
            assertThat(payload.get("route")).isEqualTo("tora_cogvideox_i2v");
            assertThat(payload.get("image_url")).isEqualTo(photo.getStorageUrl());
            assertThat(payload.get("trajectory_preset")).isEqualTo("arc_up");
            assertThat(payload).doesNotContainKeys(
                    "overlay_image_url",
                    "overlay_position",
                    "overlay_alpha",
                    "overlay_speed",
                    "overlay_scale_ratio"
            );
            assertThat(payload.get("allow_fallback")).isEqualTo(false);
            assertThat(payload.get("case_id").toString())
                    .startsWith("community_41_");
        } finally {
            server.stop(0);
        }
    }

    @Test
    void rejectsToraOverlayBecauseDoodlesUseMediaEndpoint() {
        User owner = User.builder().userSqno(10L).build();
        CommunityPost post = CommunityPost.builder()
                .postId(41L)
                .author(owner)
                .title("Tora photo only")
                .build();
        PostImage photo = PostImage.builder()
                .postImageId(101L)
                .post(post)
                .storageUrl("https://example.supabase.co/photo.jpg")
                .mimeType("image/jpeg")
                .fileSize(1024L)
                .build();

        when(userRepository.findByUserSqnoForAnimationLimit(10L))
                .thenReturn(Optional.of(owner));
        when(postRepository.findByPostIdForAnimationUpdate(41L))
                .thenReturn(Optional.of(post));
        when(imageRepository.findByPostImageIdAndPost_PostId(101L, 41L))
                .thenReturn(Optional.of(photo));

        AnimationCreateRequest request = new AnimationCreateRequest();
        request.setPostImageId(101L);
        request.setRoute("tora_cogvideox_i2v");
        request.setTrajectoryPreset("arc_up");
        request.setOverlayPostImageId(102L);

        assertThatThrownBy(() -> animationService.submitAnimation(41L, 10L, request))
                .isInstanceOfSatisfying(
                        BusinessException.class,
                        exception -> org.assertj.core.api.Assertions.assertThat(exception.getStatus())
                                .isEqualTo(HttpStatus.BAD_REQUEST)
                );
    }

    private AnimationCreateRequest request(Long postImageId) {
        AnimationCreateRequest request = new AnimationCreateRequest();
        request.setPostImageId(postImageId);
        request.setRoute("animated_drawings_worker");
        return request;
    }
}
