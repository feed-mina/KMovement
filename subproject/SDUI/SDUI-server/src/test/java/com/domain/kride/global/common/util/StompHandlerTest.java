package com.domain.kride.global.common.util;

import com.domain.kride.global.security.JwtUtil;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** STOMP 연결은 유효한 JWT가 있어야 하고, 세션에는 토큰의 사용자 번호가 들어간다(고정값 사용 금지). */
class StompHandlerTest {

    private final JwtUtil jwtUtil = mock(JwtUtil.class);
    private final StompHandler handler = new StompHandler(jwtUtil);

    @Test
    void connectWithValidTokenStoresTokenUser() {
        Claims claims = mock(Claims.class);
        when(claims.get("userSqno")).thenReturn(77);
        when(jwtUtil.validateToken("good")).thenReturn(claims);
        Map<String, Object> session = new HashMap<>();

        handler.preSend(connect("Bearer good", session), null);

        assertThat(session).containsEntry(StompHandler.USER_SQNO_ATTRIBUTE, "77");
    }

    @Test
    void connectWithoutTokenIsRejected() {
        assertThatThrownBy(() -> handler.preSend(connect(null, new HashMap<>()), null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    @Test
    void connectWithInvalidTokenIsRejected() {
        when(jwtUtil.validateToken("bad")).thenThrow(new JwtException("bad"));
        assertThatThrownBy(() -> handler.preSend(connect("Bearer bad", new HashMap<>()), null))
                .isInstanceOf(MessageDeliveryException.class);
    }

    private static Message<byte[]> connect(String authorization, Map<String, Object> session) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        if (authorization != null) accessor.addNativeHeader("Authorization", authorization);
        accessor.setSessionAttributes(session);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
