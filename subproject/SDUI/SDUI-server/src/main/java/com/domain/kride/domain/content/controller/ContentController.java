package com.domain.kride.domain.content.controller;

import com.domain.kride.domain.content.domain.Content;
import com.domain.kride.domain.content.dto.ContentRequest;
import com.domain.kride.domain.content.dto.ContentResponse;
import com.domain.kride.domain.content.service.ContentService;
import com.domain.kride.domain.user.service.KakaoService;
import com.domain.kride.global.security.CustomUserDetails;
import com.domain.kride.global.security.JwtUtil;
import com.github.pagehelper.PageInfo;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/content")
public class ContentController {
    private static final Logger log = LoggerFactory.getLogger(ContentController.class);
    private final ContentService contentService;

    private final KakaoService kakaoService;
    private final JwtUtil jwtUtil;

    @Autowired
    public ContentController(ContentService contentService, KakaoService kakaoService, JwtUtil jwtUtil) {
        this.contentService = contentService;
        this.kakaoService = kakaoService;
        this.jwtUtil = jwtUtil;
    }

    @GetMapping("/viewContentItem/{contentId}")
    @ResponseBody
    public ResponseEntity<?> viewContentItem(@PathVariable("contentId") Long contentId, @AuthenticationPrincipal CustomUserDetails userDetails, HttpServletRequest request, Authentication authentication) {
//        String userId = userIds != null && !userIds.isEmpty() ? userIds.get(0) : null;

        log.debug("viewContentItem contentId: {}", contentId);
        log.debug("viewContentItem request: {}", request);

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }
        ContentRequest contentReq = new ContentRequest();
        // userId랑 contentId랑 contentReq로 받는다
        contentReq.setContentId(contentId);
        contentReq.setUserId(userDetails.getUserId());
        try {
            log.debug("viewContentItem 서비스 로직 진입");
            Optional<Content> contentItem = contentService.viewContentItem(contentReq, authentication);
            log.debug("viewContentItem 결과: {}", contentItem);
            return ResponseEntity.ok(Map.of("contentItem", contentItem));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }

    }

    @PostMapping("/addContentList")
    @ResponseBody
    public ResponseEntity<?> addContentList(
            HttpServletRequest request,
            HttpServletResponse response,
            @RequestBody ContentRequest contentRequest, Authentication authentication
    ) {
        // 1) 헤더에서 IP 가져오기
        String ip = request.getHeader("X-Forwarded-For");
        log.debug("addContentList request: {}", request);
        log.debug("X-Forwarded-For: {}", request.getHeader("X-Forwarded-For"));
        // 2) 없으면 request.getRemoteAddr() 사용
        if (ip == null || ip.isEmpty()) {
            ip = request.getRemoteAddr();
        }
        log.debug("클라이언트 IP: {}", ip);
        log.debug("contentRequest: {}", contentRequest);

        try {
            contentService.addContent(contentRequest, ip, SecurityContextHolder.getContext().getAuthentication());

            return ResponseEntity.ok().body(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            log.warn("Invalid request: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("유효하지 않은 요청입니다");
        } catch (Exception e) {
            log.error("서버 오류: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("서버에서 오류가 발생했습니다.");
        }

    }

    // 보안컨텍스트 SecurityContextHolder에 담긴 검증된 유저 정보를 사용
    @GetMapping("/member-diaries")
    public ResponseEntity<?> getMemberDiaries(@RequestParam(value = "pageNo", defaultValue = "1") int pageNo, @RequestParam(value = "pageSize", defaultValue = "5") int pageSize) {
        // 현재 인증된 유저 정보 가져오기
        log.debug("콘텐츠 불러오기 시작");
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        try {
            PageInfo<ContentResponse> contentList = contentService.selectMemberContentList(authentication, pageNo, pageSize);
            return ResponseEntity.ok(contentList);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

}