package com.domain.demo_backend.global.config;

import com.domain.demo_backend.global.common.util.StompHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final StompHandler stompHandler;

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 연결은 CORS와 같은 출처 목록에서만 받는다. ("*" 전체 허용은 2026-11-15 제거)
        // withSockJS()는 웹소켓을 지원하지 않는 브라우저를 위한 백업 옵션이다.
        registry.addEndpoint("/ws-stomp")
                .setAllowedOrigins(SecurityConfig.ALLOWED_ORIGINS.toArray(String[]::new))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // /sub 으로 시작하는 주소를 구독한 사람에게 메시지를 전달한다 (구독 경로)
        registry.enableSimpleBroker("/sub");
        // /pub 으로 시작하는 메시지는 @MessageMapping 메서드로 보낸다 (발행 경로)
        registry.setApplicationDestinationPrefixes("/pub");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // CONNECT 프레임의 JWT를 검사한다. 검사 전에는 어떤 메시지도 처리하지 않는다.
        registration.interceptors(stompHandler);
    }
}
