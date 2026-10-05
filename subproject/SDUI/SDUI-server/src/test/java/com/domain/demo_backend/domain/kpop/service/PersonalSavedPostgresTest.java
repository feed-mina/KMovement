package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.domain.kpop.controller.PersonalSavedController;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.sql.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real PostgreSQL and MVC requests, disposable connection-local tables only. */
@EnabledIfEnvironmentVariable(named="F6_POSTGRES_URL",matches=".+/f6_contract")
class PersonalSavedPostgresTest {
    Connection connection;
    PersonalSavedService service;
    MockMvc mvc;
    String url(String kind) {return "/api/v1/kpop/me/saved/"+kind;}
    void sql(String value) throws Exception {try(var s=connection.createStatement()){s.execute(value);}}
    void user(long id) {
        var principal=mock(CustomUserDetails.class);when(principal.getUserSqno()).thenReturn(id);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal,null,List.of()));
    }
    @BeforeEach void setup() throws Exception {
        connection=DriverManager.getConnection(System.getenv("F6_POSTGRES_URL"),"f6_test","f6_test_only");
        sql("CREATE TEMP TABLE artist(artist_id bigint PRIMARY KEY,approved_yn text,name_ko text,name_en text)");
        sql("CREATE TEMP TABLE event(event_id bigint PRIMARY KEY,artist_id bigint,approved_yn text,title_ko text,title_en text)");
        sql("CREATE TEMP TABLE product_candidate(product_candidate_id bigint PRIMARY KEY,approved_yn text,name text)");
        sql("CREATE TEMP TABLE artist_follow(artist_follow_id bigserial PRIMARY KEY,user_sqno bigint,artist_id bigint,created_at timestamp DEFAULT now(),UNIQUE(user_sqno,artist_id))");
        sql("CREATE TEMP TABLE event_bookmark(event_bookmark_id bigserial PRIMARY KEY,user_sqno bigint,event_id bigint,created_at timestamp DEFAULT now(),UNIQUE(user_sqno,event_id))");
        sql("CREATE TEMP TABLE saved_item(saved_item_id bigserial PRIMARY KEY,user_sqno bigint,item_type text,item_ref bigint,created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now(),UNIQUE(user_sqno,item_type,item_ref))");
        // Execute the shipped view/index migration, replacing only view scope with TEMP.
        var migration=new ClassPathResource("db/migration/V121__personal_saved_visibility.sql");
        sql(new String(migration.getInputStream().readAllBytes(),StandardCharsets.UTF_8).replace("CREATE OR REPLACE VIEW","CREATE TEMP VIEW"));
        sql("INSERT INTO artist SELECT n,'Y','Artist '||n,NULL FROM generate_series(1,106) n");
        sql("INSERT INTO event SELECT n,1,'Y','Event '||n,NULL FROM generate_series(1,106) n");
        sql("INSERT INTO product_candidate SELECT n,'Y','Product '||n FROM generate_series(1,106) n");
        service=new PersonalSavedService(new NamedParameterJdbcTemplate(new SingleConnectionDataSource(connection,true)));
        mvc=MockMvcBuilders.standaloneSetup(new PersonalSavedController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).alwaysDo(org.springframework.test.web.servlet.result.MockMvcResultHandlers.print()).build();
        user(101);
    }
    @AfterEach void close() throws Exception {SecurityContextHolder.clearContext();if(connection!=null)connection.close();}

    @ParameterizedTest @ValueSource(strings={"artists","events","products"})
    void sixStepLifecycleAndOtherOwnerIsolation(String kind) throws Exception {
        var first=mvc.perform(post(url(kind)+"/1")).andExpect(status().isOk()).andExpect(jsonPath("$.data.saved").value(true)).andReturn().getResponse().getContentAsString();
        var duplicate=mvc.perform(post(url(kind)+"/1")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        // Response timestamps vary per request; idempotency concerns the saved record.
        var json = new com.fasterxml.jackson.databind.ObjectMapper();
        assertThat(json.readTree(duplicate).get("data")).isEqualTo(json.readTree(first).get("data"));
        mvc.perform(get(url(kind))).andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store")).andExpect(jsonPath("$.data.totalCount").value(1)).andExpect(jsonPath("$.data.items[0].visibility").value("PUBLIC"));
        mvc.perform(delete(url(kind)+"/1")).andExpect(status().isOk()).andExpect(jsonPath("$.data.saved").value(false));
        mvc.perform(get(url(kind))).andExpect(jsonPath("$.data.totalCount").value(0)).andExpect(jsonPath("$.data.items").isEmpty());
        service.save(kind,1L,101L);user(202);
        mvc.perform(get(url(kind)).param("userSqno","101")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items").isEmpty());
        mvc.perform(get(url(kind)+"/1")).andExpect(jsonPath("$.data.saved").value(false));
        mvc.perform(delete(url(kind)+"/1")).andExpect(status().isOk());
        assertThat(service.page(kind,1,101L).get("totalCount")).isEqualTo(1L);
        System.out.println("F8 "+kind+" 01 create 02 duplicate 03 own-list 04 delete 05 empty 06 other-owner: PASS");
    }
    @ParameterizedTest @ValueSource(strings={"artists","events","products"})
    void revokedApprovalRetainsPrivateRecordBlocksNewSaveAndRestores(String kind) throws Exception {
        service.save(kind,1L,101L);
        String table=kind.equals("artists")?"artist":kind.equals("events")?"event":"product_candidate";
        sql("UPDATE "+table+" SET approved_yn='N'");
        mvc.perform(get(url(kind))).andExpect(jsonPath("$.data.items[0].visibility").value("PRIVATE")).andExpect(jsonPath("$.data.items[0].title").value("비공개 항목"));
        mvc.perform(post(url(kind)+"/1")).andExpect(status().isNotFound());
        mvc.perform(post(url(kind)+"/2")).andExpect(status().isNotFound());
        sql("UPDATE "+table+" SET approved_yn='Y'");
        mvc.perform(get(url(kind))).andExpect(jsonPath("$.data.items[0].visibility").value("PUBLIC"));
        sql("UPDATE "+table+" SET approved_yn='N'");
        mvc.perform(delete(url(kind)+"/1")).andExpect(status().isOk());
    }
    @ParameterizedTest @ValueSource(strings={"artists","events","products"})
    void moreThan100ItemsUseFivePerPageAndClampAfterDeletion(String kind) throws Exception {
        for(long n=1;n<=106;n++)service.save(kind,n,101L);
        mvc.perform(get(url(kind))).andExpect(jsonPath("$.data.totalCount").value(106)).andExpect(jsonPath("$.data.items.length()").value(5));
        mvc.perform(get(url(kind)).param("page","22")).andExpect(jsonPath("$.data.items.length()").value(1));
        service.remove(kind,1L,101L);
        mvc.perform(get(url(kind)).param("page","22")).andExpect(jsonPath("$.data.page").value(21)).andExpect(jsonPath("$.data.items.length()").value(5));
        mvc.perform(get(url(kind)).param("page","0")).andExpect(status().isBadRequest());
    }
    @Test void parentArtistRevocationHidesEvent() throws Exception {
        service.save("events",1L,101L);sql("UPDATE artist SET approved_yn='N' WHERE artist_id=1");
        mvc.perform(get(url("events"))).andExpect(jsonPath("$.data.items[0].visibility").value("PRIVATE"));
        mvc.perform(post(url("events")+"/2")).andExpect(status().isNotFound());
    }
    @Test void guestCannotReadCreateOrDelete() throws Exception {
        SecurityContextHolder.clearContext();
        mvc.perform(get(url("artists"))).andExpect(status().isUnauthorized());
        mvc.perform(get(url("artists")+"/1")).andExpect(status().isUnauthorized());
        mvc.perform(post(url("artists")+"/1")).andExpect(status().isUnauthorized());
        mvc.perform(delete(url("artists")+"/1")).andExpect(status().isUnauthorized());
    }
}
