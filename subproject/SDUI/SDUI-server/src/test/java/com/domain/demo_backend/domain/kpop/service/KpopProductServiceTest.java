package com.domain.demo_backend.domain.kpop.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KpopProductServiceTest {

    private final NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
    private final KpopProductService service = new KpopProductService(jdbcTemplate, new ObjectMapper());

    @Test
    void productSearchEnforcesLimitAndNeverLeaksInternalSourceUrl() {
        Map<String, Object> row = productRow(false);
        row.put("officialUrl", "https://worker.invalid/not-reviewed");
        row.put("sourceUrl", "https://internal.example/evidence");
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(List.of(row));

        List<Map<String, Object>> result = service.productCandidates(" light ", 1L, 2L, 500);

        assertThat(result).hasSize(1);
        assertThat(result.get(0))
                .containsEntry("rightsChecked", false)
                .containsEntry("officialUrl", null)
                .doesNotContainKey("sourceUrl");
        ArgumentCaptor<MapSqlParameterSource> captor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).queryForList(anyString(), captor.capture());
        assertThat(captor.getValue().getValue("limit")).isEqualTo(50);
        assertThat(captor.getValue().getValue("q")).isEqualTo("light");
    }

    @Test
    void saveRejectsAReferenceThatIsNotCurrentlyApproved() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(List.of());

        assertThatThrownBy(() -> service.saveItem(Map.of(
                "itemType", "PRODUCT_CANDIDATE",
                "itemRefId", 91L
        ), 42L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);

        verify(jdbcTemplate, never()).queryForObject(
                anyString(), any(MapSqlParameterSource.class), eq(Long.class)
        );
    }

    @Test
    void saveIsIdempotentAndReturnsAUserOwnedHydratedCandidate() {
        Map<String, Object> product = productRow(true);
        Map<String, Object> saved = new LinkedHashMap<>();
        saved.put("id", 7L);
        saved.put("itemType", "PRODUCT_CANDIDATE");
        saved.put("itemRef", 91L);
        saved.put("createdAt", LocalDateTime.of(2026, 7, 23, 12, 0));
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(List.of(product), List.of(saved), List.of(product));
        when(jdbcTemplate.queryForObject(
                anyString(), any(MapSqlParameterSource.class), eq(Long.class)
        )).thenReturn(7L);

        Map<String, Object> result = service.saveItem(Map.of(
                "itemType", "product_candidate",
                "itemRefId", 91L
        ), 42L);

        assertThat(result)
                .containsEntry("id", 7L)
                .containsEntry("itemType", "PRODUCT_CANDIDATE")
                .containsEntry("itemRef", 91L);
        Map<?, ?> hydratedItem = (Map<?, ?>) result.get("item");
        assertThat(hydratedItem.get("name")).isEqualTo("Trusted catalog name");
        assertThat(hydratedItem.get("officialUrl")).isEqualTo("https://official.example/product");
        ArgumentCaptor<MapSqlParameterSource> captor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).queryForObject(anyString(), captor.capture(), eq(Long.class));
        assertThat(captor.getValue().getValue("userSqno")).isEqualTo(42L);
        assertThat(captor.getValue().getValue("itemRef")).isEqualTo(91L);
    }

    @Test
    void deleteScopesMutationToTheAuthenticatedOwner() {
        when(jdbcTemplate.update(contains("DELETE FROM saved_item"), any(MapSqlParameterSource.class)))
                .thenReturn(0);

        assertThatThrownBy(() -> service.deleteSavedItem(7L, 42L))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);

        ArgumentCaptor<MapSqlParameterSource> captor = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).update(contains("DELETE FROM saved_item"), captor.capture());
        assertThat(captor.getValue().getValue("userSqno")).isEqualTo(42L);
        assertThat(captor.getValue().getValue("savedItemId")).isEqualTo(7L);
    }

    @Test
    void analysisHydratesOnlyApprovedPostgresRowsAndNormalizesGradeCase() {
        Map<String, Object> product = productRow(false);
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(List.of(product), List.of());
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        Map<String, Object> result = service.sanitizeAnalysisResult(55L, Map.of(
                "grade", "similar",
                "confidence", 88,
                "candidates", List.of(
                        Map.of(
                                "productRef", "catalog:91",
                                "name", "Worker supplied name",
                                "officialUrl", "https://worker.invalid/link",
                                "grade", "exact_candidate",
                                "confidence", 95,
                                "evidence", List.of("visual pattern match")
                        ),
                        Map.of(
                                "productRef", "missing:404",
                                "name", "Fabricated product",
                                "officialUrl", "https://worker.invalid/fabricated",
                                "grade", "EXACT_CANDIDATE",
                                "confidence", 100,
                                "evidence", List.of("untrusted")
                        )
                )
        ));

        assertThat(result)
                .containsEntry("grade", "SIMILAR")
                .containsEntry("confidence", 88);
        List<?> candidates = (List<?>) result.get("candidates");
        assertThat(candidates).hasSize(1);
        Map<?, ?> hydratedCandidate = (Map<?, ?>) candidates.get(0);
        assertThat(hydratedCandidate.get("name")).isEqualTo("Trusted catalog name");
        assertThat(hydratedCandidate.get("evidenceGrade")).isEqualTo("EXACT_CANDIDATE");
        assertThat(hydratedCandidate.get("officialUrl")).isNull();
        assertThat(hydratedCandidate.get("name")).isNotEqualTo("Worker supplied name");
        assertThat(hydratedCandidate.containsKey("sourceUrl")).isFalse();
        verify(jdbcTemplate).update(
                contains("DELETE FROM kpop_analysis_candidate"),
                any(MapSqlParameterSource.class)
        );
        verify(jdbcTemplate).update(
                contains("INSERT INTO kpop_analysis_candidate"),
                any(MapSqlParameterSource.class)
        );
    }

    @Test
    void analysisDowngradesUngroundedSimilarAndExactClaims() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(List.of(productRow(true)), List.of());
        when(jdbcTemplate.update(anyString(), any(MapSqlParameterSource.class))).thenReturn(1);

        Map<String, Object> noEvidence = service.sanitizeAnalysisResult(55L, Map.of(
                "grade", "EXACT_CANDIDATE",
                "confidence", 99,
                "candidates", List.of(Map.of(
                        "productRef", "catalog:91",
                        "grade", "EXACT_CANDIDATE",
                        "confidence", 99
                ))
        ));
        Map<String, Object> unknownReference = service.sanitizeAnalysisResult(56L, Map.of(
                "grade", "SIMILAR",
                "confidence", 80,
                "candidates", List.of(Map.of(
                        "productRef", "missing:404",
                        "grade", "SIMILAR",
                        "confidence", 80,
                        "evidence", List.of("untrusted")
                ))
        ));

        assertThat(noEvidence)
                .containsEntry("grade", "INSUFFICIENT_EVIDENCE")
                .containsEntry("confidence", 0);
        Map<?, ?> ungroundedCandidate = (Map<?, ?>) ((List<?>) noEvidence.get("candidates")).get(0);
        assertThat(ungroundedCandidate.get("evidenceGrade")).isEqualTo("INSUFFICIENT_EVIDENCE");
        assertThat(ungroundedCandidate.get("confidence")).isEqualTo(0);
        assertThat(unknownReference)
                .containsEntry("grade", "INSUFFICIENT_EVIDENCE")
                .containsEntry("confidence", 0);
        assertThat((List<?>) unknownReference.get("candidates")).isEmpty();
    }

    private Map<String, Object> productRow(boolean rightsChecked) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", 91L);
        row.put("artistId", 1L);
        row.put("eventId", 2L);
        row.put("name", "Trusted catalog name");
        row.put("brand", "Trusted brand");
        row.put("catalogSource", "MANUAL_CURATED");
        row.put("providerProductRef", "catalog:91");
        row.put("evidenceGrade", "SIMILAR");
        row.put("confidence", new BigDecimal("72.50"));
        row.put("evidenceText", "Curated catalog evidence");
        row.put("evidenceJson", "{\"source\":\"curator\"}");
        row.put("rightsChecked", rightsChecked);
        row.put("officialUrl", rightsChecked ? "https://official.example/product" : null);
        return row;
    }
}
