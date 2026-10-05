package com.domain.demo_backend.domain.tour.service;

import com.domain.demo_backend.domain.user.domain.User;
import com.domain.demo_backend.domain.user.domain.UserRepository;
import com.domain.demo_backend.domain.token.domain.RefreshTokenRepository;
import com.domain.demo_backend.global.security.CustomUserDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Full application security + JPA transactions + actual migrations in a disposable CI database. */
@SpringBootTest(properties={"jwt.secret=test_secret_key_must_be_at_least_32_bytes_long_for_security","jwt.expiration=3600000","jwt.refresh-token.expiration=86400000"})
@AutoConfigureMockMvc(print=org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint.SYSTEM_OUT,printOnlyOnFailure=false)
@ActiveProfiles("test")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DirtiesContext(classMode=DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named="F6_POSTGRES_URL",matches=".+/f6_contract")
class HolyWorkflowPostgresTest {
    private static final String SCHEMA="f9_"+UUID.randomUUID().toString().replace("-","");
    @DynamicPropertySource static void postgres(DynamicPropertyRegistry registry) {
        String base=System.getenv("F6_POSTGRES_URL");
        if(base==null||!base.endsWith("/f6_contract"))throw new IllegalStateException("Disposable CI database required");
        // Legacy migrations inspect information_schema without schema qualification.
        // A separate database prevents prior test schemas affecting those checks.
        try(var connection=java.sql.DriverManager.getConnection(base,"f6_test","f6_test_only");var statement=connection.createStatement()) {
            statement.execute("CREATE DATABASE "+SCHEMA);
        } catch(java.sql.SQLException e) { throw new IllegalStateException("Cannot create isolated F9 test database",e); }
        String url=base.substring(0,base.lastIndexOf('/')+1)+SCHEMA;
        Flyway.configure().dataSource(url,"f6_test","f6_test_only").locations("classpath:db/migration").load().migrate();
        registry.add("spring.datasource.url",()->url);
        registry.add("spring.datasource.username",()->"f6_test");
        registry.add("spring.datasource.password",()->"f6_test_only");
        registry.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
        registry.add("spring.jpa.hibernate.ddl-auto",()->"none");
        registry.add("spring.flyway.enabled",()->"false");
    }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @MockBean RefreshTokenRepository refreshTokenRepository;
    CustomUserDetails member,admin;
    @BeforeAll void identities() {
        member=new CustomUserDetails(account("f9-member","ROLE_USER"));
        admin=new CustomUserDetails(account("f9-admin","ROLE_ADMIN"));
    }
    User account(String id,String role) {
        return users.save(User.builder().userId(id).email(id+"@example.test").hashedPassword("test-only")
                .role(role).phone("010-0000-0000").zipCode("12345").roadAddress("서울특별시 성동구")
                .delYn("N").verifyYn("Y").socialType("N").build());
    }
    String body(String source) throws Exception {
        return json.writeValueAsString(Map.of("title","F9 검증 장소","addr","서울특별시 성동구 테스트로 1","mapX",127.04,"mapY",37.54,"artist","BTS","recommendReason","공개 출처 확인","sourceUrl",source));
    }
    long submit(String source) throws Exception {
        String response=mvc.perform(post("/api/v1/tour/holy/submissions").with(user(member)).contentType("application/json").content(body(source)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.reviewStatus").value("PENDING"))
                .andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return json.readTree(response).path("data").path("poiSqno").asLong();
    }
    @Test void f9A01ThroughC02_submissionReviewAuditAndPublicMapCoordinates() throws Exception {
        String source="https://example.test/f9/lifecycle";
        mvc.perform(post("/api/v1/tour/holy/submissions").contentType("application/json").content(body(source))).andExpect(status().isUnauthorized());
        long rejected=submit(source);
        mvc.perform(post("/api/v1/tour/holy/submissions").with(user(member)).contentType("application/json").content(body(source))).andExpect(status().isConflict());
        mvc.perform(get("/api/v1/tour/holy").param("areaCode","1")).andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.sourceUrl == '"+source+"')]").isEmpty());
        mvc.perform(get("/api/admin/tour/holy/pending").with(user(member))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/tour/holy/pending").with(user(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.data[?(@.poiSqno == "+rejected+")]").isNotEmpty());
        mvc.perform(post("/api/admin/tour/holy/"+rejected+"/review").with(user(admin)).contentType("application/json").content("{\"action\":\"REJECT\"}")).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select review_status from tour_poi where poi_sqno=?",String.class,rejected)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("select count(*) from holy_review_audit where poi_sqno=?",Integer.class,rejected)).isZero();
        mvc.perform(post("/api/admin/tour/holy/"+rejected+"/review").with(user(admin)).contentType("application/json").content("{\"action\":\"REJECT\",\"reason\":\"출처 확인이 필요합니다\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.reviewStatus").value("REJECTED")).andExpect(jsonPath("$.data.reviewReason").value("출처 확인이 필요합니다"));
        mvc.perform(get("/api/admin/tour/holy/"+rejected+"/audit").with(user(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.data[0].reason").value("출처 확인이 필요합니다"));
        long approved=submit(source);assertThat(approved).isNotEqualTo(rejected);
        mvc.perform(post("/api/admin/tour/holy/"+approved+"/review").with(user(member)).contentType("application/json").content("{\"action\":\"APPROVE\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/tour/holy/"+approved+"/review").with(user(admin)).contentType("application/json").content("{\"action\":\"APPROVE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.reviewStatus").value("APPROVED")).andExpect(jsonPath("$.data.reviewedBy").value("user:"+admin.getUserSqno())).andExpect(jsonPath("$.data.reviewedAt").isNotEmpty());
        String publicBody=mvc.perform(get("/api/v1/tour/holy").param("areaCode","1")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        var places=json.readTree(publicBody).path("data");var matching=new ArrayList<com.fasterxml.jackson.databind.JsonNode>();places.forEach(p->{if(source.equals(p.path("sourceUrl").asText()))matching.add(p);});
        assertThat(matching).hasSize(1);var place=matching.get(0);
        assertThat(place.path("mapX").asDouble()).isEqualTo(127.04);assertThat(place.path("mapY").asDouble()).isEqualTo(37.54);
        assertThat(place.path("addr").asText()).isEqualTo("서울특별시 성동구 테스트로 1");assertThat(place.path("contentId").asText()).startsWith("ugc-");
        assertThat(place.has("submittedBy")).isFalse();assertThat(place.has("reviewReason")).isFalse();
        mvc.perform(post("/api/v1/tour/holy/submissions").with(user(member)).contentType("application/json").content(body(source))).andExpect(status().isConflict());
        mvc.perform(post("/api/admin/tour/holy/"+approved+"/review").with(user(admin)).contentType("application/json").content("{\"action\":\"REJECT\",\"reason\":\"다시 검수\"}")).andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("select count(*) from holy_review_audit where poi_sqno=?",Integer.class,approved)).isEqualTo(1);
        System.out.println("F9-A01 A02 A03 A04 B01 B02 B03 C01 C02: PASS (actual PostgreSQL, full security filters, test principals; external map SDK not exercised)");
    }

    @Test void concurrentDuplicateSubmissionAndReviewHaveOneWinner() throws Exception {
        String source="https://example.test/f9/concurrent", payload=body(source);
        var pool=java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var start=new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Integer> submit=()->{start.await();return mvc.perform(post("/api/v1/tour/holy/submissions").with(user(member)).contentType("application/json").content(payload)).andReturn().getResponse().getStatus();};
            var a=pool.submit(submit);var b=pool.submit(submit);start.countDown();
            assertThat(List.of(a.get(30,java.util.concurrent.TimeUnit.SECONDS),b.get(30,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(201,409);
            Long id=jdbc.queryForObject("select poi_sqno from tour_poi where source='UGC' and source_url=?",Long.class,source);
            java.util.concurrent.Callable<Integer> approve=()->mvc.perform(post("/api/admin/tour/holy/"+id+"/review").with(user(admin)).contentType("application/json").content("{\"action\":\"APPROVE\"}")).andReturn().getResponse().getStatus();
            var c=pool.submit(approve);var d=pool.submit(approve);
            assertThat(List.of(c.get(30,java.util.concurrent.TimeUnit.SECONDS),d.get(30,java.util.concurrent.TimeUnit.SECONDS))).containsExactlyInAnyOrder(200,400);
            assertThat(jdbc.queryForObject("select count(*) from holy_review_audit where poi_sqno=?",Integer.class,id)).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
}

