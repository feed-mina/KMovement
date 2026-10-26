package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.*;
import com.domain.demo_backend.domain.community.dto.*;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.boot.env.YamlPropertySourceLoader;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AnimationMediaRoutingTest {
    private ApplicationContextRunner context() {
        return new ApplicationContextRunner()
                .withInitializer(ctx -> {
                    try {
                        new YamlPropertySourceLoader().load("application",
                                new ClassPathResource("application.yml"))
                                .forEach(source -> ctx.getEnvironment().getPropertySources().addLast(source));
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                })
                .withBean(AnimationJobRepository.class, () -> mock(AnimationJobRepository.class))
                .withBean(CommunityPostRepository.class, () -> mock(CommunityPostRepository.class))
                .withBean(PostImageRepository.class, () -> mock(PostImageRepository.class))
                .withBean(UserRepository.class, () -> mock(UserRepository.class))
                .withBean(AnimationService.class);
    }

    @Test
    void mediaOverrideRoutesSingleBatchAndStatusWithoutTouchingCourseOrChat() throws Exception {
        AtomicInteger oldCalls = new AtomicInteger();
        List<String> mediaCalls = new CopyOnWriteArrayList<>();
        List<String> keys = new CopyOnWriteArrayList<>();
        HttpServer old = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        HttpServer media = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        old.createContext("/", exchange -> {
            oldCalls.incrementAndGet();
            exchange.sendResponseHeaders(500, -1);
            exchange.close();
        });
        media.createContext("/", exchange -> {
            mediaCalls.add(exchange.getRequestMethod() + " " + exchange.getRequestURI().getPath());
            keys.add(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            exchange.getRequestBody().readAllBytes();
            byte[] body = (exchange.getRequestMethod().equals("GET")
                    ? "{\"status\":\"IN_PROGRESS\"}" : "{\"id\":\"existing-job\"}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        old.start();
        media.start();
        String courseUrl = "http://127.0.0.1:" + old.getAddress().getPort();
        String chatUrl = courseUrl + "/chat";
        try {
            context().withPropertyValues(
                    "KRIDE_MEDIA_URL=http://127.0.0.1:" + media.getAddress().getPort(),
                    "KRIDE_MEDIA_INTERNAL_API_KEY=media-only-secret",
                    "kride.fastapi.url=" + courseUrl,
                    "kride.fastapi.chatbot-url=" + chatUrl,
                    "fastapi.internal-api-key=existing-course-secret"
            ).run(ctx -> {
                assertThat(ctx).hasNotFailed();
                User owner = User.builder().userSqno(10L).build();
                CommunityPost post = CommunityPost.builder().postId(41L).author(owner).title("Test").build();
                PostImage photo = PostImage.builder().postImageId(101L).post(post)
                        .storageUrl("https://example.com/photo.jpg").mimeType("image/jpeg").fileSize(10L).build();
                AnimationJobRepository jobs = ctx.getBean(AnimationJobRepository.class);
                when(ctx.getBean(UserRepository.class).findByUserSqnoForAnimationLimit(10L))
                        .thenReturn(Optional.of(owner));
                when(ctx.getBean(CommunityPostRepository.class).findByPostIdForAnimationUpdate(41L))
                        .thenReturn(Optional.of(post));
                when(ctx.getBean(PostImageRepository.class).findByPostImageIdAndPost_PostId(101L, 41L))
                        .thenReturn(Optional.of(photo));
                when(jobs.save(any(AnimationJob.class))).thenAnswer(call -> call.getArgument(0));
                AnimationService service = ctx.getBean(AnimationService.class);
                AnimationCreateRequest single = new AnimationCreateRequest();
                single.setPostImageId(101L);
                single.setRoute("cogvideox_real");
                AnimationJob first = service.submitAnimation(41L, 10L, single);
                assertThat(first.getRunpodJobId()).isEqualTo("existing-job");
                BatchAnimationImageRequest image = new BatchAnimationImageRequest();
                image.setPostImageId(101L);
                BatchAnimationRequest batch = new BatchAnimationRequest();
                batch.setImages(List.of(image));
                batch.setPhotoRoute("auto");
                service.submitBatchAnimation(41L, 10L, batch);
                service.refreshAnimationJob(first);
                assertThat(first.getStatus()).isEqualTo("RUNNING");
                assertThat(ctx.getEnvironment().getProperty("kride.fastapi.url")).isEqualTo(courseUrl);
                assertThat(ctx.getEnvironment().getProperty("kride.fastapi.chatbot-url")).isEqualTo(chatUrl);
                assertThat(ctx.getEnvironment().getProperty("fastapi.internal-api-key"))
                        .isEqualTo("existing-course-secret");
            });
            assertThat(mediaCalls).containsExactly(
                    "POST /jobs/runpod", "POST /jobs/runpod/batch", "GET /jobs/runpod/existing-job");
            assertThat(keys).containsExactly("media-only-secret", "media-only-secret", "media-only-secret");
            assertThat(oldCalls).hasValue(0);
        } finally {
            media.stop(0);
            old.stop(0);
        }
    }

    @Test
    void absentMediaSettingsKeepLegacyAddressAndKeyForStatus() throws Exception {
        List<String> calls = new CopyOnWriteArrayList<>();
        HttpServer old = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        old.createContext("/jobs/runpod/legacy-job", exchange -> {
            calls.add(exchange.getRequestHeaders().getFirst("X-Internal-Api-Key"));
            byte[] body = "{\"status\":\"IN_PROGRESS\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
        });
        old.start();
        try {
            context().withPropertyValues(
                    "kride.fastapi.url=http://127.0.0.1:" + old.getAddress().getPort(),
                    "fastapi.internal-api-key=legacy-secret"
            ).run(ctx -> {
                assertThat(ctx).hasNotFailed();
                AnimationJob job = AnimationJob.builder().status("QUEUED").runpodJobId("legacy-job").build();
                when(ctx.getBean(AnimationJobRepository.class).save(any(AnimationJob.class)))
                        .thenAnswer(call -> call.getArgument(0));
                ctx.getBean(AnimationService.class).refreshAnimationJob(job);
                assertThat(job.getStatus()).isEqualTo("RUNNING");
            });
            assertThat(calls).containsExactly("legacy-secret");
        } finally {
            old.stop(0);
        }
    }
}
