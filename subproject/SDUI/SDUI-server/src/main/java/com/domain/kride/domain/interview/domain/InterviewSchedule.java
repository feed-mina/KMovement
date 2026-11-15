package com.domain.kride.domain.interview.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "interview_schedule")
@Getter
@Setter
public class InterviewSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_sqno", nullable = false)
    private Long userSqno;

    @Column(name = "interview_date", nullable = false)
    private LocalDate interviewDate;

    @Column(name = "company")
    private String company;

    @Column(name = "notif_sent_d1", nullable = false)
    private boolean notifSentD1 = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}
