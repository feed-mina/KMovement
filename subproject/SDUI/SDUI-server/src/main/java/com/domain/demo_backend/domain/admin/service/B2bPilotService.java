package com.domain.demo_backend.domain.admin.service;

import com.domain.demo_backend.domain.admin.dto.B2bDashboardResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class B2bPilotService {
    private final JdbcTemplate jdbcTemplate;

    public B2bPilotService(JdbcTemplate jdbcTemplate) { this.jdbcTemplate = jdbcTemplate; }

    @Transactional(readOnly = true)
    public B2bDashboardResponse dashboard(Long ownerUserSqno, boolean admin) {
        String ownerFilter = admin ? "" : " AND p.owner_user_sqno = ?";
        String sql = """
                SELECT s.slot_id, s.title, s.status,
                  COUNT(*) FILTER (WHERE e.event_type='IMPRESSION') impressions,
                  COUNT(*) FILTER (WHERE e.event_type='CLICK') clicks,
                  COUNT(*) FILTER (WHERE e.event_type='CONVERSION') conversions
                FROM b2b_exposure_slot s
                JOIN b2b_partner p ON p.partner_id=s.partner_id
                LEFT JOIN b2b_slot_event e ON e.slot_id=s.slot_id
                WHERE 1=1
                """ + ownerFilter + " GROUP BY s.slot_id, s.title, s.status ORDER BY s.created_at DESC";
        List<B2bDashboardResponse.SlotPerformance> slots = (admin
                ? jdbcTemplate.query(sql, (rs, n) -> mapSlot(rs.getLong("slot_id"), rs.getString("title"), rs.getString("status"), rs.getLong("impressions"), rs.getLong("clicks"), rs.getLong("conversions")))
                : jdbcTemplate.query(sql, (rs, n) -> mapSlot(rs.getLong("slot_id"), rs.getString("title"), rs.getString("status"), rs.getLong("impressions"), rs.getLong("clicks"), rs.getLong("conversions")), ownerUserSqno));
        long impressions = slots.stream().mapToLong(B2bDashboardResponse.SlotPerformance::impressions).sum();
        long clicks = slots.stream().mapToLong(B2bDashboardResponse.SlotPerformance::clicks).sum();
        long conversions = slots.stream().mapToLong(B2bDashboardResponse.SlotPerformance::conversions).sum();
        return new B2bDashboardResponse(LocalDateTime.now(), impressions, clicks, conversions,
                rate(clicks, impressions), rate(conversions, clicks), slots);
    }

    @Transactional
    public void recordEvent(long slotId, String eventType, String sessionKey) {
        String normalized = eventType == null ? "" : eventType.toUpperCase();
        if (!List.of("IMPRESSION", "CLICK", "CONVERSION").contains(normalized)) throw new IllegalArgumentException("Unsupported event type");
        int inserted = jdbcTemplate.update("""
                INSERT INTO b2b_slot_event(slot_id,event_type,session_key)
                SELECT slot_id, ?, ? FROM b2b_exposure_slot
                WHERE slot_id=? AND status='ACTIVE' AND (starts_at IS NULL OR starts_at<=CURRENT_TIMESTAMP)
                  AND (ends_at IS NULL OR ends_at>=CURRENT_TIMESTAMP)
                """, normalized, sessionKey, slotId);
        if (inserted == 0) throw new IllegalArgumentException("Active slot not found");
    }

    @Transactional
    public long requestSlot(long ownerUserSqno, String partnerName, String partnerType, String slotKey,
                            String title, String destinationUrl, Long poiSqno) {
        jdbcTemplate.update("""
                INSERT INTO b2b_partner(owner_user_sqno, partner_name, partner_type)
                VALUES (?, ?, ?)
                ON CONFLICT(owner_user_sqno) DO UPDATE SET partner_name=EXCLUDED.partner_name, partner_type=EXCLUDED.partner_type
                """, ownerUserSqno, required(partnerName, "partnerName"), defaultValue(partnerType, "BUSINESS"));
        Long partnerId = jdbcTemplate.queryForObject("SELECT partner_id FROM b2b_partner WHERE owner_user_sqno=?", Long.class, ownerUserSqno);
        return jdbcTemplate.queryForObject("""
                INSERT INTO b2b_exposure_slot(partner_id, poi_sqno, slot_key, title, destination_url)
                VALUES (?, ?, ?, ?, ?) RETURNING slot_id
                """, Long.class, partnerId, poiSqno, required(slotKey, "slotKey"), required(title, "title"), destinationUrl);
    }

    @Transactional
    public void reviewSlot(long slotId, String status, long reviewerSqno) {
        String normalized = status == null ? "" : status.toUpperCase();
        if (!List.of("ACTIVE", "PAUSED", "REJECTED").contains(normalized)) throw new IllegalArgumentException("Unsupported slot status");
        int updated = jdbcTemplate.update("UPDATE b2b_exposure_slot SET status=?, approved_by=?, approved_at=CURRENT_TIMESTAMP WHERE slot_id=?", normalized, reviewerSqno, slotId);
        if (updated == 0) throw new IllegalArgumentException("Slot not found");
    }

    private B2bDashboardResponse.SlotPerformance mapSlot(long id, String title, String status, long impressions, long clicks, long conversions) {
        return new B2bDashboardResponse.SlotPerformance(id, title, status, impressions, clicks, conversions, rate(clicks, impressions), rate(conversions, clicks));
    }
    private double rate(long numerator, long denominator) { return denominator == 0 ? 0 : Math.round(numerator * 1000.0 / denominator) / 10.0; }
    private String required(String value, String field) { if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required"); return value.trim(); }
    private String defaultValue(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim().toUpperCase(); }
}
