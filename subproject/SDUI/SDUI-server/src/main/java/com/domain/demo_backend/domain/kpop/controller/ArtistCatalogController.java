package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.ArtistCatalogService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** Opt-in shapes preserve the existing unpaged and event-enriched artist contracts. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/kpop")
public class ArtistCatalogController {
    private final ArtistCatalogService catalog;

    @GetMapping(value = "/artists", params = "page")
    public ResponseEntity<ApiResponse<Map<String, Object>>> page(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "page") int page,
            @RequestParam(name = "pageSize", defaultValue = "8") int pageSize) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(catalog.page(q, page, pageSize)));
    }

    @GetMapping(value = "/artists/{ref}", params = "view=profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> profile(@PathVariable String ref) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(ApiResponse.success(catalog.profile(ref)));
    }
}
