package com.domain.demo_backend.domain.notification.service;

import com.domain.demo_backend.domain.community.domain.AnimationJob;
import com.domain.demo_backend.domain.kakao.service.KakaoNotificationService;
import com.domain.demo_backend.domain.user.domain.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class UnifiedNotificationService {

    private final Logger log = LoggerFactory.getLogger(UnifiedNotificationService.class);
    
    private final KakaoNotificationService kakaoNotificationService;
    private final FcmNotificationService fcmNotificationService;

    public UnifiedNotificationService(KakaoNotificationService kakaoNotificationService, FcmNotificationService fcmNotificationService) {
        this.kakaoNotificationService = kakaoNotificationService;
        this.fcmNotificationService = fcmNotificationService;
    }

    /**
     * 영상 제작 성공 시, 카카오톡과 FCM 푸시 알림을 모두 발송합니다.
     */
    public void sendAnimationComplete(User user, AnimationJob job) {
        log.info("UnifiedNotification - 영상 완료 알림 발송 시작: userId={}", user.getUserId());
        
        // 1. 카카오톡 발송
        try {
            kakaoNotificationService.sendAnimationComplete(user, job);
        } catch (Exception e) {
            log.error("UnifiedNotification - 카카오 알림 발송 중 에러 발생: {}", e.getMessage());
        }

        // 2. FCM 발송
        try {
            fcmNotificationService.sendAnimationComplete(user, job);
        } catch (Exception e) {
            log.error("UnifiedNotification - FCM 알림 발송 중 에러 발생: {}", e.getMessage());
        }
    }

    /**
     * 영상 제작 실패 시, 카카오톡과 FCM 푸시 알림을 모두 발송합니다.
     */
    public void sendAnimationFailed(User user, AnimationJob job) {
        log.info("UnifiedNotification - 영상 실패 알림 발송 시작: userId={}", user.getUserId());
        
        // 1. 카카오톡 발송
        try {
            kakaoNotificationService.sendAnimationFailed(user, job);
        } catch (Exception e) {
            log.error("UnifiedNotification - 카카오 알림 발송 중 에러 발생: {}", e.getMessage());
        }

        // 2. FCM 발송
        try {
            fcmNotificationService.sendAnimationFailed(user, job);
        } catch (Exception e) {
            log.error("UnifiedNotification - FCM 알림 발송 중 에러 발생: {}", e.getMessage());
        }
    }
}
