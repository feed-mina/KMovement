package com.domain.demo_backend.domain.kpop.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EventCatalogControllerTest {
    EventCatalogFixture f;
    @BeforeEach void setup(){f=new EventCatalogFixture();}
    @Test void b01StartOnlyIsInclusiveAndKeepsArrayContract() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/events").param("from","2026-10-06"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[*].id",contains(3,4)))
                .andExpect(header().string("Cache-Control","no-store"))
                .andExpect(header().string("X-Kpop-Today","2026-10-05"))
                .andExpect(header().string("X-Kpop-Time-Zone","Asia/Seoul"));
    }
    @Test void b02EndOnlyUsesKoreanTodayAndRejectsPastEndAndReversedRanges() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/events").param("to","2026-10-05"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[*].id",contains(2,7)));
        f.mvc.perform(get("/api/v1/kpop/events?to=2026-10-04")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("HTTP_400"));
        f.mvc.perform(get("/api/v1/kpop/events?from=2026-10-06&to=2026-10-05")).andExpect(status().isBadRequest());
        f.mvc.perform(get("/api/v1/kpop/events?from=2026-10-04&to=2026-10-04"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].ended").value(true));
    }
    @Test void b03RegionTrimsButDoesNotPartiallyMatchAndBlankResets() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/events").param("region"," 서울 "))
                .andExpect(jsonPath("$.data[*].id",contains(2,4)));
        f.mvc.perform(get("/api/v1/kpop/events").param("region","서"))
                .andExpect(jsonPath("$.data",hasSize(0)));
        f.mvc.perform(get("/api/v1/kpop/events").param("region","  "))
                .andExpect(jsonPath("$.data",hasSize(4)));
    }
    @Test void b04DetailMatchesListAndMissingOrUnapprovedIs404() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/events/2"))
                .andExpect(jsonPath("$.data.titleKo").value("오늘 서울 일정"))
                .andExpect(jsonPath("$.data.date").value("2026-10-05"))
                .andExpect(jsonPath("$.data.ended").value(false));
        for(int id:new int[]{5,6,999})f.mvc.perform(get("/api/v1/kpop/events/"+id)).andExpect(status().isNotFound());
    }
    @Test void b05MidnightChangesAtSeoulMidnightRegardlessOfHostTimezone() throws Exception {
        EventCatalogFixture before=new EventCatalogFixture(Clock.fixed(Instant.parse("2026-10-04T14:59:59Z"),ZoneOffset.ofHours(-7)));
        before.mvc.perform(get("/api/v1/kpop/events"))
                .andExpect(header().string("X-Kpop-Today","2026-10-04"))
                .andExpect(jsonPath("$.data[0].id").value(1)).andExpect(jsonPath("$.data[0].ended").value(false));
        EventCatalogFixture midnight=new EventCatalogFixture(Clock.fixed(Instant.parse("2026-10-04T15:00:00Z"),ZoneOffset.ofHours(-7)));
        midnight.mvc.perform(get("/api/v1/kpop/events"))
                .andExpect(header().string("X-Kpop-Today","2026-10-05"))
                .andExpect(jsonPath("$.data[*].id",contains(2,7,3,4)));
        f.mvc.perform(get("/api/v1/kpop/events"))
                .andExpect(jsonPath("$.data[*].id",contains(2,7,3,4)));
        f.mvc.perform(get("/api/v1/kpop/events/1"))
                .andExpect(jsonPath("$.data.ended").value(true));
    }
    @Test void b06EmptyPeriodAndNoUpcomingAreSuccessfulEmptyArrays() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/events?from=2026-11-01&to=2026-11-30"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data",hasSize(0)));
        f.jdbc.update("UPDATE event SET approved_yn='N'",Map.of());
        f.mvc.perform(get("/api/v1/kpop/events"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data",hasSize(0)));
    }
    @Test void artistAndEventApprovalAreRecheckedImmediatelyWithoutCatalogCache() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/events/2")).andExpect(status().isOk());
        f.jdbc.update("UPDATE artist SET approved_yn='N' WHERE artist_id=1",Map.of());
        f.mvc.perform(get("/api/v1/kpop/events/2")).andExpect(status().isNotFound());
        f.mvc.perform(get("/api/v1/kpop/events")).andExpect(jsonPath("$.data",hasSize(0)));
    }
    @Test void invalidCalendarDatesAndOverlongRegionAre400NotSqlErrors() throws Exception {
        for(String value:new String[]{"2026-02-30","2025-02-29","0000-01-01","2026-1-1","garbage"})
            f.mvc.perform(get("/api/v1/kpop/events").param("from",value)).andExpect(status().isBadRequest());
        f.mvc.perform(get("/api/v1/kpop/events").param("region","가".repeat(101))).andExpect(status().isBadRequest());
    }
    @Test void legacySduiFallbackAlsoChecksArtistApprovalAndStopsCaching() throws Exception {
        f.jdbc.getJdbcTemplate().execute("CREATE TABLE query_master(sql_key VARCHAR(100),query_text TEXT,use_redis_yn CHAR(1),updated_at TIMESTAMP)");
        for(String key:new String[]{"kpop_event_cards","kpop_event_detail"})f.jdbc.update(
                "INSERT INTO query_master VALUES(:key,:sql,'Y',CURRENT_TIMESTAMP)",Map.of("key",key,"sql","SELECT e.event_id FROM event e JOIN artist a ON a.artist_id=e.artist_id WHERE e.approved_yn = 'Y'"));
        String migration=new String(getClass().getResourceAsStream("/db/migration/V120__align_legacy_event_artist_approval.sql").readAllBytes(),java.nio.charset.StandardCharsets.UTF_8);
        f.jdbc.getJdbcTemplate().execute(migration);
        f.jdbc.getJdbcTemplate().execute(migration);
        for(Map<String,Object> row:f.jdbc.queryForList("SELECT * FROM query_master",Map.of())) {
            org.assertj.core.api.Assertions.assertThat(row.get("use_redis_yn")).isEqualTo("N");
            org.assertj.core.api.Assertions.assertThat(row.get("query_text").toString()).containsOnlyOnce("a.approved_yn = 'Y'");
            org.assertj.core.api.Assertions.assertThat(f.jdbc.queryForList(row.get("query_text").toString(),Map.of())).hasSize(5);
        }
    }
}
