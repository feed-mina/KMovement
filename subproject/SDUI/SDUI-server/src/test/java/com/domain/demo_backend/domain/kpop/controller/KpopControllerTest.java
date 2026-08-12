package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.domain.kpop.service.KpopProductService;
import com.domain.demo_backend.global.common.response.ApiResponse;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.mockito.ArgumentCaptor;
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
    void artistSearchCastsTheOptionalKeywordSoNullBindsKeepTheirType() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of());

        controller.artists(null);

        // `:q IS NULL` 만 쓰면 PostgreSQL이 placeholder 타입을 추론하지 못하고 42P18로 실패한다.
        verify(jdbcTemplate).queryForList(contains("CAST(:q AS text) IS NULL"), any(MapSqlParameterSource.class));
    }

    @Test
    void artistDetailResolvesSlugsWithoutCastingTheParameterToBigint() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class)))
                .thenReturn(List.of(Map.of("id", 7L, "slug", "aespa", "nameKo", "aespa")))
                .thenReturn(List.of());

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.artist("aespa");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).containsEntry("slug", "aespa");
        // 파라미터를 bigint로 캐스팅하면 slug 값이 bind 단계에서 실패하므로 컬럼을 캐스팅해야 한다.
        verify(jdbcTemplate).queryForList(
                contains("CAST(artist_id AS text) = :artistRef"), any(MapSqlParameterSource.class));
    }

    @Test
    void eventsListStaysPublicAndRanksFollowedArtistsFirst() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of(
                Map.of("id", 11L, "titleKo", "팬미팅", "followed", true)
        ));

        ResponseEntity<ApiResponse<List<Map<String, Object>>>> response = controller.events(null, null, null, user);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).hasSize(1);
        verify(jdbcTemplate).queryForList(
                contains("CAST(:region AS text) IS NULL"), any(MapSqlParameterSource.class));
    }

    @Test
    void eventsListDefaultsToUpcomingWhenFromIsOmitted() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of());

        controller.events(null, null, null, null);

        // event는 지난 활동까지 담은 타임라인이므로(V119), 기본값이 없으면 목록이 1년 전부터 열린다.
        verify(jdbcTemplate).queryForList(
                contains("e.event_date >= COALESCE(CAST(:fromDate AS date), CURRENT_DATE)"),
                any(MapSqlParameterSource.class));
    }

    @Test
    void eventsListStillHonoursAnExplicitFromSoPastSchedulesStayReachable() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of());

        controller.events(null, "2026-01-01", null, null);

        ArgumentCaptor<MapSqlParameterSource> params = ArgumentCaptor.forClass(MapSqlParameterSource.class);
        verify(jdbcTemplate).queryForList(anyString(), params.capture());
        assertThat(params.getValue().getValue("fromDate")).isEqualTo("2026-01-01");
    }

    @Test
    void anonymousEventsRequestStillReturnsTheApprovedSchedule() {
        when(jdbcTemplate.queryForList(anyString(), any(MapSqlParameterSource.class))).thenReturn(List.of(
                Map.of("id", 11L, "titleKo", "팬미팅", "followed", false)
        ));

        ResponseEntity<ApiResponse<List<Map<String, Object>>>> response = controller.events(null, null, null, null);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).hasSize(1);
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
    void unbookmarkEventDeletesOnlyTheCallersRow() {
        CustomUserDetails user = mock(CustomUserDetails.class);
        when(user.getUserSqno()).thenReturn(42L);
        when(jdbcTemplate.update(contains("DELETE FROM event_bookmark"), any(MapSqlParameterSource.class)))
                .thenReturn(1);

        ResponseEntity<ApiResponse<Map<String, Object>>> response = controller.unbookmarkEvent(9L, user);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getData()).containsEntry("eventId", 9L).containsEntry("bookmarked", false);
        verify(jdbcTemplate).update(contains("DELETE FROM event_bookmark"), any(MapSqlParameterSource.class));
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
