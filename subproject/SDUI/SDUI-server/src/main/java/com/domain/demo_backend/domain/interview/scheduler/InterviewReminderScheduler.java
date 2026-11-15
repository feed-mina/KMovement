package com.domain.demo_backend.domain.interview.scheduler;

import com.domain.demo_backend.domain.interview.domain.InterviewSchedule;
import com.domain.demo_backend.domain.interview.domain.InterviewScheduleRepository;
import com.domain.demo_backend.domain.kakao.service.SlackNotificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * 매일 09:00 KST 에 '내일' 면접이 있는 일정을 조회하여 Slack D-1 리마인더를 발송한다.
 */
@Component
@RequiredArgsConstructor
public class InterviewReminderScheduler {

    /** 이전 프로젝트(면접·공부·리트코드·작업자 위치) 자동 발송. 기본 꺼짐, kride.legacy.schedulers.enabled=true 로 다시 켠다. */
    @Value("${kride.legacy.schedulers.enabled:false}")
    private boolean legacySchedulersEnabled;

    private final InterviewScheduleRepository scheduleRepo;
    private final SlackNotificationService slackService;
    private final Logger log = LoggerFactory.getLogger(InterviewReminderScheduler.class);

    @Scheduled(cron = "0 0 9 * * *", zone = "Asia/Seoul")
    public void sendD1Reminders() {
        if (!legacySchedulersEnabled) return;
        LocalDate tomorrow = LocalDate.now(ZoneId.of("Asia/Seoul")).plusDays(1);
        List<InterviewSchedule> pending =
                scheduleRepo.findAllByInterviewDateAndNotifSentD1False(tomorrow);

        if (pending.isEmpty()) {
            log.debug("면접 D-1 리마인더: 내일({}) 면접 일정 없음", tomorrow);
            return;
        }

        for (InterviewSchedule schedule : pending) {
            try {
                slackService.sendInterviewReminder(schedule);
                schedule.setNotifSentD1(true);
                scheduleRepo.save(schedule);
                log.info("면접 D-1 리마인더 발송 완료. scheduleId={}, date={}, company={}",
                        schedule.getId(), schedule.getInterviewDate(), schedule.getCompany());
            } catch (Exception e) {
                log.error("면접 D-1 리마인더 발송 실패. scheduleId={}", schedule.getId(), e);
            }
        }
    }
}
