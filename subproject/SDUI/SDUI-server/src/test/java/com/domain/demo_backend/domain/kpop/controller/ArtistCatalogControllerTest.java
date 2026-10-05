package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.ArtistCatalogService;
import com.domain.demo_backend.domain.kpop.service.KpopAnalysisService;
import com.domain.demo_backend.domain.kpop.service.KpopProductService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.Map;
import java.util.UUID;
import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.mock;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real SQL in an isolated H2 PostgreSQL-mode database, never production data. */
class ArtistCatalogControllerTest {
    private NamedParameterJdbcTemplate jdbc;
    private MockMvc mvc;
    @BeforeEach void setup() {
        jdbc = new NamedParameterJdbcTemplate(new DriverManagerDataSource(
                "jdbc:h2:mem:f6a_" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1", "sa", ""));
        jdbc.getJdbcTemplate().execute("""
                CREATE TABLE artist (artist_id BIGINT PRIMARY KEY, slug VARCHAR(100), name_ko VARCHAR(200),
                name_en VARCHAR(200), profile TEXT, image_url TEXT, official_url TEXT, instagram_url TEXT,
                youtube_url TEXT, x_url TEXT, approved_yn CHAR(1), sort_order INT)
                """);
        for (int i = 1; i <= 10; i++) jdbc.update(
                "INSERT INTO artist(artist_id,slug,name_ko,name_en,approved_yn,sort_order) VALUES (:id,:slug,:name,:en,'Y',:id)",
                Map.of("id", i, "slug", "artist-" + i, "name", "아티스트 " + i, "en", "Artist " + i));
        jdbc.update("INSERT INTO artist(artist_id,slug,name_ko,name_en,approved_yn,sort_order) VALUES(99,'hidden','숨김','Hidden','N',0)", Map.of());
        mvc = MockMvcBuilders.standaloneSetup(new ArtistCatalogController(new ArtistCatalogService(jdbc)),
                new KpopController(jdbc, mock(KpopAnalysisService.class), mock(KpopProductService.class), Runnable::run)).build();
    }
    @Test void anonymousPagesAreEightWideStableAndHaveAnAccurateTotal() throws Exception {
        mvc.perform(get("/api/v1/kpop/artists?page=1"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.items", hasSize(8))).andExpect(jsonPath("$.data.totalCount").value(10))
                .andExpect(jsonPath("$.data.items[0].id").value(1));
        mvc.perform(get("/api/v1/kpop/artists?page=2"))
                .andExpect(jsonPath("$.data.items", hasSize(2))).andExpect(jsonPath("$.data.items[0].id").value(9));
        mvc.perform(get("/api/v1/kpop/artists?page=3"))
                .andExpect(jsonPath("$.data.items", hasSize(0))).andExpect(jsonPath("$.data.totalCount").value(10));
    }
    @Test void searchTrimsSupportsKoreanAndEnglishAndDoesNotInterpretWildcards() throws Exception {
        for (String q : new String[]{"  ARTIST 9  ", "아티스트 9"}) mvc.perform(get("/api/v1/kpop/artists").param("page", "1").param("q", q))
                .andExpect(jsonPath("$.data.items[0].id").value(9)).andExpect(jsonPath("$.data.totalCount").value(1));
        for (String q : new String[]{"%", "not-found"}) mvc.perform(get("/api/v1/kpop/artists").param("page", "1").param("q", q))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalCount").value(0));
    }
    @Test void numericAndSlugProfilesAgreeWithoutLoadingEvents() throws Exception {
        for (String ref : new String[]{"9", "artist-9", "ARTIST-9"}) mvc.perform(get("/api/v1/kpop/artists/" + ref).param("view", "profile"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.id").value(9)).andExpect(jsonPath("$.data.events").doesNotExist());
    }
    @Test void hiddenAndMissingProfilesAre404AndApprovalWithdrawalIsImmediate() throws Exception {
        for (String ref : new String[]{"99", "hidden", "99999"}) mvc.perform(get("/api/v1/kpop/artists/" + ref).param("view", "profile"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/kpop/artists/9?view=profile")).andExpect(status().isOk());
        jdbc.update("UPDATE artist SET approved_yn='N' WHERE artist_id=9", Map.of());
        mvc.perform(get("/api/v1/kpop/artists/9?view=profile")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/kpop/artists").param("page","1").param("q","Artist 9"))
                .andExpect(jsonPath("$.data.totalCount").value(0));
    }
    @Test void invalidPagingAndLongQueriesAreBadRequests() throws Exception {
        for (String params : new String[]{"page=0", "page=-1", "page=1000001", "page=1&pageSize=0", "page=1&pageSize=51"})
            mvc.perform(get("/api/v1/kpop/artists?" + params)).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/kpop/artists").param("page", "1").param("q", "a".repeat(121)))
                .andExpect(status().isBadRequest());
    }
    @Test void existingUnpagedClientsKeepTheirArrayResponse() throws Exception {
        mvc.perform(get("/api/v1/kpop/artists?q=Artist"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data", hasSize(10)));
    }
}
