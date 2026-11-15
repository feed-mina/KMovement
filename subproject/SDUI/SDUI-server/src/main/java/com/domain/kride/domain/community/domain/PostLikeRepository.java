package com.domain.kride.domain.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PostLikeRepository extends JpaRepository<PostLike, Long> {

    Optional<PostLike> findByPost_PostIdAndUser_UserSqno(Long postId, Long userSqno);

    boolean existsByPost_PostIdAndUser_UserSqno(Long postId, Long userSqno);

    long countByPost_PostId(Long postId);
}
