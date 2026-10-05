package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.net.URI;
import java.time.Duration;
import java.util.*;

/** F6-C public reads only. Existing name/brand PostgreSQL search and rights gate are preserved. */
@Service
@RequiredArgsConstructor
public class PublicProductCatalogService {
    public static final String CACHE_RESOURCE = "product_candidates_public_v1";
    private final NamedParameterJdbcTemplate jdbc;
    private final KpopCacheService cache;
    private final BackendOperationalTelemetry telemetry;
    private static final String FILTER = """
            FROM product_candidate pc WHERE pc.approved_yn = 'Y'
              AND (CAST(:q AS text) IS NULL OR pc.name ILIKE CONCAT('%', CAST(:q AS text), '%')
                   OR pc.brand ILIKE CONCAT('%', CAST(:q AS text), '%'))
              AND (CAST(:artistId AS bigint) IS NULL OR pc.artist_id = :artistId)
              AND (CAST(:eventId AS bigint) IS NULL OR pc.event_id = :eventId)
              AND pc.evidence_grade IN ('EXACT_CANDIDATE','SIMILAR')
              AND NULLIF(TRIM(pc.evidence_text), '') IS NOT NULL
              AND pc.catalog_source = 'MANUAL_CURATED'
              AND pc.last_verified_at IS NOT NULL
            """;
    private static final String ORDER = " ORDER BY pc.confidence DESC, pc.product_candidate_id DESC LIMIT :limit";

    public List<Map<String,Object>> search(String rawQuery, Long artistId, Long eventId, Integer requestedLimit) {
        String q = rawQuery == null || rawQuery.isBlank() ? null : rawQuery.trim();
        if (q != null && q.length() > 120) throw bad("검색어는 120자 이내로 입력해 주세요.");
        if (artistId != null && artistId <= 0 || eventId != null && eventId <= 0 || requestedLimit != null && requestedLimit < 1)
            throw bad("식별자와 조회 개수는 양수여야 합니다.");
        int limit = requestedLimit == null ? 20 : Math.min(50,requestedLimit);
        Map<String,Object> key = new LinkedHashMap<>();
        key.put("q",q);key.put("artistId",artistId);key.put("eventId",eventId);key.put("limit",limit);
        MapSqlParameterSource parameters = new MapSqlParameterSource(key);
        // Distinguish literal user input "<null>" from the cache helper's null sentinel.
        key.put("q",q == null ? null : "text:" + q);
        // Cache IDs, never rights/source metadata. A hit still checks the current DB policy.
        List<Long> ids = cache.catalog(CACHE_RESOURCE,key,Duration.ofMinutes(3),new TypeReference<List<Long>>() {},()->{
            List<Long> found = jdbc.queryForList("SELECT pc.product_candidate_id " + FILTER + ORDER,parameters,Long.class);
            telemetry.record("kpop_public_products","db_search",CACHE_RESOURCE,Set.of());
            return found;
        });
        if (ids.isEmpty()) return List.of();
        List<Map<String,Object>> rows = jdbc.queryForList("""
                SELECT pc.product_candidate_id AS id, pc.name, pc.brand,
                       pc.catalog_source AS "catalogSource", pc.evidence_grade AS "evidenceGrade",
                       pc.evidence_text AS "evidenceText", pc.rights_checked AS "rightsChecked",
                       CAST(pc.last_verified_at AS text) AS "lastVerifiedAt",
                       CASE WHEN pc.rights_checked IS TRUE THEN pc.official_url ELSE NULL END AS "officialUrl"
                """ + FILTER + " AND pc.product_candidate_id IN (:ids) " + ORDER,parameters.addValue("ids",ids));
        telemetry.record("kpop_public_products","db_revalidate",CACHE_RESOURCE,Set.of());
        return rows.stream().map(row->{
            Map<String,Object> safe = new LinkedHashMap<>(row);
            if (!Boolean.TRUE.equals(row.get("rightsChecked")) || !allowedSource(row.get("officialUrl"))) safe.put("officialUrl",null);
            return safe;
        }).toList();
    }
    private boolean allowedSource(Object raw) {
        if (!(raw instanceof String value)) return false;
        try {
            URI url = URI.create(value);String host = url.getHost();
            return "https".equalsIgnoreCase(url.getScheme()) && url.getRawUserInfo() == null
                    && host != null && host.contains(".") && !host.matches("[0-9.]+")
                    && !host.toLowerCase(Locale.ROOT).endsWith(".local") && (url.getPort() == -1 || url.getPort() == 443);
        } catch (IllegalArgumentException ignored) { return false; }
    }
    private ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }
}
