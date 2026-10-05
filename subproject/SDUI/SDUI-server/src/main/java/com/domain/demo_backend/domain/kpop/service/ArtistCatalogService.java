package com.domain.demo_backend.domain.kpop.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** F6-A public reads: always recheck approval in PostgreSQL, without catalog caching. */
@Service
@RequiredArgsConstructor
public class ArtistCatalogService {
    private final NamedParameterJdbcTemplate jdbc;
    private static final String COLUMNS = """
            artist_id AS id, slug, name_ko AS "nameKo", name_en AS "nameEn",
            profile, image_url AS "imageUrl", official_url AS "officialUrl",
            instagram_url AS "instagramUrl", youtube_url AS "youtubeUrl", x_url AS "xUrl"
            """;
    private static final String FILTER = """
            FROM artist WHERE approved_yn = 'Y'
            AND (CAST(:q AS text) IS NULL OR name_ko ILIKE :pattern ESCAPE '\\'
                 OR name_en ILIKE :pattern ESCAPE '\\')
            """;

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public Map<String, Object> page(String rawQuery, int page, int pageSize) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() > 120 || page < 1 || page > 1_000_000 || pageSize < 1 || pageSize > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid artist search or page.");
        }
        String literal = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("q", query.isEmpty() ? null : query)
                .addValue("pattern", "%" + literal + "%")
                .addValue("limit", pageSize).addValue("offset", (page - 1) * pageSize);
        Long total = jdbc.queryForObject("SELECT COUNT(*) " + FILTER, params, Long.class);
        List<Map<String, Object>> items = jdbc.queryForList("SELECT " + COLUMNS + FILTER
                + " ORDER BY sort_order ASC, name_ko ASC, artist_id ASC LIMIT :limit OFFSET :offset", params);
        return Map.of("items", items, "totalCount", total == null ? 0L : total,
                "page", page, "pageSize", pageSize, "query", query);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> profile(String ref) {
        if (ref == null || ref.isBlank() || ref.length() > 160) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found.");
        }
        List<Map<String, Object>> items = jdbc.queryForList("SELECT " + COLUMNS + """
                FROM artist WHERE approved_yn = 'Y'
                  AND (LOWER(slug) = LOWER(:ref) OR CAST(artist_id AS text) = :ref)
                """, new MapSqlParameterSource("ref", ref.trim()));
        if (items.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Artist not found.");
        return items.get(0);
    }
}
