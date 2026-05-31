package com.domain.demo_backend.domain.notification.service;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.user.domain.User;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class FcmNotificationService {

    private final Logger log = LoggerFactory.getLogger(FcmNotificationService.class);

    public void sendAnimationComplete(User user, AnimationJob job) {
        String title = "🎬 영상 제작 완료!";
        String body = "요청하신 커뮤니티 영상 제작이 완료되었습니다. 지금 확인해 보세요!";
        String link = job.getResultUrl() != null ? job.getResultUrl() : "https://yerin.duckdns.org";
        sendPushNotification(user, title, body, link);
    }

    public void sendAnimationFailed(User user, AnimationJob job) {
        String title = "⚠️ 영상 제작 실패";
        String body = "요청하신 영상 제작에 실패했습니다. 다시 시도해 주세요.";
        sendPushNotification(user, title, body, "https://yerin.duckdns.org");
    }

    private void sendPushNotification(User user, String title, String body, String linkUrl) {
        String token = user.getFcmToken();
        if (token == null || token.isBlank()) {
            log.warn("FcmNotification - 유저의 FCM 토큰이 없습니다. userId={}", user.getUserId());
            return;
        }

        try {
            Notification notification = Notification.builder()
                    .setTitle(title)
                    .setBody(body)
                    .build();

            Message message = Message.builder()
                    .setToken(token)
                    .setNotification(notification)
                    .putData("click_action", linkUrl)
                    .build();

            String response = FirebaseMessaging.getInstance().send(message);
            log.info("FcmNotification - 발송 성공. userId={}, response={}", user.getUserId(), response);
        } catch (Exception e) {
            log.error("FcmNotification - 발송 실패. userId={}, errorMessage={}", user.getUserId(), e.getMessage());
        }
    }
}
