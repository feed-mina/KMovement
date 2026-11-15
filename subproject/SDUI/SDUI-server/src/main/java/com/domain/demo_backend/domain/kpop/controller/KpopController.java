package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.dto.ArtistFollowStateDto;
import com.domain.demo_backend.domain.kpop.dto.EventBookmarkStateDto;
import com.domain.demo_backend.domain.kpop.dto.KpopArtistDetailDto;
import com.domain.demo_backend.domain.kpop.dto.KpopArtistDto;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.domain.kpop.service.KpopArtistService;
import com.domain.demo_backend.domain.kpop.service.KpopCacheService;
import com.domain.demo_backend.domain.kpop.service.KpopProductService;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.time.LocalDate;
import org.springframework.http.CacheControl;
import com.domain.demo_backend.domain.kpop.service.EventCatalogService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executor;

@RestController
@RequestMapping("/api/v1/kpop")
public class KpopController {

    private final KpopArtistService artistService;
    private final KpopAnalysisService analysisService;
    private final KpopProductService productService;
    private final KpopCacheService cacheService;
    private final Executor sseExecutor;
    private final EventCatalogService eventCatalog;

    @Autowired
    public KpopController(
            KpopArtistService artistService,
            KpopAnalysisService analysisService,
            KpopProductService productService,
            @Qualifier("sseExecutor") Executor sseExecutor,
            KpopCacheService cacheService,
            EventCatalogService eventCatalog
    ) {
        this.artistService = artistService;
        this.analysisService = analysisService;
        this.productService = productService;
        this.sseExecutor = sseExecutor;
        this.cacheService = cacheService;
        this.eventCatalog = eventCatalog;
    }

    @GetMapping("/artists")
    public ResponseEntity<ApiResponse<List<KpopArtistDto>>> artists(
            @RequestParam(name = "q", required = false) String q
    ) {
        return ResponseEntity.ok(ApiResponse.success(artistService.artists(q)));
    }

    @GetMapping("/artists/{artistId}")
    public ResponseEntity<ApiResponse<KpopArtistDetailDto>> artist(@PathVariable String artistId) {
        return ResponseEntity.ok(ApiResponse.success(artistService.artist(artistId)));
    }

    @GetMapping("/events")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> events(
            @RequestParam(name = "region", required = false) String region,
            @RequestParam(name = "from", required = false) String from,
            @RequestParam(name = "to", required = false) String to,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        LocalDate today = eventCatalog.today();
        return eventResponse(today, eventCatalog.events(region, from, to, user == null ? null : user.getUserSqno(), today));
    }

    @GetMapping("/events/{eventId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> event(@PathVariable Long eventId) {
        LocalDate today = eventCatalog.today();
        return eventResponse(today, eventCatalog.event(eventId, today));
    }

    private <T> ResponseEntity<ApiResponse<T>> eventResponse(LocalDate today, T data) {
        // V103 keeps its array response. One server-derived day is used for filters and badges.
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Kpop-Today", today.toString()).header("X-Kpop-Time-Zone", EventCatalogService.ZONE.getId())
                .body(ApiResponse.success(data));
    }

    @PostMapping("/artists/{artistId}/follow")
    public ResponseEntity<ApiResponse<ArtistFollowStateDto>> followArtist(
            @PathVariable Long artistId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        artistService.follow(artistId, user.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(new ArtistFollowStateDto(artistId, true)));
    }

    @DeleteMapping("/artists/{artistId}/follow")
    public ResponseEntity<ApiResponse<ArtistFollowStateDto>> unfollowArtist(
            @PathVariable Long artistId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        artistService.unfollow(artistId, user.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(new ArtistFollowStateDto(artistId, false)));
    }

    @PostMapping("/events/{eventId}/bookmark")
    public ResponseEntity<ApiResponse<EventBookmarkStateDto>> bookmarkEvent(
            @PathVariable Long eventId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        artistService.bookmark(eventId, user.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(new EventBookmarkStateDto(eventId, true)));
    }

    @DeleteMapping("/events/{eventId}/bookmark")
    public ResponseEntity<ApiResponse<EventBookmarkStateDto>> unbookmarkEvent(
            @PathVariable Long eventId,
            @AuthenticationPrincipal CustomUserDetails user
    ) {
        requireUser(user);
        artistService.unbookmark(eventId, user.getUserSqno());
        return ResponseEntity.ok(ApiResponse.success(new EventBookmarkStateDto(eventId, false)));
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
        Map<String, Object> keyParts = new LinkedHashMap<>();
        keyParts.put("q", blankToNull(q));
        keyParts.put("artistId", artistId);
        keyParts.put("eventId", eventId);
        keyParts.put("limit", limit);
        return ResponseEntity.ok(ApiResponse.success(cachedCatalog(
                "product_candidates", keyParts, Duration.ofMinutes(3),
                new TypeReference<List<Map<String, Object>>>() {},
                () -> productService.productCandidates(q, artistId, eventId, limit))));
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

    private void requireUser(CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
    }

    private Object blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private <T> T cachedCatalog(
            String resource,
            Map<String, ?> keyParts,
            Duration ttl,
            TypeReference<T> type,
            java.util.function.Supplier<T> loader) {
        return cacheService == null
                ? loader.get()
                : cacheService.catalog(resource, keyParts, ttl, type, loader);
    }
}
