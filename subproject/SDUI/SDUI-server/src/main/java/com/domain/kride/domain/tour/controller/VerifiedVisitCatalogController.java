package com.domain.kride.domain.tour.controller;

import com.domain.kride.domain.tour.service.VerifiedVisitCatalogService;
import com.domain.kride.global.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/tour/recommendation-catalog")
public class VerifiedVisitCatalogController {
    private final VerifiedVisitCatalogService catalogService;

    @GetMapping
    public ApiResponse<?> catalog(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        return ApiResponse.success(catalogService.catalog());
    }
}
