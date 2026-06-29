package com.domain.demo_backend.domain.admin.controller;

import com.domain.demo_backend.domain.admin.dto.SduiQueryMasterResponse;
import com.domain.demo_backend.domain.admin.dto.SduiScreenDetailResponse;
import com.domain.demo_backend.domain.admin.dto.SduiScreenSummaryResponse;
import com.domain.demo_backend.domain.admin.dto.SduiThemeSummaryResponse;
import com.domain.demo_backend.domain.admin.service.SduiAdminService;
import com.domain.demo_backend.global.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/sdui")
public class SduiAdminController {

    private final SduiAdminService sduiAdminService;

    public SduiAdminController(SduiAdminService sduiAdminService) {
        this.sduiAdminService = sduiAdminService;
    }

    @GetMapping("/screens")
    public ApiResponse<List<SduiScreenSummaryResponse>> listScreens() {
        return ApiResponse.success(sduiAdminService.listScreens());
    }

    @GetMapping("/screens/{screenId}")
    public ApiResponse<SduiScreenDetailResponse> getScreen(@PathVariable String screenId) {
        return ApiResponse.success(sduiAdminService.getScreen(screenId));
    }

    @GetMapping("/themes")
    public ApiResponse<List<SduiThemeSummaryResponse>> listThemes() {
        return ApiResponse.success(sduiAdminService.listThemes());
    }

    @GetMapping("/query-master")
    public ApiResponse<List<SduiQueryMasterResponse>> listQueryMasters() {
        return ApiResponse.success(sduiAdminService.listQueryMasters());
    }
}
