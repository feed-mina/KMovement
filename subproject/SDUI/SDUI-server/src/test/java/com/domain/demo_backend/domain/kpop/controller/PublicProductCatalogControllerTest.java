package com.domain.demo_backend.domain.kpop.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PublicProductCatalogControllerTest {
    PublicProductFixture f;
    @BeforeEach void setup() throws Exception {f=new PublicProductFixture();}
    @AfterEach void cleanup(){if(f!=null)f.close();}
    @Test void c01PostgresNameBrandSearchTrimsAndRejects121CharactersBeforeCache() throws Exception {
        for(String q:List.of(" 응원봉 "," light "))f.mvc.perform(get("/api/v1/kpop/product-candidates").param("view","public").param("q",q))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(1));
        var before=f.metrics();
        f.mvc.perform(get("/api/v1/kpop/product-candidates").param("view","public").param("q","a".repeat(121)))
                .andExpect(status().isBadRequest());
        assertThat(f.metrics()).isEqualTo(before);
        f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public&artistId=1&eventId=2&limit=1"))
                .andExpect(jsonPath("$.data",hasSize(1))).andExpect(jsonPath("$.data[0].id").value(6));
        f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public&artistId=99"))
                .andExpect(jsonPath("$.data",hasSize(0)));
    }
    @Test void c02ProjectionRetainsEvidenceSourceTimeAndNeverExposesInternalSource() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control","no-store"))
                .andExpect(jsonPath("$.data[*].id",contains(6,2,1)))
                .andExpect(jsonPath("$.data[2].catalogSource").value("MANUAL_CURATED"))
                .andExpect(jsonPath("$.data[2].lastVerifiedAt",startsWith("2026-10-01 10:15")))
                .andExpect(jsonPath("$.data[2].evidenceText",not(emptyString())))
                .andExpect(jsonPath("$.data[1].rightsChecked").value(false))
                .andExpect(jsonPath("$.data[1].officialUrl").isEmpty())
                .andExpect(jsonPath("$.data[0].sourceUrl").doesNotExist());
    }
    @Test void c03InsufficientAndUnmatchedBothReturnSuccessfulEmptyWithoutInventingCandidates() throws Exception {
        for(String q:List.of("WEAK","no-match","HIDDEN"))f.mvc.perform(get("/api/v1/kpop/product-candidates").param("view","public").param("q",q))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data",hasSize(0)));
    }
    @Test void c04c05RealRedisMissHitAndStoppedRedisFallbackHaveMeasuredDbCounts() throws Exception {
        List<Map<String,Object>> evidence=new ArrayList<>();
        String url="/api/v1/kpop/product-candidates?view=public&q=LIGHT";
        for(String stage:List.of("miss","hit","fallback")) {
            if(stage.equals("fallback"))f.redisServer.stop();
            Map<String,Double> before=f.metrics();
            var response=f.mvc.perform(get(url)).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].id").value(1)).andReturn().getResponse();
            Map<String,Double> after=f.metrics(),delta=new LinkedHashMap<>();after.forEach((k,v)->delta.put(k,v-before.get(k)));
            evidence.add(Map.of("stage",stage,"request","GET "+url,"status",response.getStatus(),"body",new ObjectMapper().readTree(response.getContentAsByteArray()),"before",before,"after",after,"delta",delta));
            assertThat(delta.get("db_search")).isEqualTo(stage.equals("hit")?0d:1d);
            assertThat(delta.get("db_revalidate")).isEqualTo(1d);
            assertThat(delta.get(stage.equals("fallback")?"read_fallback":stage)).isEqualTo(1d);
            if(stage.equals("fallback"))assertThat(delta.get("write_fallback")).isEqualTo(1d);
        }
        String dir=System.getenv("F6C_EVIDENCE_DIR");
        if(dir!=null){Files.createDirectories(Path.of(dir));new ObjectMapper().writerWithDefaultPrettyPrinter().writeValue(Path.of(dir,"cache-metrics.json").toFile(),evidence);}
    }
    @Test void c06OnlyReviewedHttpsDomainLinksLeaveTheApi() throws Exception {
        for(String url:List.of("http://example.com","javascript:alert(1)","https://u:p@example.com","https://127.0.0.1/","https://example.com:444/","https://private.local/")) {
            f.jdbc.update("UPDATE product_candidate SET official_url=:url WHERE product_candidate_id=1",Map.of("url",url));
            f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public&q=LIGHT"))
                    .andExpect(jsonPath("$.data[0].officialUrl").isEmpty());
        }
    }
    @Test void hitRechecksRevokedRightsApprovalAndEvidenceInsteadOfTrustingCachedMetadata() throws Exception {
        String url="/api/v1/kpop/product-candidates?view=public&q=LIGHT";
        f.mvc.perform(get(url)).andExpect(jsonPath("$.data[0].officialUrl").value("https://example.com/products/1"));
        f.jdbc.update("UPDATE product_candidate SET rights_checked=FALSE WHERE product_candidate_id=1",Map.of());
        f.mvc.perform(get(url)).andExpect(jsonPath("$.data[0].officialUrl").isEmpty());
        f.jdbc.update("UPDATE product_candidate SET approved_yn='N' WHERE product_candidate_id=1",Map.of());
        f.mvc.perform(get(url)).andExpect(jsonPath("$.data",hasSize(0)));
        assertThat(f.metrics().get("hit")).isEqualTo(2d);
    }
    @Test void negativeCacheAndNullSentinelStayDistinctAndInputsRemainBounded() throws Exception {
        f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public&q=%3Cnull%3E")).andExpect(jsonPath("$.data",hasSize(0)));
        f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public")).andExpect(jsonPath("$.data",hasSize(3)));
        for(String value:List.of("artistId=0","eventId=-1","limit=0"))f.mvc.perform(get("/api/v1/kpop/product-candidates?view=public&"+value)).andExpect(status().isBadRequest());
    }
}
