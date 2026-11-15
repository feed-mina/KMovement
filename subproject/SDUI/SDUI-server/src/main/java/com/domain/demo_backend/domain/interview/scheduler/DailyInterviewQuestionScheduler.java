package com.domain.demo_backend.domain.interview.scheduler;

import com.domain.demo_backend.domain.interview.domain.InterviewQuestion;
import com.domain.demo_backend.domain.interview.domain.InterviewQuestionRepository;
import com.domain.demo_backend.domain.kakao.service.SlackNotificationService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 매일 09:10 KST에 미발송 면접 질문 1개를 랜덤으로 선택하여 Slack으로 발송한다.
 * 전체 30문제 발송 완료 후에는 로그만 출력하고 종료.
 */
@Component
@RequiredArgsConstructor
public class DailyInterviewQuestionScheduler {

    /** 이전 프로젝트(면접·공부·리트코드·작업자 위치) 자동 발송. 기본 꺼짐, kride.legacy.schedulers.enabled=true 로 다시 켠다. */
    @Value("${kride.legacy.schedulers.enabled:false}")
    private boolean legacySchedulersEnabled;

    private final InterviewQuestionRepository questionRepo;
    private final SlackNotificationService slackService;
    private final Logger log = LoggerFactory.getLogger(DailyInterviewQuestionScheduler.class);

    @Scheduled(cron = "0 10 9 * * *", zone = "Asia/Seoul")
    public void sendDailyQuestion() {
        if (!legacySchedulersEnabled) return;
        try {
            questionRepo.findRandomUnsent()
                    .ifPresentOrElse(question -> {
                        slackService.sendDailyInterviewQuestion(question);
                        question.setSentDate(LocalDate.now(ZoneId.of("Asia/Seoul")));
                        questionRepo.save(question);
                        log.info("면접 질문 일일 발송 완료. questionId={}, category={}",
                                question.getId(), question.getCategory());
                    }, () -> log.info("면접 질문 전체 발송 완료 (30/30)"));
        } catch (Exception e) {
            log.error("면접 질문 일일 발송 실패", e);
        }
    }
}
