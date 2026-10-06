package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.PublicProductCatalogService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/kpop")
public class PublicProductCatalogController {
    private final PublicProductCatalogService products;
    // Opt-in projection preserves the existing analysis/saved-item consumers unchanged.
    @GetMapping(value="/product-candidates",params="view=public")
    public ResponseEntity<ApiResponse<List<Map<String,Object>>>> search(
            @RequestParam(name="q",required=false) String q,
            @RequestParam(name="artistId",required=false) Long artistId,
            @RequestParam(name="eventId",required=false) Long eventId,
            @RequestParam(name="limit",required=false) Integer limit) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Candidate-Policy","public-evidence-v1")
                .body(ApiResponse.success(products.search(q,artistId,eventId,limit)));
    }
    @GetMapping("/product-candidates/{id}")
    public ResponseEntity<ApiResponse<java.util.Map<String,Object>>> detail(@PathVariable("id") Long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Candidate-Policy","public-evidence-v1").body(ApiResponse.success(products.detail(id)));
    }
}
