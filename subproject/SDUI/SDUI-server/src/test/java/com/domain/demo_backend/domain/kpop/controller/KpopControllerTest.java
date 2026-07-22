package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KpopControllerTest {

    private final NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
    private final KpopAnalysisService analysisService = mock(KpopAnalysisService.class);
    private final KpopController controller = new KpopController(jdbcTemplate, analysisService, Runnable::run);

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
    void createAnalysisJobRequiresAuthentication() {
        assertThatThrownBy(() -> controller.createAnalysisJob(Map.of("consented", false), null))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void createAnalysisJobRejectsMissingConsentForAuthenticatedUser() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(analysisService.submit(anyMap(), anyLong())).thenThrow(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "Upload consent is required.")
        );

        assertThatThrownBy(() -> controller.createAnalysisJob(Map.of("consented", false), user))
                .isInstanceOf(ResponseStatusException.class)
                .extracting(ex -> ((ResponseStatusException) ex).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void createAnalysisJobReturnsAcceptedWithBothJobIdentifiers() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(analysisService.submit(anyMap(), anyLong())).thenReturn(Map.of(
                "jobId", 91L,
                "taskId", "task-91",
                "status", "QUEUED"
        ));

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.createAnalysisJob(
                Map.of("consented", true),
                user
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData())
                .containsEntry("jobId", 91L)
                .containsEntry("taskId", "task-91");
    }

    @Test
    void followArtistUsesAuthenticatedPrincipalIdentity() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(jdbcTemplate.update(contains("INSERT INTO artist_follow"), any(MapSqlParameterSource.class)))
                .thenReturn(1);

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.followArtist(7L, user);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).containsEntry("artistId", 7L).containsEntry("followed", true);
        verify(jdbcTemplate).update(contains("INSERT INTO artist_follow"), any(MapSqlParameterSource.class));
    }

    @Test
    void bookmarkEventUsesAuthenticatedPrincipalIdentity() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(jdbcTemplate.update(contains("INSERT INTO event_bookmark"), any(MapSqlParameterSource.class)))
                .thenReturn(1);

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.bookmarkEvent(9L, user);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).containsEntry("eventId", 9L).containsEntry("bookmarked", true);
        verify(jdbcTemplate).update(contains("INSERT INTO event_bookmark"), any(MapSqlParameterSource.class));
    }
}
