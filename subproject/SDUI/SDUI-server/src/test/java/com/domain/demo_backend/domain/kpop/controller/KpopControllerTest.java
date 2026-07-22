package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.global.common.response.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KpopControllerTest {

    private final NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
    private final KpopController controller = new KpopController(jdbcTemplate);

    @Test
    void artistsReturnsApprovedArtistCards() {
        List<Map<String, Object>> rows = List.of(Map.of(
                "id", 1L,
                "nameKo", "방탄소년단",
                "nameEn", "BTS"
        ));
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(rows);

        ResponseEntity<ApiResponse<List<Map<String, Object>>>> response = controller.artists("BTS");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getStatus()).isEqualTo("success");
        assertThat(response.getBody().getData()).containsExactly(rows.get(0));
        verify(jdbcTemplate).queryForList(anyString(), any(MapSqlParameterSource.class));
    }

    @Test
    void createAnalysisJobRequiresExplicitConsent() {
        assertThatThrownBy(() -> controller.createAnalysisJob(Map.of("consented", false), null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
