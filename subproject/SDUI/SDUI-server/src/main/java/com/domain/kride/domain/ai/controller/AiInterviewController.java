package com.domain.kride.domain.ai.controller;

import com.domain.kride.domain.ai.dto.InterviewAnswerRequest;
import com.domain.kride.domain.ai.dto.InterviewStartRequest;
import com.domain.kride.domain.ai.service.InterviewService;
import com.domain.kride.domain.ai.service.S3Service;
import com.domain.kride.global.common.response.ApiResponse;
import com.domain.kride.global.security.CustomUserDetails;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.concurrent.Executor;

@Slf4j
@RestController
@RequestMapping("/api/ai/interview")
public class AiInterviewController {

    private final InterviewService interviewService;
    private final S3Service s3Service;
    private final Executor sseExecutor;

    public AiInterviewController(InterviewService interviewService,
                                  S3Service s3Service,
                                  @Qualifier("sseExecutor") Executor sseExecutor) {
        this.interviewService = interviewService;
        this.s3Service = s3Service;
        this.sseExecutor = sseExecutor;
    }

    /**
     * POST /api/ai/interview/resume/upload
     * 이력서 파일(이미지/PDF) → S3 업로드 → fileKey + fileType 반환
     * 최대 5MB, 지원 형식: jpg/png/webp/pdf
     */
    @PostMapping("/resume/upload")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadResume(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal CustomUserDetails userDetails) throws Exception {

        Long userSqnoForPath = (userDetails != null) ? userDetails.getUserSqno() : 0L;
        String userIdStr = (userDetails != null) ? String.valueOf(userDetails.getUserSqno()) : "GUEST";

        log.info("게시판 파일 업로드 요청 - userId={}, fileName={}, size={}B",
                userIdStr, file.getOriginalFilename(), file.getSize());

        String fileKey = s3Service.uploadResumeFile(file, userSqnoForPath);
        String fileType = s3Service.detectFileType(fileKey);

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "fileKey", fileKey,
                "fileType", fileType
        )));
    }


    /**
     * GET /api/ai/interview/resume/view
     * fileKey에 해당하는 S3 Presigned URL로 리다이렉트 (1시간 유효)
     */
    @GetMapping("/resume/view")
    public ResponseEntity<?> viewResumeFile(@RequestParam("fileKey") String fileKey) {
        try {
            String presignedUrl = s3Service.generatePresignedUrl(fileKey, 60);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", presignedUrl)
                    .build();
        } catch (Exception e) {
            log.error("파일 조회 실패: key={}", fileKey, e);
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("파일을 조회할 수 없습니다.");
        }
    }


    /**
     * POST /api/ai/interview/start
     * 이력서 기반 첫 면접 질문 SSE 스트리밍
     */
    @PostMapping("/start")
    public SseEmitter startInterview(
            @RequestBody InterviewStartRequest req,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("면접 시작 요청 - userId={}, language={}", userDetails.getUserSqno(), req.getLanguage());

        SseEmitter emitter = new SseEmitter(180_000L);
        sseExecutor.execute(() -> interviewService.startInterview(req, emitter));
        return emitter;
    }

    /**
     * POST /api/ai/interview/answer
     * 답변 제출 → 후속 면접 질문 SSE 스트리밍
     * 클라이언트가 대화 이력(history)을 유지해 전달
     */
    @PostMapping("/answer")
    public SseEmitter submitAnswer(
            @RequestBody InterviewAnswerRequest req,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        log.info("면접 답변 제출 - userId={}, historySize={}",
                userDetails.getUserSqno(),
                req.getHistory() != null ? req.getHistory().size() : 0);

        SseEmitter emitter = new SseEmitter(180_000L);
        sseExecutor.execute(() -> interviewService.continueInterview(req, emitter));
        return emitter;
    }
}
