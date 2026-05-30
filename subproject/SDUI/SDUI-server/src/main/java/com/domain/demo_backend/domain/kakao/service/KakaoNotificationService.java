package com.domain.demo_backend.domain.kakao.service;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.time.domain.GoalSetting;
import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.service.KakaoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@Service
public class KakaoNotificationService {

    private static final String KAKAO_SEND_URL = "https://kapi.kakao.com/v2/api/talk/memo/default/send";
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");

    private final KakaoService kakaoService;
    private final WebClient webClient;
    private final Logger log = LoggerFactory.getLogger(KakaoNotificationService.class);

    public KakaoNotificationService(KakaoService kakaoService, WebClient.Builder webClientBuilder) {
        this.kakaoService = kakaoService;
        this.webClient = webClientBuilder.build();
    }

    /**
     * 약속 시간 전 카카오톡 알림 메시지를 발송한다.
     *
     * @param user          카카오 로그인 유저 (kakaoAccessToken 보유)
     * @param goal          약속 GoalSetting 엔티티
     * @param minutesBefore 몇 분 전 알림인지 (30 / 90 / 180)
     */
    public void sendReminder(User user, GoalSetting goal, int minutesBefore) {
        // 1. 토큰 만료 확인 → 5분 여유 두고 미리 갱신
        String token = user.getKakaoAccessToken();
        if (user.getKakaoTokenExpiresAt() != null &&
                user.getKakaoTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            token = kakaoService.refreshKakaoToken(user);
        }

        if (token == null) {
            log.warn("KakaoNotification-토큰 없음. userId={}", user.getUserId());
            return;
        }

        // 2. 메시지 텍스트 구성
        String timeLabel = switch (minutesBefore) {
            case 30 -> "30분";
            case 90 -> "1시간 30분";
            case 180 -> "3시간";
            default -> minutesBefore + "분";
        };
        // targetTime은 saveGoalTime()에서 이미 KST로 변환된 값이므로 바로 포맷
        String targetTimeStr = goal.getTargetTime().format(TIME_FMT);
        String text = "⏰ " + timeLabel + " 뒤에 약속이 있습니다!\n목표 시간: " + targetTimeStr;
        if (goal.getTodaysMessage() != null && !goal.getTodaysMessage().isBlank()) {
            text += "\n각오: " + goal.getTodaysMessage();
        }

        // 3. 카카오 API 호출
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> messageMap = Map.of(
                    "object_type", "text",
                    "text", text,
                    "link", Map.of(
                            "web_url", "https://yerin.duckdns.org",
                            "mobile_web_url", "https://yerin.duckdns.org"));
            String templateObject = mapper.writeValueAsString(messageMap);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("template_object", templateObject);

            webClient.post()
                    .uri(KAKAO_SEND_URL)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(params)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("KakaoNotification-발송 성공. userId={}, minutesBefore={}",
                    user.getUserId(), minutesBefore);
        } catch (Exception e) {
            log.error("KakaoNotification-발송 실패. userId={}, minutesBefore={}", user.getUserId(), minutesBefore, e);
            throw new RuntimeException("카카오 알림 발송 실패", e);
        }
    }

    public void sendAnimationComplete(User user, AnimationJob job) {
        String text = "\uD83C\uDFAC 영상 제작이 완료되었습니다!\n결과 확인: " + job.getResultUrl();
        sendKakaoMessage(user, text, job.getResultUrl());
    }

    public void sendAnimationFailed(User user, AnimationJob job) {
        String text = "영상 제작이 실패했습니다. 다시 시도해주세요.";
        sendKakaoMessage(user, text, "https://yerin.duckdns.org");
    }

    private void sendKakaoMessage(User user, String text, String linkUrl) {
        String token = user.getKakaoAccessToken();
        if (user.getKakaoTokenExpiresAt() != null &&
                user.getKakaoTokenExpiresAt().isBefore(LocalDateTime.now().plusMinutes(5))) {
            token = kakaoService.refreshKakaoToken(user);
        }

        if (token == null) {
            log.warn("KakaoNotification-토큰 없음. userId={}", user.getUserId());
            return;
        }

        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> messageMap = Map.of(
                    "object_type", "text",
                    "text", text,
                    "link", Map.of(
                            "web_url", linkUrl != null ? linkUrl : "https://yerin.duckdns.org",
                            "mobile_web_url", linkUrl != null ? linkUrl : "https://yerin.duckdns.org"));
            String templateObject = mapper.writeValueAsString(messageMap);

            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("template_object", templateObject);

            webClient.post()
                    .uri(KAKAO_SEND_URL)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .bodyValue(params)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("KakaoNotification-발송 성공. userId={}, text={}", user.getUserId(), text.substring(0, Math.min(text.length(), 30)));
        } catch (Exception e) {
            log.error("KakaoNotification-발송 실패. userId={}", user.getUserId(), e);
        }
    }
}
