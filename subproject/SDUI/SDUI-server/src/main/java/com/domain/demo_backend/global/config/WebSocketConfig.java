package com.domain.demo_backend.global.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 1. 클라이언트가 웹소켓에 처음 연결할 주소를 설정함
        // 2. setAllowedOriginPatterns("*")는 모든 도메인에서의 접속을 허용함 (실무에선 특정 도메인만 허용해야 함)
        // 3. withSockJS()는 웹소켓을 지원하지 않는 브라우저를 위한 백업 옵션임
        registry.addEndpoint("/ws-stomp")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // 1. /sub으로 시작하는 주소를 구독하는 사람들에게 메시지를 전달함 (구독 경로)
        registry.enableSimpleBroker("/sub");

        // 2. /pub으로 시작하는 메시지는 @MessageMapping 메서드로 보냄 (발행 경로)
        registry.setApplicationDestinationPrefixes("/pub");
    }
}