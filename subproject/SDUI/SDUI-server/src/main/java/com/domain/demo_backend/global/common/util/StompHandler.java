package com.domain.demo_backend.global.common.util;

import com.domain.demo_backend.global.security.JwtUtil;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * STOMP 연결 인증. CONNECT 프레임의 Authorization 헤더(Bearer JWT)를 검사하고,
 * 통과한 사용자 번호를 세션에 저장한다. 그 뒤 메시지는 세션의 사용자 번호만 믿는다.
 */
// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Component
@RequiredArgsConstructor
public class StompHandler implements ChannelInterceptor {

    public static final String USER_SQNO_ATTRIBUTE = "userSqNo";

    private final JwtUtil jwtUtil;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT != accessor.getCommand()) {
            return message;
        }
        String userSqNo = authenticate(accessor.getFirstNativeHeader("Authorization"));
        Map<String, Object> session = accessor.getSessionAttributes();
        if (session == null) {
            throw new MessageDeliveryException("STOMP session is not available.");
        }
        session.put(USER_SQNO_ATTRIBUTE, userSqNo);
        return message;
    }

    String authenticate(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new MessageDeliveryException("Authorization header is required.");
        }
        try {
            Claims claims = jwtUtil.validateToken(authorization.substring("Bearer ".length()).trim());
            Object userSqno = claims.get("userSqno");
            if (userSqno == null) {
                throw new MessageDeliveryException("Token has no user.");
            }
            return String.valueOf(userSqno);
        } catch (MessageDeliveryException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new MessageDeliveryException("Invalid token.");
        }
    }
}
