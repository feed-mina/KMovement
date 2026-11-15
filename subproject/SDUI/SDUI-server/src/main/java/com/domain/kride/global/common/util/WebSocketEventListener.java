package com.domain.kride.global.common.util;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Component
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());

        // 1. 세션에서 user_sq_no 가져오기
        String userSqNo = (String) headerAccessor.getSessionAttributes().get("userSqNo");

        if (userSqNo != null) {
            // 2. Redis에서 해당 유저의 실시간 위치 정보 삭제 또는 '오프라인' 표시
            // redisTemplate.delete("location:" + userSqNo);

            // 3. 관리자에게 해당 아주머니가 오프라인이 되었음을 알림
            messagingTemplate.convertAndSend("/sub/admin/status", userSqNo + " OFFLINE");
        }
    }
}