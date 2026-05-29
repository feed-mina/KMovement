package com.domain.demo_backend.domain.time.controller;


import com.domain.demo_backend.domain.time.domain.GoalArrivalRequest;
import com.domain.demo_backend.domain.time.service.GoalTimeQueryService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;


/*
 * @@@@ 2026-01-26 생성
 * 목표시간 controller / redis 사용
 *
 *  */
@RestController
@RequestMapping("/api/goalTime")
@RequiredArgsConstructor
public class GoalTimeController {
    private static final Logger log = LoggerFactory.getLogger(GoalTimeController.class);
    private final GoalTimeQueryService goalTimeQueryService;

    @GetMapping("/getGoalTime")
    public ResponseEntity<Map<String, String>> getGoalTime(@AuthenticationPrincipal CustomUserDetails userDetails) {
        Long userSqno = (userDetails != null) ? userDetails.getUserSqno() : null;
        String targetTime = goalTimeQueryService.getGoalTime(userSqno);
        log.debug("targetTime: {}", targetTime);
        Map<String, String> result = new HashMap<>();
        if (targetTime == null || targetTime.isEmpty()) {
            result.put("goalTime", null);
            return ResponseEntity.ok(result);
        }
        result.put("goalTime", targetTime);
        String memo = goalTimeQueryService.getGoalMemo(userSqno);
        if (memo != null && !memo.isBlank()) result.put("todaysMessage", memo);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/save")
    public ResponseEntity<String> saveGoalTime(@RequestBody Map<String, String> body, @AuthenticationPrincipal CustomUserDetails userDetails) {

        // 1. 로그인 체크
        if (userDetails == null) {
            return ResponseEntity.status(401).body("로그인이 필요합니다.");
        }
        Long userSqno = userDetails.getUserSqno();
        log.debug("userSqno: {}", userSqno);

        // 2. 프론트앤드에서 데이터 가져오기
        String targetTimeStr = body.get("targetTime");
        String message = body.get("messageInput");

        // 3. 날짜 변환 로직
        LocalDateTime finalTargetTime;
        try {
            // [시도 1] 프론트엔드 표준 (ISO 8601, T와 Z가 있는 경우)
            // 1. ZonedDateTime으로 파싱 (Z처리)
            // 2. withZoneSameInstant로 한국시간 (Asia/Seoul)로 변환 ( UTC -> KST)
            // 3. toLacalDateTime 으로 최종 변환
            finalTargetTime = ZonedDateTime.parse(targetTimeStr)
                    .withZoneSameInstant(ZoneId.of("Asia/Seoul"))
                    .toLocalDateTime();
        } catch (Exception e) {
            // [시도 2] 실패 시 공백으로 구분된 경우: "2026-01-31 07:52:00"
            // 문자열을 LocalDateTime 으로 변환 (형식이 '2026-01-30T22:00' 인 경우)
            if (targetTimeStr.length() <= 16) {
                targetTimeStr += ":00"; // 2026-01-30 10:00 -> 2026-01-30 10:00:00
            }
            DateTimeFormatter legacyFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
            finalTargetTime = LocalDateTime.parse(targetTimeStr, legacyFormatter);
        }

        // 4. 섭시스 로직 호출
        goalTimeQueryService.saveGoalTime(userSqno, finalTargetTime, message);
        return ResponseEntity.ok("저장완료");
    }


    // 리스트 목표 조회 (팝업용)
    @GetMapping("/getGoalList")
    public ResponseEntity<List<String>> getGoalList(@AuthenticationPrincipal CustomUserDetails userDetails) {
        Long userSqno = (userDetails != null) ? userDetails.getUserSqno() : null;
        List<String> goalList = goalTimeQueryService.getGoalList(userSqno);
        return ResponseEntity.ok(goalList);
    }

    @PostMapping("/arrival")
    public ResponseEntity<String> recordArrival(@AuthenticationPrincipal CustomUserDetails userDetails, @RequestBody GoalArrivalRequest requestBody) {
        Long userSqno = (userDetails != null) ? userDetails.getUserSqno() : null;
        if (userSqno == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }
        String status = requestBody.getStatus();
        LocalDateTime recordedTime = requestBody.getRecordedTime();

        goalTimeQueryService.updateGoalResult(userSqno, status, recordedTime);
        return ResponseEntity.ok("저장완료");
    }
}
