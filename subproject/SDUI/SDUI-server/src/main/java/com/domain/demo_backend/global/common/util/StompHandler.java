package com.domain.demo_backend.global.common.util;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Component
@RequiredArgsConstructor
public class StompHandler implements ChannelInterceptor {

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);

        if (StompCommand.CONNECT == accessor.getCommand()) {
            // 1. 헤더에서 JWT 토큰 추출
            String token = accessor.getFirstNativeHeader("Authorization");

            // 2. 토큰 검증 및 user_sq_no 추출 (기존 로직 활용)
            String userSqNo = validateAndGetUserSqNo(token);

            // 3. 세션 내부에 user_sq_no 저장 (나중에 끊겼을 때 누구인지 알기 위함)
            accessor.getSessionAttributes().put("userSqNo", userSqNo);
        }
        return message;
    }

    private String validateAndGetUserSqNo(String token) {
        // 기존 JWT 검증 로직을 여기에 구현
        return "12345";
    }
}