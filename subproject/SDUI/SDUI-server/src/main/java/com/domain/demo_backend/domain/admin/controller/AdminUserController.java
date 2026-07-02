package com.domain.demo_backend.domain.admin.controller;

import com.domain.demo_backend.domain.admin.dto.AdminUserResponse;
import com.domain.demo_backend.domain.admin.dto.AdminUsageStatsResponse;
import com.domain.demo_backend.domain.admin.dto.CommunityStatsResponse;
import com.domain.demo_backend.domain.admin.dto.UpdateUserRoleRequest;
import com.domain.demo_backend.domain.admin.service.AdminUserService;
import com.domain.demo_backend.domain.admin.service.AdminUsageStatsService;
import com.domain.demo_backend.domain.kakao.service.SlackNotificationService;
import com.domain.demo_backend.domain.leetcode.scheduler.DailyLeetcodeScheduler;
import com.domain.demo_backend.domain.study.scheduler.DailyStudyScheduler;
import com.github.pagehelper.PageInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminUserController {

    private static final Logger log = LoggerFactory.getLogger(AdminUserController.class);
    private final AdminUserService adminUserService;
    private final AdminUsageStatsService adminUsageStatsService;
    private final SlackNotificationService slackNotificationService;
    private final DailyLeetcodeScheduler dailyLeetcodeScheduler;
    private final DailyStudyScheduler dailyStudyScheduler;

    public AdminUserController(AdminUserService adminUserService,
                               AdminUsageStatsService adminUsageStatsService,
                               SlackNotificationService slackNotificationService,
                               DailyLeetcodeScheduler dailyLeetcodeScheduler,
                               DailyStudyScheduler dailyStudyScheduler) {
        this.adminUserService = adminUserService;
        this.adminUsageStatsService = adminUsageStatsService;
        this.slackNotificationService = slackNotificationService;
        this.dailyLeetcodeScheduler = dailyLeetcodeScheduler;
        this.dailyStudyScheduler = dailyStudyScheduler;
    }

    // 사용자 목록 조회 (keyword: userId/email 검색, role: 권한 필터)
    @GetMapping("/users")
    public ResponseEntity<?> getUserList(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        try {
            PageInfo<AdminUserResponse> result = adminUserService.getUserList(keyword, role, page, size);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("사용자 목록 조회 오류: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "사용자 목록 조회 중 오류가 발생했습니다."));
        }
    }

    // Slack 웹훅 연결 테스트 (ROLE_ADMIN 전용)
    @PostMapping("/slack/test")
    public ResponseEntity<?> testSlack(@RequestBody(required = false) Map<String, String> body) {
        String msg = (body != null && body.containsKey("message"))
                ? body.get("message") : "✅ Slack 웹훅 테스트 메시지 (AWS 배포 검증)";
        slackNotificationService.sendAlert(msg);
        return ResponseEntity.ok(Map.of("sent", true, "message", msg));
    }

    // LeetCode 일일 문제 즉시 발송 테스트 (ROLE_ADMIN 전용)
    @PostMapping("/slack/test/leetcode")
    public ResponseEntity<?> testLeetcode() {
        dailyLeetcodeScheduler.sendNextProblem();
        return ResponseEntity.ok(Map.of("sent", true));
    }

    // 정보처리기사 학습자료 즉시 발송 테스트 (ROLE_ADMIN 전용)
    @PostMapping("/slack/test/study")
    public ResponseEntity<?> testStudy() {
        dailyStudyScheduler.sendNextMaterial();
        return ResponseEntity.ok(Map.of("sent", true));
    }

    // 사용자 권한 변경 (최소 1명, 최대 5명)
    @PutMapping("/users/role")
    public ResponseEntity<?> updateUserRole(@RequestBody UpdateUserRoleRequest request) {
        try {
            adminUserService.updateUserRole(request.getUserIds(), request.getNewRole());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            log.error("권한 변경 오류: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "권한 변경 중 오류가 발생했습니다."));
        }
    }

    // 어드민 이용 통계 (K-Ride 경로 탐색 수, 인기 지역, 사용자 증가량 등)
    @GetMapping("/stats")
    public ResponseEntity<?> getUsageStats() {
        try {
            AdminUsageStatsResponse stats = adminUsageStatsService.getUsageStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("이용 통계 조회 오류: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "이용 통계 조회 중 오류가 발생했습니다."));
        }
    }

    // 커뮤니티 통계 (인기 게시글, 좋아요/팔로우 수, 주간 활동량 등)
    @GetMapping("/stats/community")
    public ResponseEntity<?> getCommunityStats() {
        try {
            CommunityStatsResponse stats = adminUsageStatsService.getCommunityStats();
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("커뮤니티 통계 조회 오류: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "커뮤니티 통계 조회 중 오류가 발생했습니다."));
        }
    }
}
