package com.domain.kride.domain.location.controller;

import com.domain.kride.domain.location.dto.LocationRequest;
import com.domain.kride.domain.location.service.LocationService;
import com.domain.kride.global.common.util.StompHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

import java.time.Duration;
import java.util.Map;

/**
 * 작업자 위치 수신(STOMP). 좌표·상태 저장은 LocationService 한 곳에서 하므로
 * 5분마다 DB로 옮기는 LocationScheduler와 같은 Redis 키(LocationKeys)를 쓴다.
 * 사용자 번호는 메시지 본문이 아니라 연결 때 JWT로 확인한 세션 값을 쓴다.
 */
// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Controller
@RequiredArgsConstructor
public class LocationController {

    private final LocationService locationService;
    private final StringRedisTemplate stringRedisTemplate;
    private final SimpMessageSendingOperations messagingTemplate;

    @MessageMapping("/location/update")
    public void updateLocation(LocationRequest message, SimpMessageHeaderAccessor headers) {
        message.setUserSqno(authenticatedUser(headers));
        locationService.updateWorkerLocation(message);
        // 관리자에게 실시간 위치 중계
        messagingTemplate.convertAndSend("/sub/admin/locations", message);
    }

    // SOS 도움 요청
    @MessageMapping("/location/emergency")
    public void handleEmergency(LocationRequest message, SimpMessageHeaderAccessor headers) {
        String userSqno = authenticatedUser(headers);
        message.setUserSqno(userSqno);
        locationService.processEmergency(userSqno);
        // 긴급 상태와 마지막 위치를 5분간 보관
        stringRedisTemplate.opsForValue().set("emergency:" + userSqno, String.valueOf(message), Duration.ofMinutes(5));
        messagingTemplate.convertAndSend("/sub/admin/emergency", message);
    }

    static String authenticatedUser(SimpMessageHeaderAccessor headers) {
        Map<String, Object> session = headers.getSessionAttributes();
        Object userSqno = session == null ? null : session.get(StompHandler.USER_SQNO_ATTRIBUTE);
        if (userSqno == null) {
            throw new MessageDeliveryException("STOMP session is not authenticated.");
        }
        return userSqno.toString();
    }
}
