package com.domain.demo_backend.domain.tour.domain;

import com.domain.demo_backend.domain.tour.dto.ArtistEvidenceReviewRequest.Evidence;
import com.domain.demo_backend.domain.tour.dto.ArtistEvidenceReviewRequest.VisitPolicy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL for the ADMIN artist-place evidence review. Moved out of ArtistEvidenceReviewController unchanged. */
@Repository
public class ArtistEvidenceJdbcRepository {

    private final JdbcTemplate jdbc;

    public ArtistEvidenceJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void linkIdentity(Long contentId, Long artistId, String identityBasis) {
        jdbc.update("INSERT INTO holy_content_artist(content_sqno,artist_id,identity_basis) VALUES (?,?,?) ON CONFLICT DO NOTHING",
            contentId, artistId, identityBasis);
    }

    public void linkContentPoi(Long contentId, Long poiId, String relationship) {
        jdbc.update("INSERT INTO holy_content_poi(content_sqno,poi_sqno,relationship) VALUES (?,?,?) ON CONFLICT DO NOTHING",
            contentId, poiId, relationship);
    }

    public Long insertVerifiedEvidence(Evidence r, String actor) {
        return jdbc.queryForObject("""
            INSERT INTO artist_place_evidence(content_sqno,artist_id,poi_sqno,poi_name_snapshot,poi_address_snapshot,poi_lat_snapshot,poi_lon_snapshot,action,source_url,artist_evidence,
              place_evidence,action_evidence,locator,status,verified_at,review_by,reviewer)
            SELECT ?,?,p.poi_sqno,p.title,p.addr,p.map_y,p.map_x,?,?,?,?,?,?,'VERIFIED',now(),?,? FROM tour_poi p WHERE p.poi_sqno=? RETURNING evidence_id
            """, Long.class, r.contentId(), r.artistId(), r.action(), r.sourceUrl(), r.artistEvidence(),
            r.placeEvidence(), r.actionEvidence(), r.locator(), r.reviewBy(), actor, r.poiId());
    }

    public int upsertVerifiedVisitPolicy(VisitPolicy r, String actor) {
        return jdbc.update("""
            INSERT INTO poi_visit_policy(poi_sqno,poi_name_snapshot,poi_address_snapshot,poi_lat_snapshot,poi_lon_snapshot,weekly_hours,date_overrides,hours_source_url,cost_krw,cost_source_url,
             cost_evidence,status,verified_at,review_by,reviewer)
            SELECT p.poi_sqno,p.title,p.addr,p.map_y,p.map_x,?::jsonb,?::jsonb,?,?,?,?,'VERIFIED',now(),?,? FROM tour_poi p WHERE p.poi_sqno=?
            ON CONFLICT(poi_sqno) DO UPDATE SET poi_name_snapshot=EXCLUDED.poi_name_snapshot,poi_address_snapshot=EXCLUDED.poi_address_snapshot,
             poi_lat_snapshot=EXCLUDED.poi_lat_snapshot,poi_lon_snapshot=EXCLUDED.poi_lon_snapshot,weekly_hours=EXCLUDED.weekly_hours,date_overrides=EXCLUDED.date_overrides,
             hours_source_url=EXCLUDED.hours_source_url,cost_krw=EXCLUDED.cost_krw,cost_source_url=EXCLUDED.cost_source_url,
             cost_evidence=EXCLUDED.cost_evidence,status='VERIFIED',verified_at=now(),review_by=EXCLUDED.review_by,reviewer=EXCLUDED.reviewer
            """, r.weekly().toString(), r.dateOverrides().toString(), r.hoursSourceUrl(), r.costKrw(), r.costSourceUrl(),
            r.costEvidence(), r.reviewBy(), actor, r.poiId());
    }

    public void revokeEvidence(Long evidenceId, String actor) {
        jdbc.update("UPDATE artist_place_evidence SET status='REVOKED',revoked_by=?,revoked_at=now() WHERE evidence_id=?", actor, evidenceId);
    }

    public void revokeVisitPolicy(Long poiId, String actor) {
        jdbc.update("UPDATE poi_visit_policy SET status='REVOKED',revoked_by=?,revoked_at=now() WHERE poi_sqno=?", actor, poiId);
    }
}
