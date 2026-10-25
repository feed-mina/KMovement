package com.domain.demo_backend.domain.tour.controller;

import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;

/** ADMIN-only explicit review. No source URL, legacy label or approval flag auto-verifies a relation. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/tour/artist-evidence")
public class ArtistEvidenceReviewController {
    private final JdbcTemplate jdbc;
    @ModelAttribute
    void noStore(HttpServletResponse response) { response.setHeader("Cache-Control", "private, no-store"); }
    public record Identity(Long contentId, Long artistId, String basis) {}
    public record Evidence(Long contentId, Long artistId, Long poiId, String action, String sourceUrl,
        String artistEvidence, String placeEvidence, String actionEvidence, String locator, OffsetDateTime reviewBy) {}
    public record VisitPolicy(Long poiId, JsonNode weekly, JsonNode dateOverrides, String hoursSourceUrl,
        Integer costKrw, String costSourceUrl, String costEvidence, OffsetDateTime reviewBy) {}
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public java.util.Map<String,String> invalidReference() {
        return java.util.Map.of("code","invalid_reference","message","Check the explicit content, artist and place IDs.");
    }
    static void require(boolean condition) {
        if (!condition) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Incomplete review evidence");
    }
    static void text(String value) { require(value != null && !value.isBlank() && value.length() <= 10000); }
    static void id(Long value) { require(value != null && value > 0); }
    static void url(String value) {
        try {
            URI uri = URI.create(value);
            require("https".equals(uri.getScheme()) && uri.getHost() != null && uri.getUserInfo() == null);
        } catch (IllegalArgumentException | NullPointerException ex) { require(false); }
    }
    static void expiry(OffsetDateTime value) {
        require(value != null && value.isAfter(OffsetDateTime.now()));
    }
    static String reviewer(CustomUserDetails principal) {
        if (principal == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return "user:" + principal.getUserSqno();
    }
    static void intervals(JsonNode value) {
        require(value != null && value.isArray());
        value.forEach(i -> {
            require(i.isArray() && i.size() == 2 && i.get(0).isIntegralNumber() && i.get(1).isIntegralNumber());
            require(i.get(0).canConvertToInt() && i.get(1).canConvertToInt()
                && 0 <= i.get(0).intValue() && i.get(0).intValue() < i.get(1).intValue() && i.get(1).intValue() <= 1440);
        });
    }
    @PostMapping("/identity")
    @Transactional
    public ApiResponse<?> identity(@RequestBody Identity r, @AuthenticationPrincipal CustomUserDetails user) {
        String actor = reviewer(user); id(r.contentId()); id(r.artistId()); text(r.basis());
        jdbc.update("INSERT INTO holy_content_artist(content_sqno,artist_id,identity_basis) VALUES (?,?,?) ON CONFLICT DO NOTHING",
            r.contentId(),r.artistId(),actor + ": " + r.basis());
        return ApiResponse.success("identity linked");
    }
    @PostMapping
    @Transactional
    public ApiResponse<?> evidence(@RequestBody Evidence r, @AuthenticationPrincipal CustomUserDetails user) {
        String actor=reviewer(user); id(r.contentId()); id(r.artistId()); id(r.poiId());
        require(r.action()!=null && Set.of("MV","CONTENT_VISIT","SNS","POPUP","ALBUM_PHOTO","COLLABORATION_EVENT").contains(r.action()));
        url(r.sourceUrl()); text(r.artistEvidence()); text(r.placeEvidence()); text(r.actionEvidence()); text(r.locator()); expiry(r.reviewBy());
        // A reviewed tuple must explicitly exist; no member/group expansion is performed.
        jdbc.update("INSERT INTO holy_content_poi(content_sqno,poi_sqno,relationship) VALUES (?,?,?) ON CONFLICT DO NOTHING",
            r.contentId(),r.poiId(),r.action());
        Long evidenceId=jdbc.queryForObject("""
            INSERT INTO artist_place_evidence(content_sqno,artist_id,poi_sqno,poi_name_snapshot,poi_address_snapshot,poi_lat_snapshot,poi_lon_snapshot,action,source_url,artist_evidence,
              place_evidence,action_evidence,locator,status,verified_at,review_by,reviewer)
            SELECT ?,?,p.poi_sqno,p.title,p.addr,p.map_y,p.map_x,?,?,?,?,?,?,'VERIFIED',now(),?,? FROM tour_poi p WHERE p.poi_sqno=? RETURNING evidence_id
            """,Long.class,r.contentId(),r.artistId(),r.action(),r.sourceUrl(),r.artistEvidence(),
            r.placeEvidence(),r.actionEvidence(),r.locator(),r.reviewBy(),actor,r.poiId());
        return ApiResponse.success(evidenceId);
    }
    @PostMapping("/visit-policy")
    @Transactional
    public ApiResponse<?> visitPolicy(@RequestBody VisitPolicy r, @AuthenticationPrincipal CustomUserDetails user) {
        String actor=reviewer(user);id(r.poiId()); url(r.hoursSourceUrl());url(r.costSourceUrl());text(r.costEvidence());expiry(r.reviewBy());
        require(r.costKrw()!=null && r.costKrw()>=0 && r.costKrw()<=100000000);
        require(r.weekly()!=null && r.weekly().isObject() && r.weekly().size()==7);
        for (int day=0;day<7;day++) intervals(r.weekly().get(String.valueOf(day)));
        require(r.dateOverrides()!=null && r.dateOverrides().isObject());
        r.dateOverrides().fields().forEachRemaining(e -> {
            try { LocalDate.parse(e.getKey()); } catch (Exception ex) { require(false); }
            intervals(e.getValue());
        });
        int changed=jdbc.update("""
            INSERT INTO poi_visit_policy(poi_sqno,poi_name_snapshot,poi_address_snapshot,poi_lat_snapshot,poi_lon_snapshot,weekly_hours,date_overrides,hours_source_url,cost_krw,cost_source_url,
             cost_evidence,status,verified_at,review_by,reviewer)
            SELECT p.poi_sqno,p.title,p.addr,p.map_y,p.map_x,?::jsonb,?::jsonb,?,?,?,?,'VERIFIED',now(),?,? FROM tour_poi p WHERE p.poi_sqno=?
            ON CONFLICT(poi_sqno) DO UPDATE SET poi_name_snapshot=EXCLUDED.poi_name_snapshot,poi_address_snapshot=EXCLUDED.poi_address_snapshot,
             poi_lat_snapshot=EXCLUDED.poi_lat_snapshot,poi_lon_snapshot=EXCLUDED.poi_lon_snapshot,weekly_hours=EXCLUDED.weekly_hours,date_overrides=EXCLUDED.date_overrides,
             hours_source_url=EXCLUDED.hours_source_url,cost_krw=EXCLUDED.cost_krw,cost_source_url=EXCLUDED.cost_source_url,
             cost_evidence=EXCLUDED.cost_evidence,status='VERIFIED',verified_at=now(),review_by=EXCLUDED.review_by,reviewer=EXCLUDED.reviewer
            """,r.weekly().toString(),r.dateOverrides().toString(),r.hoursSourceUrl(),r.costKrw(),r.costSourceUrl(),
            r.costEvidence(),r.reviewBy(),actor,r.poiId());
        if(changed!=1) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Place not found");
        return ApiResponse.success("visit policy reviewed");
    }
    @PostMapping("/{evidenceId}/revoke")
    @Transactional
    public ApiResponse<?> revoke(@PathVariable Long evidenceId, @AuthenticationPrincipal CustomUserDetails user) {
        String actor=reviewer(user); id(evidenceId);
        jdbc.update("UPDATE artist_place_evidence SET status='REVOKED',revoked_by=?,revoked_at=now() WHERE evidence_id=?",actor,evidenceId);
        return ApiResponse.success("revoked");
    }
    @PostMapping("/visit-policy/{poiId}/revoke")
    @Transactional
    public ApiResponse<?> revokePolicy(@PathVariable Long poiId, @AuthenticationPrincipal CustomUserDetails user) {
        String actor=reviewer(user);id(poiId);
        jdbc.update("UPDATE poi_visit_policy SET status='REVOKED',revoked_by=?,revoked_at=now() WHERE poi_sqno=?",actor,poiId);
        return ApiResponse.success("revoked");
    }
}
