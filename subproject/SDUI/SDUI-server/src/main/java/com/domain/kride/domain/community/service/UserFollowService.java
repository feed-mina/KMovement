package com.domain.kride.domain.community.service;

import com.domain.kride.domain.community.domain.UserFollow;
import com.domain.kride.domain.community.domain.UserFollowRepository;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserFollowService {

    private final UserFollowRepository followRepository;
    private final UserRepository userRepository;

    @Transactional
    public Map<String, Object> toggleFollow(Long followerSqno, Long followeeSqno) {
        if (followerSqno.equals(followeeSqno)) {
            throw new IllegalArgumentException("자기 자신을 팔로우할 수 없습니다.");
        }

        User follower = userRepository.findById(followerSqno)
                .orElseThrow(() -> new IllegalArgumentException("팔로워를 찾을 수 없습니다."));
        User followee = userRepository.findById(followeeSqno)
                .orElseThrow(() -> new IllegalArgumentException("팔로우 대상을 찾을 수 없습니다."));

        Optional<UserFollow> existing = followRepository
                .findByFollower_UserSqnoAndFollowee_UserSqno(followerSqno, followeeSqno);

        boolean following;
        if (existing.isPresent()) {
            followRepository.delete(existing.get());
            following = false;
        } else {
            UserFollow follow = UserFollow.builder()
                    .follower(follower)
                    .followee(followee)
                    .build();
            followRepository.save(follow);
            following = true;
        }

        long followerCount = followRepository.countByFollowee_UserSqno(followeeSqno);

        return Map.of(
                "following", following,
                "followerCount", followerCount
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getFollowStatus(Long followerSqno, Long followeeSqno) {
        boolean following = followRepository
                .existsByFollower_UserSqnoAndFollowee_UserSqno(followerSqno, followeeSqno);
        long followerCount = followRepository.countByFollowee_UserSqno(followeeSqno);
        long followingCount = followRepository.countByFollower_UserSqno(followeeSqno);

        return Map.of(
                "following", following,
                "followerCount", followerCount,
                "followingCount", followingCount
        );
    }
}
