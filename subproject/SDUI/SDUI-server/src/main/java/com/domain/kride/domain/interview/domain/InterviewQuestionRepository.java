package com.domain.kride.domain.interview.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface InterviewQuestionRepository extends JpaRepository<InterviewQuestion, Long> {

    /**
     * 미발송 질문 중 랜덤 1개를 반환한다 (PostgreSQL RANDOM() 사용).
     */
    @Query(value = "SELECT * FROM interview_questions WHERE sent_date IS NULL ORDER BY RANDOM() LIMIT 1",
            nativeQuery = true)
    Optional<InterviewQuestion> findRandomUnsent();
}
