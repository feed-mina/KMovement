package com.domain.kride.domain.google.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
public class GoogleCalendarService {

    private static final Logger log = LoggerFactory.getLogger(GoogleCalendarService.class);
    private static final String CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    private static final DateTimeFormatter RFC3339 = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

    private final GoogleOAuthService googleOAuthService;
    private final WebClient webClient;

    public GoogleCalendarService(GoogleOAuthService googleOAuthService,
                                 WebClient.Builder webClientBuilder) {
        this.googleOAuthService = googleOAuthService;
        this.webClient = webClientBuilder.build();
    }

    /**
     * goal_setting 저장 직후 호출 — 비동기, best-effort
     * @return Google Calendar event ID (실패 시 null)
     */
    public String createEvent(Long userSqno, LocalDateTime targetTime, String message) {
        try {
            String accessToken = googleOAuthService.getValidAccessToken(userSqno);
            ZonedDateTime start = targetTime.atZone(ZoneId.of("Asia/Seoul"));
            ZonedDateTime end = start.plusMinutes(30);

            String summary = "⏰ 목표 도착: " + start.format(DateTimeFormatter.ofPattern("HH:mm"));
            String description = (message != null && !message.isBlank()) ? "각오: " + message : "";

            Map<String, Object> body = Map.of(
                    "summary", summary,
                    "description", description,
                    "start", Map.of("dateTime", start.format(RFC3339), "timeZone", "Asia/Seoul"),
                    "end",   Map.of("dateTime", end.format(RFC3339),   "timeZone", "Asia/Seoul"),
                    "reminders", Map.of(
                            "useDefault", false,
                            "overrides", List.of(
                                    Map.of("method", "popup", "minutes", 180),
                                    Map.of("method", "popup", "minutes", 90),
                                    Map.of("method", "popup", "minutes", 30)
                            )
                    )
            );

            Map<?, ?> response = webClient.post()
                    .uri(CALENDAR_API)
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.containsKey("id")) {
                String eventId = (String) response.get("id");
                log.info("Google Calendar event created: {} for user {}", eventId, userSqno);
                return eventId;
            }
        } catch (Exception e) {
            log.warn("Google Calendar event creation failed for user {}: {}", userSqno, e.getMessage());
        }
        return null;
    }

    /**
     * 도착 결과 기록 후 이벤트 제목 업데이트
     * status: "success" | "safe" | "late" | "fail"
     */
    @Async("sseExecutor")
    public void updateEventResult(Long userSqno, String eventId, String status) {
        try {
            String accessToken = googleOAuthService.getValidAccessToken(userSqno);
            String prefix = (status.equals("success") || status.equals("safe")) ? "✅ [도착]" : "❌ [지각]";
            Map<String, Object> patch = Map.of("summary", prefix + " 목표 도착 완료");

            webClient.patch()
                    .uri(CALENDAR_API + "/" + eventId)
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Content-Type", "application/json")
                    .bodyValue(patch)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            log.info("Google Calendar event updated: {} status={} for user {}", eventId, status, userSqno);
        } catch (Exception e) {
            log.warn("Google Calendar event update failed for user {}: {}", userSqno, e.getMessage());
        }
    }
}
