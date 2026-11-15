package com.domain.kride.domain.interview.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface InterviewScheduleRepository extends JpaRepository<InterviewSchedule, Long> {

    /**
     * 특정 날짜에 면접이 있고 D-1 알림 미발송인 일정 조회.
     * InterviewReminderScheduler 에서 tomorrow 로 조회.
     */
    List<InterviewSchedule> findAllByInterviewDateAndNotifSentD1False(LocalDate interviewDate);

    /** 사용자별 본인 일정 목록 (날짜 오름차순) */
    List<InterviewSchedule> findAllByUserSqnoOrderByInterviewDateAsc(Long userSqno);
}
