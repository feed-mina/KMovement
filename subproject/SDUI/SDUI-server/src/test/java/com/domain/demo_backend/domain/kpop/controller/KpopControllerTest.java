package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.domain.kpop.service.KpopProductService;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class KpopControllerTest {

    private final NamedParameterJdbcTemplate jdbcTemplate = mock(NamedParameterJdbcTemplate.class);
    private final KpopAnalysisService analysisService = mock(KpopAnalysisService.class);
    private final KpopProductService productService = mock(KpopProductService.class);
    private final KpopController controller = new KpopController(
            jdbcTemplate,
            analysisService,
            productService,
            Runnable::run
    );

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
    void replayedAnalysisJobStillReturnsAcceptedWithBothJobIdentifiers() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(analysisService.submit(anyMap(), anyLong())).thenReturn(Map.of(
                "jobId", 91L,
                "taskId", "task-91",
                "status", "QUEUED",
                "idempotentReplay", true
        ));

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.createAnalysisJob(
                Map.of("consented", true),
                user
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData())
                .containsEntry("jobId", 91L)
                .containsEntry("taskId", "task-91")
                .containsEntry("idempotentReplay", true);
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

    @Test
    void productCandidatesDelegateAllBoundedSearchInputs() {
        when(productService.productCandidates("light", 1L, 2L, 50)).thenReturn(List.of(Map.of(
                "id", 91L,
                "name", "Official light stick candidate",
                "rightsChecked", false
        )));

        ResponseEntity<ApiResponse<List<Map<String, Object>>>> response = controller.productCandidates(
                "light", 1L, 2L, 50
        );

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).hasSize(1);
        verify(productService).productCandidates("light", 1L, 2L, 50);
    }

    @Test
    void savedItemMutationsUseTheAuthenticatedPrincipal() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        Map<String, Object> payload = Map.of(
                "itemType", "PRODUCT_CANDIDATE",
                "itemRefId", 91L
        );
        when(productService.saveItem(eq(payload), eq(42L))).thenReturn(Map.of(
                "id", 7L,
                "itemType", "PRODUCT_CANDIDATE",
                "itemRef", 91L
        ));
        when(productService.deleteSavedItem(7L, 42L)).thenReturn(Map.of(
                "id", 7L,
                "deleted", true
        ));

        ResponseEntity<ApiResponse<Map<String, Object>>> saved = controller.saveItem(payload, user);
        ResponseEntity<ApiResponse<Map<String, Object>>> deleted = controller.deleteSavedItem(7L, user);

        assertThat(saved.getBody()).isNotNull();
        assertThat(saved.getBody().getData()).containsEntry("id", 7L);
        assertThat(deleted.getBody()).isNotNull();
        assertThat(deleted.getBody().getData()).containsEntry("deleted", true);
        verify(productService).saveItem(payload, 42L);
        verify(productService).deleteSavedItem(7L, 42L);
    }
}
