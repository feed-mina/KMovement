package com.domain.demo_backend.domain.Location.service;

import com.domain.demo_backend.domain.Location.LocationKeys;
import com.domain.demo_backend.domain.Location.dto.LocationRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final String GEO_KEY = LocationKeys.GEO_KEY; // 모든 작업자의 위치를 담는 GEO 키
    private static final String INFO_PREFIX = LocationKeys.INFO_PREFIX; // 개별 상세 정보를 담는 Hash 키 접두사

    // 1. 위치 및 상태 업데이트 로직
    public void updateWorkerLocation(LocationRequest request) {
        String userSqNo = request.getUserSqno();
        Point location = new Point(request.getLng(), request.getLat());

        // Redis GEO에 좌표 저장: 특정 키에 사용자 번호와 좌표를 매핑함
        redisTemplate.opsForGeo().add(GEO_KEY, location, userSqNo);

        // Redis Hash에 상세 정보 저장: 상태와 업데이트 시간을 기록함
        String infoKey = INFO_PREFIX + userSqNo;
        Map<String, String> infoMap = new HashMap<>();
        infoMap.put("status", request.getStatus()); // NORMAL 혹은 HELP
        infoMap.put("lastUpdate", LocalDateTime.now().toString());

        redisTemplate.opsForHash().putAll(infoKey, infoMap);

        // 데이터 유효 시간 설정: 10분 동안 업데이트 없으면 자동 삭제 (메모리 관리)
        redisTemplate.expire(infoKey, Duration.ofMinutes(10));
    }

    // 2. 긴급 상황 발생 처리
    public void processEmergency(String userSqNo) {
        String infoKey = INFO_PREFIX + userSqNo;

        // 상태를 HELP로 즉시 변경함
        redisTemplate.opsForHash().put(infoKey, "status", "HELP");

        // 긴급 상황은 더 오래 유지되도록 유효 시간 연장 (예: 1시간)
        redisTemplate.expire(infoKey, Duration.ofHours(1));
    }

    // 3. 도움 종료 처리
    public void clearEmergency(String userSqNo) {
        String infoKey = INFO_PREFIX + userSqNo;

        // 상태를 NORMAL로 되돌림
        redisTemplate.opsForHash().put(infoKey, "status", "NORMAL");
    }
}