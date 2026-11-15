package com.domain.kride.domain.ui.controller;

import com.domain.kride.domain.ui.dto.UiResponseDto;
import com.domain.kride.domain.ui.service.UiService;
import com.domain.kride.global.common.ApiResponse;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@RestController
@RequestMapping("/api/ui")
public class UiController {
    private static final Logger log = LoggerFactory.getLogger(UiController.class);

    private final UiService uiService;

    /*
     * @@@@ 2026-02-08 추가
     * ui컨트롤러 리팩토링 > ui서비스로직 적용
     * */
    public UiController(UiService uiService) {
        this.uiService = uiService;
    }

    @GetMapping("/{screenId}")
    public ApiResponse<List<UiResponseDto>> getUiMetadataList(
        @PathVariable String screenId,
        @AuthenticationPrincipal UserDetails userDetails
    ) {
        // RBAC: JWT에서 사용자 역할 추출 (2026-03-01 추가)
        String userRole = (userDetails != null)
            ? extractRole(userDetails)
            : "ROLE_GUEST";

        // 서비스에서 역할 기반 필터링된 트리 구조 데이터를 받아서 응답
        log.debug("UiController 시작!");
        log.debug("screenId: {}, userRole: {}", screenId, userRole);
        List<UiResponseDto> treeList = uiService.getUiTree(screenId, userRole);

        log.debug("treeList: {}", treeList);
        return ApiResponse.success(treeList);
    }

    /**
     * UserDetails에서 첫 번째 권한(역할)을 추출
     * @param userDetails Spring Security의 인증된 사용자 정보
     * @return 역할 문자열 (예: "ROLE_USER")
     */
    private String extractRole(UserDetails userDetails) {
        return userDetails.getAuthorities().stream()
            .findFirst()
            .map(GrantedAuthority::getAuthority)
            .orElse("ROLE_GUEST");
    }

}
