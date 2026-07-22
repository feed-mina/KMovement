package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.domain.kpop.service.KpopProductService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

@RestController
@RequestMapping("/api/v1/kpop")
public class KpopController {

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final KpopAnalysisService analysisService;
    private final KpopProductService productService;
    private final Executor sseExecutor;

    public KpopController(
            NamedParameterJdbcTemplate jdbcTemplate,
            KpopAnalysisService analysisService,
            KpopProductService productService,
            @Qualifier("sseExecutor") Executor sseExecutor
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.analysisService = analysisService;
        this.productService = productService;
        this.sseExecutor = sseExecutor;
    }

    @GetMapping("/artists")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> artists(
            @RequestParam(name = "q", required = false) String q
    ) {
        String sql = """
                SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn",
                       profile, image_url AS "imageUrl", official_url AS "officialUrl"
                FROM artist
                WHERE approved_yn = 'Y'
                  AND (:q IS NULL OR name_ko ILIKE CONCAT('%', :q, '%') OR name_en ILIKE CONCAT('%', :q, '%'))
                ORDER BY sort_order ASC, name_ko ASC
                """;
        return ResponseEntity.ok(ApiResponse.success(jdbcTemplate.queryForList(sql, params("q", blankToNull(q)))));
    }

    @GetMapping("/artists/{artistId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> artist(@PathVariable Long artistId) {
        Map<String, Object> artist = one("""
                SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn",
                       profile, image_url AS "imageUrl", official_url AS "officialUrl"
                FROM artist
                WHERE artist_id = :artistId AND approved_yn = 'Y'
                """, params("artistId", artistId));
        artist.put("events", jdbcTemplate.queryForList("""
                SELECT event_id AS id, artist_id AS "artistId", title_ko AS "titleKo", title_en AS "titleEn",
                       region, venue, event_date AS date, official_url AS "officialUrl"
                FROM event
                WHERE artist_id = :artistId AND approved_yn = 'Y'
                ORDER BY event_date ASC
                """, params("artistId", artistId)));
        return ResponseEntity.ok(ApiResponse.success(artist));
    }

    @GetMapping("/events")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> events(
            @RequestParam(name = "region", required = false) String region,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to
    ) {
        String sql = """
                SELECT e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo",
                       e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue,
                       e.event_date AS date, e.official_url AS "officialUrl"
                FROM event e
                JOIN artist a ON a.artist_id = e.artist_id
                WHERE e.approved_yn = 'Y'
                  AND (:region IS NULL OR e.region = :region)
                  AND (:fromDate IS NULL OR e.event_date >= CAST(:fromDate AS date))
                  AND (:toDate IS NULL OR e.event_date <= CAST(:toDate AS date))
                ORDER BY e.event_date ASC, e.event_id ASC
                """;
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("region", blankToNull(region))
                .addValue("fromDate", blankToNull(from))
                .addValue("toDate", blankToNull(to));
        return ResponseEntity.ok(ApiResponse.success(jdbcTemplate.queryForList(sql, p)));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> event(@PathVariable Long eventId) {
        return ResponseEntity.ok(ApiResponse.success(one("""
                SELECT e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo",
                       e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue,
                       e.event_date AS date, e.official_url AS "officialUrl", e.description
                FROM event e
                JOIN artist a ON a.artist_id = e.artist_id
                WHERE e.event_id = :eventId AND e.approved_yn = 'Y'
                """, params("eventId", eventId))));
    }

    @PostMapping("/artists/{artistId}/follow")
    public ResponseEntity<ApiResponse<Map<String, Object>>> followArtist(
            @PathVariable Long artistId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        upsert("artist_follow", "artist_id", artistId, user.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(Map.of("artistId", artistId, "followed", true)));
    }

    @DeleteMapping("/artists/{artistId}/follow")
    public ResponseEntity<ApiResponse<Map<String, Object>>> unfollowArtist(
            @PathVariable Long artistId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        jdbcTemplate.update("DELETE FROM artist_follow WHERE user_sqno = :userSqno AND artist_id = :id",
                params("userSqno", user.getUserSqno()).addValue("id", artistId));
        return ResponseEntity.ok(ApiResponse.success(Map.of("artistId", artistId, "followed", false)));
    }

    @PostMapping("/events/{eventId}/bookmark")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bookmarkEvent(
            @PathVariable Long eventId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        upsert("event_bookmark", "event_id", eventId, user.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(Map.of("eventId", eventId, "bookmarked", true)));
    }

    @PostMapping("/analysis-assets/presign")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createAnalysisUpload(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(
                analysisService.createUpload(payload, user.getUserSqno())
        ));
    }

    @PostMapping({"/analysis-jobs", "/analysis/jobs"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> createAnalysisJob(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(
                analysisService.submit(payload, user.getUserSqno())
        ));
    }

    @GetMapping({"/analysis-jobs/{jobId}", "/analysis/jobs/{jobId}"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> analysisJob(
            @PathVariable Long jobId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(
                analysisService.snapshot(jobId, user.getUserSqno(), true)
        ));
    }

    @GetMapping(
            value = {"/analysis-jobs/{jobId}/stream", "/analysis/jobs/{jobId}/stream"},
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter streamAnalysisJob(
            @PathVariable Long jobId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        Long userSqno = user.getUserSqno();
        analysisService.snapshot(jobId, userSqno, false);

        SseEmitter emitter = new SseEmitter(180_000L);
        sseExecutor.execute(() -> streamAnalysisSnapshots(jobId, userSqno, emitter));
        return emitter;
    }

    @GetMapping({"/analysis-jobs/{jobId}/source-download", "/analysis/jobs/{jobId}/source-download"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> analysisSourceDownload(
            @PathVariable Long jobId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(
                analysisService.createSourceDownload(jobId, user.getUserSqno())
        ));
    }

    @DeleteMapping({"/analysis-jobs/{jobId}/source", "/analysis/jobs/{jobId}/source"})
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteAnalysisSource(
            @PathVariable Long jobId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(
                analysisService.deleteSource(jobId, user.getUserSqno())
        ));
    }

    @GetMapping("/product-candidates")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> productCandidates(
            @RequestParam(name = "q", required = false) String q,
            @RequestParam(name = "artistId", required = false) Long artistId,
            @RequestParam(name = "eventId", required = false) Long eventId,
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                productService.productCandidates(q, artistId, eventId, limit)
        ));
    }

    @PostMapping("/saved-items")
    public ResponseEntity<ApiResponse<Map<String, Object>>> saveItem(
            @RequestBody Map<String, Object> payload,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(
                productService.saveItem(payload, user.getUserSqno())
        ));
    }

    @GetMapping("/saved-items")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> savedItems(
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(productService.savedItems(user.getUserSqno())));
    }

    @DeleteMapping("/saved-items/{savedItemId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteSavedItem(
            @PathVariable Long savedItemId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        return ResponseEntity.ok(ApiResponse.success(
                productService.deleteSavedItem(savedItemId, user.getUserSqno())
        ));
    }

    private void streamAnalysisSnapshots(Long jobId, Long userSqno, SseEmitter emitter) {
        try {
            while (true) {
                Map<String, Object> snapshot = analysisService.snapshot(jobId, userSqno, true);
                emitter.send(SseEmitter.event().name("status").data(snapshot));
                if (analysisService.isTerminal(snapshot)) {
                    emitter.send(SseEmitter.event().name("done").data("[DONE]"));
                    emitter.complete();
                    return;
                }
                Thread.sleep(1_000L);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            emitter.completeWithError(e);
        } catch (IOException | RuntimeException e) {
            emitter.completeWithError(e);
        }
    }

    private Map<String, Object> one(String sql, MapSqlParameterSource params) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, params);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "K-POP resource not found.");
        }
        return rows.get(0);
    }

    private void upsert(String table, String column, Long refId, Long userSqno) {
        try {
            jdbcTemplate.update("INSERT INTO " + table + " (user_sqno, " + column + ") VALUES (:userSqno, :id)",
                    params("userSqno", userSqno).addValue("id", refId));
        } catch (DuplicateKeyException ignored) {
        }
    }

    private void requireUser(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
    }

    private MapSqlParameterSource params(String name, Object value) {
        return new MapSqlParameterSource().addValue(name, value);
    }

    private Object blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
