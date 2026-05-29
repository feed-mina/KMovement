package com.domain.demo_backend.domain.community.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AnimationJobRepository extends JpaRepository<AnimationJob, Long> {

    Optional<AnimationJob> findTopByPostPostIdOrderByCreatedAtDesc(Long postId);
}
