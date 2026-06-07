package com.domain.demo_backend.domain.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PostImageRepository extends JpaRepository<PostImage, Long> {

    List<PostImage> findByPost_PostIdOrderBySortOrder(Long postId);

    Optional<PostImage> findByPostImageIdAndPost_PostId(Long postImageId, Long postId);

    void deleteByPost_PostId(Long postId);
}
