package com.domain.kride.domain.community.service;

import com.domain.kride.domain.community.domain.*;
import com.domain.kride.domain.community.dto.LikeStatusResponse;
import com.domain.kride.domain.user.domain.User;
import com.domain.kride.domain.user.domain.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class PostLikeService {

    private final PostLikeRepository likeRepository;
    private final CommunityPostRepository postRepository;
    private final UserRepository userRepository;

    @Transactional
    public LikeStatusResponse toggleLike(Long postId, Long userSqno) {
        CommunityPost post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        User user = userRepository.findById(userSqno)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));

        Optional<PostLike> existing = likeRepository.findByPost_PostIdAndUser_UserSqno(postId, userSqno);

        boolean liked;
        if (existing.isPresent()) {
            likeRepository.delete(existing.get());
            post.setLikeCount(Math.max(0, post.getLikeCount() - 1));
            liked = false;
        } else {
            PostLike like = PostLike.builder()
                    .post(post)
                    .user(user)
                    .build();
            likeRepository.save(like);
            post.setLikeCount(post.getLikeCount() + 1);
            liked = true;
        }

        return LikeStatusResponse.builder()
                .liked(liked)
                .likeCount(post.getLikeCount())
                .build();
    }

    @Transactional(readOnly = true)
    public LikeStatusResponse getLikeStatus(Long postId, Long userSqno) {
        boolean liked = likeRepository.existsByPost_PostIdAndUser_UserSqno(postId, userSqno);
        long count = likeRepository.countByPost_PostId(postId);
        return LikeStatusResponse.builder()
                .liked(liked)
                .likeCount(count)
                .build();
    }
}
