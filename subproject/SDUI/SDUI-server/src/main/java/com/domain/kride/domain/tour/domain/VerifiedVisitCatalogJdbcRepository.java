package com.domain.kride.domain.tour.domain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/** Reads the verified visit catalog view used by the recommendation pipeline. */
@Repository
public class VerifiedVisitCatalogJdbcRepository {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public VerifiedVisitCatalogJdbcRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public List<JsonNode> findAllPayloads() {
        return jdbc.query("SELECT payload::text FROM verified_visit_catalog ORDER BY poi_sqno",
            (rs, n) -> {
                try { return mapper.readTree(rs.getString(1)); }
                catch (Exception ex) { throw new IllegalStateException("Invalid visit catalog", ex); }
            });
    }
}
