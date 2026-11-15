package com.domain.kride.domain.interview.service;

import com.domain.kride.domain.interview.domain.InterviewSchedule;
import com.domain.kride.domain.interview.domain.InterviewScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class InterviewScheduleService {

    private final InterviewScheduleRepository scheduleRepo;

    @Transactional
    public InterviewSchedule create(Long userSqno, LocalDate interviewDate, String company) {
        InterviewSchedule schedule = new InterviewSchedule();
        schedule.setUserSqno(userSqno);
        schedule.setInterviewDate(interviewDate);
        schedule.setCompany(company);
        return scheduleRepo.save(schedule);
    }

    public List<InterviewSchedule> findByUser(Long userSqno) {
        return scheduleRepo.findAllByUserSqnoOrderByInterviewDateAsc(userSqno);
    }

    @Transactional
    public void delete(Long id, Long userSqno) {
        scheduleRepo.findById(id).ifPresent(schedule -> {
            if (schedule.getUserSqno().equals(userSqno)) {
                scheduleRepo.delete(schedule);
            }
        });
    }
}
