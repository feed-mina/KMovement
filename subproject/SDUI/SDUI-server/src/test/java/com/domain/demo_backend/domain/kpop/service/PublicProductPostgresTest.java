package com.domain.demo_backend.domain.kpop.service;

import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import java.sql.*;
import java.util.function.Supplier;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** CI-only disposable PostgreSQL database; temporary tables never touch production tables. */
@EnabledIfEnvironmentVariable(named="F6_POSTGRES_URL",matches=".+/f6_contract")
class PublicProductPostgresTest {
    Connection connection;
    PublicProductCatalogService service;
    @BeforeEach void setup() throws Exception {
        connection=DriverManager.getConnection(System.getenv("F6_POSTGRES_URL"),"f6_test","f6_test_only");
        try(var statement=connection.createStatement()) {
            statement.execute("""
                CREATE TEMP TABLE product_candidate (
                  product_candidate_id bigint,artist_id bigint,event_id bigint,name text,brand text,
                  approved_yn text,catalog_source text,evidence_grade text,confidence numeric,
                  evidence_text text,rights_checked boolean,last_verified_at timestamp,official_url text)
                """);
            statement.execute("""
                INSERT INTO product_candidate VALUES
                  (1,2,3,'Light stick','LIGHT','Y','MANUAL_CURATED','SIMILAR',80,'Catalog evidence',false,'2026-10-01 10:15:00',NULL),
                  (2,2,3,'Hidden','LIGHT','N','MANUAL_CURATED','SIMILAR',90,'Catalog evidence',true,'2026-10-01 10:15:00','https://example.com')
                """);
        }
        KpopCacheService cache=mock(KpopCacheService.class);
        when(cache.catalog(anyString(),anyMap(),any(),any(),any())).thenAnswer(call->((Supplier<?>)call.getArgument(4)).get());
        service=new PublicProductCatalogService(new NamedParameterJdbcTemplate(new SingleConnectionDataSource(connection,true)),cache,mock(BackendOperationalTelemetry.class));
    }
    @AfterEach void close() throws Exception {if(connection!=null)connection.close();}
    @Test void absentQueryUsesTypedNullsInEveryPostgresParameter() {
        assertThat(service.search(null,null,null,20)).extracting(x->x.get("id")).containsExactly(1L);
    }
    @Test void blankQueryAndOptionalIdsKeepThePublicPolicy() {
        assertThat(service.search("  ",2L,3L,20)).extracting(x->x.get("id")).containsExactly(1L);
    }
    @Test void caseInsensitiveBrandAndUnmatchedSearchKeepTheirMeaning() {
        assertThat(service.search(" light ",null,null,20)).hasSize(1);
        assertThat(service.search("no-match",null,null,20)).isEmpty();
    }
}
