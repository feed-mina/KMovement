package com.domain.kride.domain.interview.controller;

import com.domain.kride.domain.interview.domain.InterviewSchedule;
import com.domain.kride.domain.interview.service.InterviewScheduleService;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/interview-schedule")
@RequiredArgsConstructor
public class InterviewScheduleController {

    private static final Logger log = LoggerFactory.getLogger(InterviewScheduleController.class);
    private final InterviewScheduleService scheduleService;

    /** 면접 일정 등록 */
    @PostMapping
    public ResponseEntity<?> create(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody Map<String, String> body) {

        if (userDetails == null) return ResponseEntity.status(401).body("로그인이 필요합니다.");

        String dateStr = body.get("interviewDate");
        if (dateStr == null || dateStr.isBlank()) return ResponseEntity.badRequest().body("interviewDate 필수");

        LocalDate interviewDate = LocalDate.parse(dateStr);  // yyyy-MM-dd
        String company = body.get("company");
        InterviewSchedule saved = scheduleService.create(userDetails.getUserSqno(), interviewDate, company);
        log.info("면접 일정 등록. userId={}, date={}, company={}", userDetails.getUserSqno(), interviewDate, company);
        return ResponseEntity.ok(Map.of("id", saved.getId(), "interviewDate", saved.getInterviewDate().toString()));
    }

    /** 내 면접 일정 목록 */
    @GetMapping
    public ResponseEntity<List<InterviewSchedule>> list(@AuthenticationPrincipal CustomUserDetails userDetails) {
        if (userDetails == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(scheduleService.findByUser(userDetails.getUserSqno()));
    }

    /** 면접 일정 삭제 */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        if (userDetails == null) return ResponseEntity.status(401).build();
        scheduleService.delete(id, userDetails.getUserSqno());
        return ResponseEntity.noContent().build();
    }
}
