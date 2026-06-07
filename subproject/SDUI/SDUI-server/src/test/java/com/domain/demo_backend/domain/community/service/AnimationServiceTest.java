package com.domain.demo_backend.domain.community.service;

import com.domain.demo_backend.domain.community.domain.AnimationJobRepository;
import com.domain.demo_backend.domain.community.domain.CommunityPost;
import com.domain.demo_backend.domain.community.domain.CommunityPostRepository;
import com.domain.demo_backend.domain.community.domain.PostImageRepository;
import com.domain.demo_backend.domain.community.dto.AnimationCreateRequest;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.global.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    private AnimationCreateRequest request(Long postImageId) {
        AnimationCreateRequest request = new AnimationCreateRequest();
        request.setPostImageId(postImageId);
        request.setRoute("animated_drawings_worker");
        return request;
    }
}
