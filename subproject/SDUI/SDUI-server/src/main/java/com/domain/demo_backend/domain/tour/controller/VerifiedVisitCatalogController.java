package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.global.common.response.ApiResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/tour/recommendation-catalog")
public class VerifiedVisitCatalogController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<?> catalog(HttpServletResponse response) {
        response.setHeader("Cache-Control", "no-store");
        List<JsonNode> rows = jdbc.query("SELECT payload::text FROM verified_visit_catalog ORDER BY poi_sqno",
            (rs, n) -> {
                try { return mapper.readTree(rs.getString(1)); }
                catch (Exception ex) { throw new IllegalStateException("Invalid visit catalog", ex); }
            });
        return ApiResponse.success(rows);
    }
}
