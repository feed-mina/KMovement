package com.domain.kride.domain.tour.service;

import com.domain.kride.domain.tour.domain.ArtistEvidenceJdbcRepository;
import com.domain.kride.domain.tour.dto.ArtistEvidenceReviewRequest.Evidence;
import com.domain.kride.domain.tour.dto.ArtistEvidenceReviewRequest.Identity;
import com.domain.kride.domain.tour.dto.ArtistEvidenceReviewRequest.VisitPolicy;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Set;

/** ADMIN-only explicit review rules. No source URL, legacy label or approval flag auto-verifies a relation. */
@Service
@RequiredArgsConstructor
public class ArtistEvidenceReviewService {

    private static final Set<String> ACTIONS =
        Set.of("MV", "CONTENT_VISIT", "SNS", "POPUP", "ALBUM_PHOTO", "COLLABORATION_EVENT");

    private final ArtistEvidenceJdbcRepository repository;

    @Transactional
    public void linkIdentity(Identity r, String actor) {
        id(r.contentId()); id(r.artistId()); text(r.basis());
        repository.linkIdentity(r.contentId(), r.artistId(), actor + ": " + r.basis());
    }

    @Transactional
    public Long verifyEvidence(Evidence r, String actor) {
        id(r.contentId()); id(r.artistId()); id(r.poiId());
        require(r.action() != null && ACTIONS.contains(r.action()));
        url(r.sourceUrl()); text(r.artistEvidence()); text(r.placeEvidence()); text(r.actionEvidence()); text(r.locator()); expiry(r.reviewBy());
        // A reviewed tuple must explicitly exist; no member/group expansion is performed.
        repository.linkContentPoi(r.contentId(), r.poiId(), r.action());
        return repository.insertVerifiedEvidence(r, actor);
    }

    @Transactional
    public void verifyVisitPolicy(VisitPolicy r, String actor) {
        id(r.poiId()); url(r.hoursSourceUrl()); url(r.costSourceUrl()); text(r.costEvidence()); expiry(r.reviewBy());
        require(r.costKrw() != null && r.costKrw() >= 0 && r.costKrw() <= 100000000);
        require(r.weekly() != null && r.weekly().isObject() && r.weekly().size() == 7);
        for (int day = 0; day < 7; day++) intervals(r.weekly().get(String.valueOf(day)));
        require(r.dateOverrides() != null && r.dateOverrides().isObject());
        r.dateOverrides().fields().forEachRemaining(e -> {
            try { LocalDate.parse(e.getKey()); } catch (Exception ex) { require(false); }
            intervals(e.getValue());
        });
        if (repository.upsertVerifiedVisitPolicy(r, actor) != 1) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Place not found");
        }
    }

    @Transactional
    public void revokeEvidence(Long evidenceId, String actor) {
        id(evidenceId);
        repository.revokeEvidence(evidenceId, actor);
    }

    @Transactional
    public void revokeVisitPolicy(Long poiId, String actor) {
        id(poiId);
        repository.revokeVisitPolicy(poiId, actor);
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
    static void intervals(JsonNode value) {
        require(value != null && value.isArray());
        value.forEach(i -> {
            require(i.isArray() && i.size() == 2 && i.get(0).isIntegralNumber() && i.get(1).isIntegralNumber());
            require(i.get(0).canConvertToInt() && i.get(1).canConvertToInt()
                && 0 <= i.get(0).intValue() && i.get(0).intValue() < i.get(1).intValue() && i.get(1).intValue() <= 1440);
        });
    }
}
