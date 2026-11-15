package com.domain.demo_backend.domain.Location.controller;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import com.domain.demo_backend.domain.Location.dto.LocationRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.stereotype.Controller;

import java.time.Duration;

// 이전 프로젝트(작업자 위치)용 STOMP 설정. 기본 꺼짐, kride.legacy.websocket.enabled=true 로 다시 켠다.
@ConditionalOnProperty(name = "kride.legacy.websocket.enabled", havingValue = "true")
@Controller
@RequiredArgsConstructor
public class LocationController {

    @Autowired
    private final StringRedisTemplate stringRedisTemplate;
    private final SimpMessageSendingOperations messagingTemplate;

    @MessageMapping("/location/update")
    public void updateLocation(LocationRequest message) {
        // Redis GEO에 좌표 업데이트
        stringRedisTemplate.opsForGeo().add("active_workers", new Point(message.getLng(), message.getLat()), message.getUserSqno());
        // 1. userSqno와 위도, 경도가 담긴 메시지를 받음
        // 2. 이 메시지를 특정 식당 관리자들이 구독 중인 채널로 바로 쏴줌
        // 3. 관리자에게 실시간 위치 중계 /sub/admin/locations} 형태로 경로를 동적으로 구성할 수 있음
        messagingTemplate.convertAndSend("/sub/admin/locations", message);
    }

    // 2. SOS 도움 요청
    @MessageMapping("/location/emergency")
    public void handleEmergency(LocationRequest message) {

        // Redis Hash에 상태를 'HELP'로 변경
        stringRedisTemplate.opsForHash().put("worker:info:" + message.getUserSqno(), "status", "HELP");

        // 1. Redis에 아주머니의 긴급 상태와 마지막 위치를 5분간 저장 (만료 시간 설정으로 메모리 관리)
        String redisKey = "emergency:" + message.getUserSqno();
        stringRedisTemplate.opsForValue().set(redisKey, String.valueOf(message), Duration.ofMinutes(5));

        // 2. 모든 관리자가 구독 중인 공통 긴급 채널로 메시지 전송
        messagingTemplate.convertAndSend("/sub/admin/emergency", message);
    }
}