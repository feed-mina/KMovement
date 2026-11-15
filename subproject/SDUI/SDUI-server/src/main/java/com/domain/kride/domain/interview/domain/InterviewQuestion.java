package com.domain.kride.domain.interview.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "interview_questions")
@Getter
@Setter
public class InterviewQuestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "question", nullable = false)
    private String question;

    @Column(name = "category", nullable = false)
    private String category;  // 공통/경험역량/가치관/직무/상황대처/마무리

    @Column(name = "sent_date")
    private LocalDate sentDate;  // null = 미발송
}
