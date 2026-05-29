package com.domain.demo_backend.domain.kakao.service;

import com.domain.demo_backend.domain.interview.domain.InterviewQuestion;
import com.domain.demo_backend.domain.interview.domain.InterviewSchedule;
import com.domain.demo_backend.domain.leetcode.domain.LeetcodeProblem;
import com.domain.demo_backend.domain.time.domain.GoalSetting;
import com.domain.demo_backend.domain.time.domain.GoalSettingRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * 슬랙 웹훅 발송 서비스 — Block Kit 포맷 사용.
 * slack.webhook-url 미설정 시 자동으로 skip (개발/테스트 환경 안전).
 */
@Service
@RequiredArgsConstructor
public class SlackNotificationService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private final Logger log = LoggerFactory.getLogger(SlackNotificationService.class);

    private final GoalSettingRepository goalSettingRepo;
    private final WebClient webClient = WebClient.create();

    @Value("${slack.webhook-url:}")
    private String webhookUrl;

    @Value("${slack.target-user-id:U0AM4840JFR}")
    private String targetUserId;

    /**
     * 약속 시간 전 슬랙 알림(Block Kit)을 발송한다.
     * 목표 시간 + 이번 주 도착 성공률 + 각오를 표시한다.
     */
    public void sendReminder(GoalSetting goal, int minutesBefore) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack-webhook URL 미설정, 알림 skip");
            return;
        }

        String timeLabel = switch (minutesBefore) {
            case 30  -> "30분";
            case 90  -> "1시간 30분";
            case 180 -> "3시간";
            default  -> minutesBefore + "분";
        };

        LocalDateTime weekStart = LocalDate.now(ZoneId.of("Asia/Seoul"))
                .with(DayOfWeek.MONDAY).atStartOfDay();
        long total   = goalSettingRepo.countWeeklyTotal(goal.getUserSqno(), weekStart);
        long success = goalSettingRepo.countWeeklySuccess(goal.getUserSqno(), weekStart);
        String rateText = total == 0 ? "기록 없음"
                : success + "/" + total + " (" + (success * 100 / total) + "%)";

        String targetTimeStr = goal.getTargetTime().format(TIME_FMT);

        List<Map<String, Object>> blocks = new ArrayList<>();
        blocks.add(Map.of(
                "type", "header",
                "text", Map.of("type", "plain_text", "text", "⏰ " + timeLabel + " 뒤 약속 리마인더")));
        blocks.add(Map.of(
                "type", "section",
                "text", Map.of("type", "mrkdwn", "text", "<@" + targetUserId + "> 님, 리마인더입니다!")));
        blocks.add(Map.of(
                "type", "section",
                "fields", List.of(
                        Map.of("type", "mrkdwn", "text", "*목표 시간*\n" + targetTimeStr),
                        Map.of("type", "mrkdwn", "text", "*이번 주 도착 성공률*\n" + rateText))));
        if (goal.getTodaysMessage() != null && !goal.getTodaysMessage().isBlank()) {
            blocks.add(Map.of(
                    "type", "context",
                    "elements", List.of(
                            Map.of("type", "mrkdwn", "text", "각오: " + goal.getTodaysMessage()))));
        }

        postBlocks(blocks, "goalId=" + goal.getId() + ", minutesBefore=" + minutesBefore);
    }

    /**
     * 오늘의 LeetCode 문제를 Slack Block Kit으로 발송한다.
     */
    public void sendDailyLeetcode(LeetcodeProblem problem) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack-webhook URL 미설정, LeetCode 알림 skip");
            return;
        }

        String emoji = switch (problem.getDifficulty()) {
            case "Easy"   -> "🟢";
            case "Medium" -> "🟡";
            case "Hard"   -> "🔴";
            default       -> "⚪";
        };
        String url = "https://leetcode.com/problems/" + problem.getSlug() + "/";

        List<Map<String, Object>> blocks = new ArrayList<>();
        blocks.add(Map.of(
                "type", "header",
                "text", Map.of("type", "plain_text", "text", "🧩 오늘의 LeetCode 문제")));
        blocks.add(Map.of(
                "type", "section",
                "text", Map.of("type", "mrkdwn", "text", "<@" + targetUserId + "> 님, 오늘의 문제가 도착했습니다!\n" +
                        "*" + problem.getTitle() + "*\n"
                        + emoji + " " + problem.getDifficulty() + " | " + problem.getCategory() + "\n"
                        + "<" + url + "|문제 풀러 가기>")));

        postBlocks(blocks, "problemId=" + problem.getId());
    }

    /**
     * 오늘의 면접 질문을 Slack Block Kit으로 발송한다.
     */
    public void sendDailyInterviewQuestion(InterviewQuestion question) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack-webhook URL 미설정, 면접 질문 알림 skip");
            return;
        }

        List<Map<String, Object>> blocks = new ArrayList<>();
        blocks.add(Map.of(
                "type", "header",
                "text", Map.of("type", "plain_text", "text", "🎯 오늘의 면접 질문")));
        blocks.add(Map.of(
                "type", "section",
                "text", Map.of("type", "mrkdwn", "text", "<@" + targetUserId + "> 님, 답변해 보세요!\n" +
                        "*[" + question.getCategory() + "]* " + question.getQuestion() + "\n"
                        + "<https://yerin.duckdns.org/view/INTERVIEW_PAGE|바로 연습하기>")));

        postBlocks(blocks, "questionId=" + question.getId());
    }

    /**
     * 면접 D-1 리마인더를 Slack Block Kit으로 발송한다.
     */
    public void sendInterviewReminder(InterviewSchedule schedule) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack-webhook URL 미설정, 면접 D-1 알림 skip");
            return;
        }

        String dateStr = schedule.getInterviewDate()
                .format(DateTimeFormatter.ofPattern("M월 d일 (E)", Locale.KOREAN));

        StringBuilder sectionText = new StringBuilder();
        sectionText.append("📅 날짜: ").append(dateStr).append("\n");
        if (schedule.getCompany() != null && !schedule.getCompany().isBlank()) {
            sectionText.append("🏢 회사: ").append(schedule.getCompany()).append("\n");
        }

        List<Map<String, Object>> blocks = new ArrayList<>();
        blocks.add(Map.of(
                "type", "header",
                "text", Map.of("type", "plain_text", "text", "📋 내일 면접이 있습니다! 파이팅!")));
        blocks.add(Map.of(
                "type", "section",
                "text", Map.of("type", "mrkdwn", "text", "<@" + targetUserId + "> 님, 잊지 마세요!\n" + sectionText.toString())));
        blocks.add(Map.of(
                "type", "context",
                "elements", List.of(
                        Map.of("type", "mrkdwn", "text",
                                "<https://yerin.duckdns.org/view/INTERVIEW_PAGE|면접 연습하기>"))));

        postBlocks(blocks, "scheduleId=" + schedule.getId());
    }

    /**
     * 운영 알림 (오류·가입·비용 임계 등) 텍스트 직접 발송.
     * 내부에서 예외를 모두 처리하므로 호출측에 예외를 전파하지 않는다.
     */
    public void sendAlert(String text) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack-webhook URL 미설정, 운영 알림 skip");
            return;
        }
        postText("<@" + targetUserId + "> " + text);
    }

    // ── private helpers ──────────────────────────────────────────────────────

    private void postBlocks(List<Map<String, Object>> blocks, String logContext) {
        try {
            webClient.post()
                    .uri(webhookUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("blocks", blocks))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("Slack-발송 성공. {}", logContext);
        } catch (Exception e) {
            log.error("Slack-발송 실패. {}", logContext, e);
        }
    }

    private void postText(String text) {
        try {
            webClient.post()
                    .uri(webhookUrl)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(Map.of("text", text))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
            log.info("Slack-운영 알림 발송 성공");
        } catch (Exception e) {
            log.error("Slack-운영 알림 발송 실패", e);
        }
    }
}
