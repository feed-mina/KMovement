package com.domain.kride.global.common.util;

import com.domain.kride.domain.location.LocationKeys;
import lombok.RequiredArgsConstructor;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class LocationScheduler {

    /** 이전 프로젝트(면접·공부·리트코드·작업자 위치) 자동 발송. 기본 꺼짐, kride.legacy.schedulers.enabled=true 로 다시 켠다. */
    @Value("${kride.legacy.schedulers.enabled:false}")
    private boolean legacySchedulersEnabled;

    private final RedisTemplate<String, Object> redisTemplate;
    private final JdbcTemplate jdbcTemplate;
    private static final String GEO_KEY = LocationKeys.GEO_KEY;

    // 5분마다 실행 (300,000ms)
    @Scheduled(fixedDelay = 300000)
    public void transferLocationLogsToDb() {
        if (!legacySchedulersEnabled) return;
        // 1. Redis GEO에 저장된 모든 사용자의 현재 위치 가져오기
        // GEO key에 있는 모든 멤버를 조회합니다.
        Set<Object> members = redisTemplate.opsForZSet().range(GEO_KEY, 0, -1);

        if (members == null || members.isEmpty()) return;

        List<Object[]> batchArgs = new ArrayList<>();
        String sql = "INSERT INTO location_logs (user_sq_no, lat, lng, created_at) VALUES (?, ?, ?, ?)";

        for (Object member : members) {
            String userSqno = (String) member;
            // 각 멤버의 좌표 조회
            List<Point> points = redisTemplate.opsForGeo().position(GEO_KEY, userSqno);

            if (points != null && !points.isEmpty()) {
                Point point = points.get(0);
                batchArgs.add(new Object[]{
                        userSqno,
                        point.getY(), // Latitude
                        point.getX(), // Longitude
                        LocalDateTime.now()
                });
            }
        }

        // 2. JdbcTemplate을 이용한 Bulk Insert 실행
        if (!batchArgs.isEmpty()) {
            jdbcTemplate.batchUpdate(sql, batchArgs);
        }
    }
}
