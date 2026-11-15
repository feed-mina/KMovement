package com.domain.kride.domain.community.service;

import com.domain.kride.domain.community.domain.UserFollow;
import com.domain.kride.domain.community.domain.UserFollowRepository;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserFollowService 단위 테스트")
class UserFollowServiceTest {

    @Mock
    private UserFollowRepository followRepository;
    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserFollowService followService;

    private User follower;
    private User followee;

    @BeforeEach
    void setUp() {
        follower = User.builder().userSqno(1L).userId("follower").build();
        followee = User.builder().userSqno(2L).userId("followee").build();
    }

    @Test
    @DisplayName("팔로우 토글 — 팔로우 추가")
    void toggleFollow_add() {
        when(userRepository.findById(1L)).thenReturn(Optional.of(follower));
        when(userRepository.findById(2L)).thenReturn(Optional.of(followee));
        when(followRepository.findByFollower_UserSqnoAndFollowee_UserSqno(1L, 2L))
                .thenReturn(Optional.empty());
        when(followRepository.countByFollowee_UserSqno(2L)).thenReturn(1L);

        Map<String, Object> result = followService.toggleFollow(1L, 2L);

        assertThat(result.get("following")).isEqualTo(true);
        assertThat(result.get("followerCount")).isEqualTo(1L);
        verify(followRepository, times(1)).save(any(UserFollow.class));
    }

    @Test
    @DisplayName("팔로우 토글 — 언팔로우")
    void toggleFollow_remove() {
        UserFollow existingFollow = UserFollow.builder()
                .followId(1L).follower(follower).followee(followee).build();
        when(userRepository.findById(1L)).thenReturn(Optional.of(follower));
        when(userRepository.findById(2L)).thenReturn(Optional.of(followee));
        when(followRepository.findByFollower_UserSqnoAndFollowee_UserSqno(1L, 2L))
                .thenReturn(Optional.of(existingFollow));
        when(followRepository.countByFollowee_UserSqno(2L)).thenReturn(0L);

        Map<String, Object> result = followService.toggleFollow(1L, 2L);

        assertThat(result.get("following")).isEqualTo(false);
        verify(followRepository, times(1)).delete(existingFollow);
    }

    @Test
    @DisplayName("자기 자신 팔로우 — 예외")
    void toggleFollow_self_throwsException() {
        assertThatThrownBy(() -> followService.toggleFollow(1L, 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("자기 자신을 팔로우할 수 없습니다.");
    }

    @Test
    @DisplayName("팔로우 상태 조회")
    void getFollowStatus_returnsCorrectData() {
        when(followRepository.existsByFollower_UserSqnoAndFollowee_UserSqno(1L, 2L)).thenReturn(true);
        when(followRepository.countByFollowee_UserSqno(2L)).thenReturn(10L);
        when(followRepository.countByFollower_UserSqno(2L)).thenReturn(5L);

        Map<String, Object> result = followService.getFollowStatus(1L, 2L);

        assertThat(result.get("following")).isEqualTo(true);
        assertThat(result.get("followerCount")).isEqualTo(10L);
        assertThat(result.get("followingCount")).isEqualTo(5L);
    }
}
