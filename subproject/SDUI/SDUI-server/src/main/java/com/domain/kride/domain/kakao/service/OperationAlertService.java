package com.domain.kride.domain.kakao.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 운영 모니터링 Slack 알림 서비스.
 * - 신규 가입: sendNewUser()
 * - 5xx 서버 오류: sendError()
 * - OpenAI 일일 비용 임계 초과: sendCostAlert()
 */
@Service
@RequiredArgsConstructor
public class OperationAlertService {

    private final SlackNotificationService slackService;
    private final Logger log = LoggerFactory.getLogger(OperationAlertService.class);

    public void sendNewUser(String email, long totalCount) {
        slackService.sendAlert("🎉 새 사용자 가입: " + email + " (총 " + totalCount + "명)");
        log.info("신규 가입 알림 발송: email={}, totalCount={}", email, totalCount);
    }

    public void sendError(String exceptionType, String message, String path) {
        String text = "🔴 서버 오류: " + exceptionType + " @ " + path + "\n" + message;
        slackService.sendAlert(text);
        log.info("서버 오류 알림 발송: type={}, path={}", exceptionType, path);
    }

    public void sendCostAlert(double dailyCost, double threshold) {
        String text = String.format("💸 OpenAI 일일 비용 $%.2f 초과 (임계: $%.2f)", dailyCost, threshold);
        slackService.sendAlert(text);
        log.info("OpenAI 비용 임계 알림 발송: dailyCost=${}, threshold=${}", dailyCost, threshold);
    }
}
