package com.domain.kride.domain.tour.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;

/** Request bodies for the ADMIN artist-place evidence review API. */
public final class ArtistEvidenceReviewRequest {

    private ArtistEvidenceReviewRequest() {
    }

    public record Identity(Long contentId, Long artistId, String basis) {}

    public record Evidence(Long contentId, Long artistId, Long poiId, String action, String sourceUrl,
                           String artistEvidence, String placeEvidence, String actionEvidence, String locator,
                           OffsetDateTime reviewBy) {}

    public record VisitPolicy(Long poiId, JsonNode weekly, JsonNode dateOverrides, String hoursSourceUrl,
                              Integer costKrw, String costSourceUrl, String costEvidence, OffsetDateTime reviewBy) {}
}
