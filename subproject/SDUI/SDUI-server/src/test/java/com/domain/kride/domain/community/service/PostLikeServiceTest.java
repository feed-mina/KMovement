package com.domain.kride.domain.community.service;

import com.domain.kride.domain.community.domain.*;
import com.domain.kride.domain.community.dto.LikeStatusResponse;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("PostLikeService 단위 테스트")
class PostLikeServiceTest {

    @Mock
    private PostLikeRepository likeRepository;
    @Mock
    private CommunityPostRepository postRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private PostLikeService likeService;

    private User testUser;
    private CommunityPost testPost;

    @BeforeEach
    void setUp() {
        testUser = User.builder().userSqno(1L).userId("testuser").build();
        testPost = CommunityPost.builder()
                .postId(100L).likeCount(5L).build();
    }

    @Test
    @DisplayName("좋아요 토글 — 좋아요 추가")
    void toggleLike_add() {
        when(postRepository.findById(100L)).thenReturn(Optional.of(testPost));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(likeRepository.findByPost_PostIdAndUser_UserSqno(100L, 1L))
                .thenReturn(Optional.empty());

        LikeStatusResponse response = likeService.toggleLike(100L, 1L);

        assertThat(response.isLiked()).isTrue();
        assertThat(response.getLikeCount()).isEqualTo(6L);
        verify(likeRepository, times(1)).save(any(PostLike.class));
    }

    @Test
    @DisplayName("좋아요 토글 — 좋아요 취소")
    void toggleLike_remove() {
        PostLike existingLike = PostLike.builder()
                .postLikeId(1L).post(testPost).user(testUser).build();
        when(postRepository.findById(100L)).thenReturn(Optional.of(testPost));
        when(userRepository.findById(1L)).thenReturn(Optional.of(testUser));
        when(likeRepository.findByPost_PostIdAndUser_UserSqno(100L, 1L))
                .thenReturn(Optional.of(existingLike));

        LikeStatusResponse response = likeService.toggleLike(100L, 1L);

        assertThat(response.isLiked()).isFalse();
        assertThat(response.getLikeCount()).isEqualTo(4L);
        verify(likeRepository, times(1)).delete(existingLike);
    }

    @Test
    @DisplayName("좋아요 상태 조회")
    void getLikeStatus_returnsCorrectStatus() {
        when(likeRepository.existsByPost_PostIdAndUser_UserSqno(100L, 1L)).thenReturn(true);
        when(likeRepository.countByPost_PostId(100L)).thenReturn(5L);

        LikeStatusResponse response = likeService.getLikeStatus(100L, 1L);

        assertThat(response.isLiked()).isTrue();
        assertThat(response.getLikeCount()).isEqualTo(5L);
    }
}
