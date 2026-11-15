package com.domain.kride.domain.leetcode.scheduler;

import com.domain.kride.domain.kakao.service.SlackNotificationService;
import com.domain.kride.domain.leetcode.domain.LeetcodeProblem;
import com.domain.kride.domain.leetcode.domain.LeetcodeProblemRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 매일 07:00 / 12:00 / 17:00 KST에 미발송 LeetCode 문제 1개씩 Slack으로 발송한다.
 * 전체 문제 발송 완료 후에는 로그만 출력하고 종료.
 */
@Component
@RequiredArgsConstructor
public class DailyLeetcodeScheduler {

    /** 이전 프로젝트(면접·공부·리트코드·작업자 위치) 자동 발송. 기본 꺼짐, kride.legacy.schedulers.enabled=true 로 다시 켠다. */
    @Value("${kride.legacy.schedulers.enabled:false}")
    private boolean legacySchedulersEnabled;

    private final LeetcodeProblemRepository problemRepo;
    private final SlackNotificationService slackService;
    private final Logger log = LoggerFactory.getLogger(DailyLeetcodeScheduler.class);

    @Scheduled(cron = "0 0 7 * * *", zone = "Asia/Seoul")
    public void sendMorningProblem() {
        if (!legacySchedulersEnabled) return;
        sendNextProblem();
    }

    @Scheduled(cron = "0 0 12 * * *", zone = "Asia/Seoul")
    public void sendNoonProblem() {
        if (!legacySchedulersEnabled) return;
        sendNextProblem();
    }

    @Scheduled(cron = "0 0 17 * * *", zone = "Asia/Seoul")
    public void sendEveningProblem() {
        if (!legacySchedulersEnabled) return;
        sendNextProblem();
    }

    public void sendNextProblem() {
        try {
            problemRepo.findFirstBySentDateIsNullOrderByDisplayOrderAsc()
                    .ifPresentOrElse(problem -> {
                        slackService.sendDailyLeetcode(problem);
                        problem.setSentDate(LocalDate.now(ZoneId.of("Asia/Seoul")));
                        problemRepo.save(problem);
                        log.info("LeetCode 문제 발송 완료. problemId={}, title={}",
                                problem.getId(), problem.getTitle());
                    }, () -> log.info("LeetCode 전체 문제 발송 완료"));
        } catch (Exception e) {
            log.error("LeetCode 문제 발송 실패", e);
        }
    }
}
