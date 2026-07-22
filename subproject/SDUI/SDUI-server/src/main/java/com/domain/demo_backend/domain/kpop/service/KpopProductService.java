package com.domain.demo_backend.domain.kpop.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class KpopProductService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;
    private static final int MAX_SAVED_ITEMS = 100;
    private static final int MAX_ANALYSIS_CANDIDATES = 20;
    private static final Set<String> ITEM_TYPES = Set.of("ARTIST", "EVENT", "PRODUCT_CANDIDATE");
    private static final Set<String> EVIDENCE_GRADES = Set.of(
            "EXACT_CANDIDATE", "SIMILAR", "INSUFFICIENT_EVIDENCE"
    );

    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> productCandidates(
            String q,
            Long artistId,
            Long eventId,
            Integer requestedLimit
    ) {
        String query = blankToNull(q);
        if (query != null && query.length() > 120) {
            throw badRequest("q must be 120 characters or fewer.");
        }
        requirePositiveIfPresent("artistId", artistId);
        requirePositiveIfPresent("eventId", eventId);
        int limit = normalizeLimit(requestedLimit);

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("q", query)
                .addValue("artistId", artistId)
                .addValue("eventId", eventId)
                .addValue("limit", limit);
        return sanitizeProductRows(jdbcTemplate.queryForList(productSelect("""
                WHERE pc.approved_yn = 'Y'
                  AND (CAST(:q AS text) IS NULL OR pc.name ILIKE CONCAT('%', :q, '%')
                       OR pc.brand ILIKE CONCAT('%', :q, '%'))
                  AND (CAST(:artistId AS bigint) IS NULL OR pc.artist_id = :artistId)
                  AND (CAST(:eventId AS bigint) IS NULL OR pc.event_id = :eventId)
                ORDER BY pc.confidence DESC, pc.product_candidate_id DESC
                LIMIT :limit
                """), params));
    }

    @Transactional
    public Map<String, Object> saveItem(Map<String, Object> payload, Long userSqno) {
        requirePrincipal(userSqno);
        String itemType = requiredText(payload, "itemType").toUpperCase(Locale.ROOT);
        if (!ITEM_TYPES.contains(itemType)) {
            throw badRequest("Unsupported saved item type.");
        }
        Long itemRef = requiredPositiveLong(payload.containsKey("itemRefId")
                ? payload.get("itemRefId")
                : payload.get("itemRef"), "itemRefId");
        requireApprovedReference(itemType, itemRef);

        Long savedItemId = jdbcTemplate.queryForObject("""
                INSERT INTO saved_item (user_sqno, item_type, item_ref)
                VALUES (:userSqno, :itemType, :itemRef)
                ON CONFLICT (user_sqno, item_type, item_ref)
                DO UPDATE SET item_ref = EXCLUDED.item_ref
                RETURNING saved_item_id
                """, params("userSqno", userSqno)
                .addValue("itemType", itemType)
                .addValue("itemRef", itemRef), Long.class);
        if (savedItemId == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Saved item was not created.");
        }
        return hydrateSavedItem(savedItemId, userSqno);
    }

    public List<Map<String, Object>> savedItems(Long userSqno) {
        requirePrincipal(userSqno);
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT saved_item_id AS id, item_type AS "itemType", item_ref AS "itemRef",
                       created_at AS "createdAt", updated_at AS "updatedAt"
                FROM saved_item
                WHERE user_sqno = :userSqno
                ORDER BY created_at DESC, saved_item_id DESC
                LIMIT :limit
                """, params("userSqno", userSqno).addValue("limit", MAX_SAVED_ITEMS));
        return rows.stream().map(row -> hydrateSavedRow(row, userSqno)).toList();
    }

    @Transactional
    public Map<String, Object> deleteSavedItem(Long savedItemId, Long userSqno) {
        requirePrincipal(userSqno);
        requirePositiveIfPresent("savedItemId", savedItemId);
        int deleted = jdbcTemplate.update("""
                DELETE FROM saved_item
                WHERE saved_item_id = :savedItemId AND user_sqno = :userSqno
                """, params("savedItemId", savedItemId).addValue("userSqno", userSqno));
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Saved item was not found.");
        }
        return Map.of("id", savedItemId, "deleted", true);
    }

    /**
     * Treats the worker payload as untrusted references.  Names, brands and
     * links are always re-hydrated from approved PostgreSQL catalog rows.
     */
    @Transactional
    public Map<String, Object> sanitizeAnalysisResult(Long analysisJobId, Map<String, Object> rawResult) {
        List<?> rawCandidates = rawResult.get("candidates") instanceof List<?> list
                ? list.subList(0, Math.min(list.size(), MAX_ANALYSIS_CANDIDATES))
                : List.of();
        List<Map<String, Object>> candidates = new ArrayList<>();
        Set<Long> seenCandidateIds = new HashSet<>();

        if (analysisJobId != null) {
            jdbcTemplate.update(
                    "DELETE FROM kpop_analysis_candidate WHERE analysis_job_id = :analysisJobId",
                    params("analysisJobId", analysisJobId)
            );
        }

        int rank = 0;
        boolean hasExactCandidate = false;
        boolean hasCandidateEvidence = false;
        for (Object value : rawCandidates) {
            if (!(value instanceof Map<?, ?> rawCandidate)) continue;
            Object evidence = sanitizeEvidence(rawCandidate.get("evidence"));
            boolean hasEvidence = hasEvidence(evidence);
            String productRef = firstText(
                    rawCandidate.get("productRef"),
                    rawCandidate.get("providerProductRef"),
                    rawCandidate.get("productCandidateId")
            );
            if (productRef != null && productRef.length() > 180) productRef = null;
            Map<String, Object> catalogRow = findProductCandidate(productRef);
            if (catalogRow == null) {
                // Do not echo worker-supplied names, links, or opaque references.
                // An invalid reference only contributes to fail-closed grading.
                continue;
            }
            Long catalogId = toPositiveLong(catalogRow.get("id"));
            if (catalogId == null || !seenCandidateIds.add(catalogId)) continue;
            rank++;
            String grade = sanitizeGrade(rawCandidate.get("evidenceGrade"), rawCandidate.get("grade"));
            if (!hasEvidence) {
                grade = "INSUFFICIENT_EVIDENCE";
            }
            int confidence = "INSUFFICIENT_EVIDENCE".equals(grade)
                    ? 0
                    : sanitizeConfidence(rawCandidate.get("confidence"));

            Map<String, Object> candidate = new LinkedHashMap<>();
            candidate.putAll(catalogRow);
            candidate.put("rank", rank);
            candidate.put("evidenceGrade", grade);
            candidate.put("confidence", confidence);
            candidate.put("evidence", evidence);
            candidates.add(candidate);

            hasExactCandidate |= "EXACT_CANDIDATE".equals(grade);
            hasCandidateEvidence |= hasEvidence;
            if (analysisJobId != null) {
                persistAnalysisCandidate(analysisJobId, catalogRow, rank, grade, confidence, evidence);
            }
        }

        Object rootEvidence = sanitizeEvidence(rawResult.get("evidence"));
        String rootGrade = sanitizeGrade(rawResult.get("grade"));
        boolean hasGroundedResult = !candidates.isEmpty()
                && (hasEvidence(rootEvidence) || hasCandidateEvidence);
        if (!"INSUFFICIENT_EVIDENCE".equals(rootGrade)
                && (!hasGroundedResult
                    || ("EXACT_CANDIDATE".equals(rootGrade) && !hasExactCandidate))) {
            rootGrade = "INSUFFICIENT_EVIDENCE";
        }
        int rootConfidence = "INSUFFICIENT_EVIDENCE".equals(rootGrade)
                ? 0
                : sanitizeConfidence(rawResult.get("confidence"));

        Map<String, Object> sanitized = new LinkedHashMap<>();
        sanitized.put("grade", rootGrade);
        sanitized.put("confidence", rootConfidence);
        sanitized.put("evidence", rootEvidence);
        sanitized.put("candidates", candidates);
        return sanitized;
    }

    private Map<String, Object> hydrateSavedItem(Long savedItemId, Long userSqno) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT saved_item_id AS id, item_type AS "itemType", item_ref AS "itemRef",
                       created_at AS "createdAt", updated_at AS "updatedAt"
                FROM saved_item
                WHERE saved_item_id = :savedItemId AND user_sqno = :userSqno
                """, params("savedItemId", savedItemId).addValue("userSqno", userSqno));
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Saved item was not found.");
        }
        return hydrateSavedRow(rows.get(0), userSqno);
    }

    private Map<String, Object> hydrateSavedRow(Map<String, Object> row, Long userSqno) {
        String itemType = String.valueOf(row.get("itemType"));
        Long itemRef = toPositiveLong(row.get("itemRef"));
        Map<String, Object> hydrated = new LinkedHashMap<>(row);
        hydrated.put("item", findApprovedReference(itemType, itemRef));
        return hydrated;
    }

    private Map<String, Object> findApprovedReference(String itemType, Long itemRef) {
        if (itemRef == null) return unavailableItem();
        List<Map<String, Object>> rows = switch (itemType) {
            case "ARTIST" -> jdbcTemplate.queryForList("""
                    SELECT artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn",
                           profile, image_url AS "imageUrl", official_url AS "officialUrl"
                    FROM artist WHERE artist_id = :itemRef AND approved_yn = 'Y'
                    """, params("itemRef", itemRef));
            case "EVENT" -> jdbcTemplate.queryForList("""
                    SELECT e.event_id AS id, e.artist_id AS "artistId", a.name_ko AS "artistNameKo",
                           e.title_ko AS "titleKo", e.title_en AS "titleEn", e.region, e.venue,
                           e.event_date AS date, e.official_url AS "officialUrl"
                    FROM event e JOIN artist a ON a.artist_id = e.artist_id
                    WHERE e.event_id = :itemRef AND e.approved_yn = 'Y' AND a.approved_yn = 'Y'
                    """, params("itemRef", itemRef));
            case "PRODUCT_CANDIDATE" -> sanitizeProductRows(jdbcTemplate.queryForList(
                    productSelect("WHERE pc.product_candidate_id = :itemRef AND pc.approved_yn = 'Y'"),
                    params("itemRef", itemRef)
            ));
            default -> List.of();
        };
        return rows.isEmpty() ? unavailableItem() : rows.get(0);
    }

    private void requireApprovedReference(String itemType, Long itemRef) {
        Map<String, Object> item = findApprovedReference(itemType, itemRef);
        if (Boolean.FALSE.equals(item.get("available"))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Approved item reference was not found.");
        }
    }

    private Map<String, Object> findProductCandidate(String productRef) {
        if (productRef == null || productRef.isBlank()) return null;
        Long candidateId = toPositiveLong(productRef);
        String condition = candidateId == null
                ? "WHERE pc.provider_product_ref = :productRef AND pc.approved_yn = 'Y'"
                : "WHERE (pc.provider_product_ref = :productRef OR pc.product_candidate_id = :candidateId) AND pc.approved_yn = 'Y'";
        MapSqlParameterSource params = params("productRef", productRef).addValue("candidateId", candidateId);
        List<Map<String, Object>> rows = sanitizeProductRows(jdbcTemplate.queryForList(
                productSelect(condition + " LIMIT 1"), params
        ));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private void persistAnalysisCandidate(
            Long analysisJobId,
            Map<String, Object> catalogRow,
            int rank,
            String grade,
            int confidence,
            Object evidence
    ) {
        jdbcTemplate.update("""
                INSERT INTO kpop_analysis_candidate (
                    analysis_job_id, product_candidate_id, rank,
                    evidence_grade, confidence, evidence_json
                ) VALUES (
                    :analysisJobId, :productCandidateId, :rank,
                    :evidenceGrade, :confidence, CAST(:evidenceJson AS jsonb)
                )
                ON CONFLICT (analysis_job_id, product_candidate_id)
                DO UPDATE SET rank = EXCLUDED.rank,
                              evidence_grade = EXCLUDED.evidence_grade,
                              confidence = EXCLUDED.confidence,
                              evidence_json = EXCLUDED.evidence_json,
                              updated_at = NOW()
                """, params("analysisJobId", analysisJobId)
                .addValue("productCandidateId", catalogRow.get("id"))
                .addValue("rank", rank)
                .addValue("evidenceGrade", grade)
                .addValue("confidence", confidence)
                .addValue("evidenceJson", writeJson(evidence)));
    }

    private String productSelect(String tail) {
        return """
                SELECT pc.product_candidate_id AS id, pc.artist_id AS "artistId",
                       pc.event_id AS "eventId", pc.name, pc.brand,
                       pc.catalog_source AS "catalogSource",
                       pc.provider_product_ref AS "providerProductRef",
                       pc.evidence_grade AS "evidenceGrade", pc.confidence,
                       pc.evidence_text AS "evidenceText",
                       pc.evidence_json::text AS "evidenceJson",
                       pc.rights_checked AS "rightsChecked",
                       pc.last_verified_at AS "lastVerifiedAt",
                       CASE WHEN pc.rights_checked IS TRUE
                            THEN pc.official_url
                            ELSE NULL END AS "officialUrl"
                FROM product_candidate pc
                """ + tail;
    }

    private List<Map<String, Object>> sanitizeProductRows(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> {
            Map<String, Object> safe = new LinkedHashMap<>(row);
            safe.put("evidenceJson", parseJson(row.get("evidenceJson")));
            safe.remove("sourceUrl");
            if (!Boolean.TRUE.equals(row.get("rightsChecked"))) {
                safe.put("officialUrl", null);
            }
            return safe;
        }).toList();
    }

    private Object parseJson(Object raw) {
        if (raw == null) return Map.of();
        try {
            return objectMapper.readValue(String.valueOf(raw), new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ignored) {
            return Map.of();
        }
    }

    private Object sanitizeEvidence(Object raw) {
        if (raw instanceof List<?> list) {
            return list.stream().limit(10).map(this::sanitizeEvidenceValue).toList();
        }
        if (raw instanceof Map<?, ?> map) {
            Map<String, Object> safe = new LinkedHashMap<>();
            map.entrySet().stream().limit(10).forEach(entry ->
                    safe.put(trim(String.valueOf(entry.getKey()), 80), sanitizeEvidenceValue(entry.getValue()))
            );
            return safe;
        }
        if (raw == null) return List.of();
        String value = trim(String.valueOf(raw), 500);
        return value.isBlank() ? List.of() : value;
    }

    private Object sanitizeEvidenceValue(Object value) {
        if (value instanceof Number || value instanceof Boolean) return value;
        return trim(String.valueOf(value == null ? "" : value), 500);
    }

    private boolean hasEvidence(Object evidence) {
        if (evidence instanceof List<?> list) return list.stream().anyMatch(this::hasEvidence);
        if (evidence instanceof Map<?, ?> map) return map.values().stream().anyMatch(this::hasEvidence);
        return evidence != null && !String.valueOf(evidence).isBlank();
    }

    private String sanitizeGrade(Object... values) {
        String grade = firstText(values);
        if (grade != null) grade = grade.toUpperCase(Locale.ROOT);
        return grade != null && EVIDENCE_GRADES.contains(grade)
                ? grade
                : "INSUFFICIENT_EVIDENCE";
    }

    private int sanitizeConfidence(Object raw) {
        try {
            BigDecimal value = new BigDecimal(String.valueOf(raw));
            return value.max(BigDecimal.ZERO).min(BigDecimal.valueOf(100)).intValue();
        } catch (RuntimeException ignored) {
            return 0;
        }
    }

    private int normalizeLimit(Integer requestedLimit) {
        if (requestedLimit == null) return DEFAULT_LIMIT;
        if (requestedLimit < 1) throw badRequest("limit must be positive.");
        return Math.min(requestedLimit, MAX_LIMIT);
    }

    private void requirePrincipal(Long userSqno) {
        if (userSqno == null || userSqno <= 0) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication is required.");
        }
    }

    private void requirePositiveIfPresent(String field, Long value) {
        if (value != null && value <= 0) throw badRequest(field + " must be positive.");
    }

    private String requiredText(Map<String, Object> payload, String field) {
        String value = firstText(payload.get(field));
        if (value == null) throw badRequest(field + " is required.");
        return value;
    }

    private Long requiredPositiveLong(Object raw, String field) {
        Long value = toPositiveLong(raw);
        if (value == null) throw badRequest(field + " must be a positive integer.");
        return value;
    }

    private Long toPositiveLong(Object raw) {
        if (raw == null) return null;
        try {
            long value = Long.parseLong(String.valueOf(raw));
            return value > 0 ? value : null;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String firstText(Object... rawValues) {
        for (Object raw : rawValues) {
            if (raw == null) continue;
            String value = String.valueOf(raw).trim();
            if (!value.isEmpty() && !"null".equalsIgnoreCase(value)) return value;
        }
        return null;
    }

    private String blankToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String trim(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ignored) {
            return "[]";
        }
    }

    private Map<String, Object> unavailableItem() {
        return Map.of("available", false);
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private MapSqlParameterSource params(String name, Object value) {
        return new MapSqlParameterSource().addValue(name, value);
    }
}
