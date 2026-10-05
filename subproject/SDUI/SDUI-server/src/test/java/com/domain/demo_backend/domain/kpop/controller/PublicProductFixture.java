package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.*;
import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.global.exception.GlobalExceptionHandler;
import com.domain.demo_backend.global.observability.BackendOperationalTelemetry;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import redis.embedded.RedisServer;
import java.net.ServerSocket;
import java.time.Duration;
import java.util.*;
import static org.mockito.Mockito.mock;

/** Own ephemeral loopback Redis process and H2 database. No application/prod configuration is read. */
class PublicProductFixture implements AutoCloseable {
    final NamedParameterJdbcTemplate jdbc;
    final SimpleMeterRegistry meters=new SimpleMeterRegistry();
    final RedisServer redisServer;
    final LettuceConnectionFactory connection;
    final StringRedisTemplate redis;
    final MockMvc mvc;
    PublicProductFixture() throws Exception {
        int port;try(ServerSocket free=new ServerSocket(0)){port=free.getLocalPort();}
        redisServer=RedisServer.builder().bind("127.0.0.1").port(port).setting("maxmemory 32mb").setting("save \"\"").setting("appendonly no").build();
        redisServer.start();
        connection=new LettuceConnectionFactory(new RedisStandaloneConfiguration("127.0.0.1",port),
                LettuceClientConfiguration.builder().commandTimeout(Duration.ofMillis(300)).shutdownTimeout(Duration.ZERO).build());
        connection.afterPropertiesSet();redis=new StringRedisTemplate(connection);redis.afterPropertiesSet();
        jdbc=new NamedParameterJdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:f6c_"+UUID.randomUUID()+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa",""));
        jdbc.getJdbcTemplate().execute("CREATE TABLE product_candidate(product_candidate_id BIGINT PRIMARY KEY,artist_id BIGINT,event_id BIGINT,name VARCHAR(250),brand VARCHAR(100),approved_yn CHAR(1),catalog_source VARCHAR(40),evidence_grade VARCHAR(40),confidence INT,evidence_text TEXT,rights_checked BOOLEAN,last_verified_at TIMESTAMP,official_url TEXT,source_url TEXT)");
        add(1,"응원봉 후보","LIGHT","EXACT_CANDIDATE","제품 설명과 공식 품목 기록을 대조했습니다.",true,"https://example.com/products/1","Y","2026-10-01 10:15:00");
        add(2,"의상 유사 후보","STYLE","SIMILAR","디자인 특징이 비슷하지만 동일 상품은 확인하지 못했습니다.",false,"https://example.com/not-reviewed","Y","2026-10-02 13:20:00");
        add(3,"근거 부족 후보","WEAK","INSUFFICIENT_EVIDENCE","근거 부족",true,"https://example.com/weak","Y","2026-10-01 10:15:00");
        add(4,"확인 시각 없는 후보","WEAK","SIMILAR","설명 있음",true,"https://example.com/no-time","Y",null);
        add(5,"미승인 후보","HIDDEN","SIMILAR","설명 있음",true,"https://example.com/hidden","N","2026-10-01 10:15:00");
        add(6,"안전하지 않은 링크 후보","UNSAFE","SIMILAR","자료에 유사 디자인으로 기록됐습니다.",true,"javascript:alert(1)","Y","2026-10-02 13:20:00");
        add(7,"설명 없는 후보","WEAK","EXACT_CANDIDATE"," ",true,"https://example.com/empty","Y","2026-10-01 10:15:00");
        add(8,"출처 없는 후보","WEAK","SIMILAR","설명 있음",true,"https://example.com/empty","Y","2026-10-01 10:15:00");
        jdbc.update("UPDATE product_candidate SET catalog_source='' WHERE product_candidate_id=8",Map.of());
        jdbc.update("UPDATE product_candidate SET confidence=100 WHERE product_candidate_id IN(3,4,5,7,8)",Map.of());
        BackendOperationalTelemetry telemetry=new BackendOperationalTelemetry(meters);
        KpopCacheService cache=new KpopCacheService(redis,new ObjectMapper(),telemetry);
        PublicProductCatalogController controller=new PublicProductCatalogController(new PublicProductCatalogService(jdbc,cache,telemetry));
        mvc=MockMvcBuilders.standaloneSetup(controller,new KpopController(jdbc,mock(KpopAnalysisService.class),mock(KpopProductService.class),Runnable::run))
                .setControllerAdvice(new GlobalExceptionHandler(mock(OperationAlertService.class))).build();
    }
    private void add(int id,String name,String brand,String grade,String evidence,boolean rights,String url,String approval,String verified) {
        Map<String,Object> p=new LinkedHashMap<>();p.put("id",id);p.put("name",name);p.put("brand",brand);p.put("grade",grade);p.put("evidence",evidence);p.put("rights",rights);p.put("url",url);p.put("approval",approval);p.put("verified",verified);
        jdbc.update("INSERT INTO product_candidate VALUES(:id,1,2,:name,:brand,:approval,'MANUAL_CURATED',:grade,80,:evidence,:rights,CAST(:verified AS timestamp),:url,'https://internal.example/private-evidence')",p);
    }
    Map<String,Double> metrics() {
        Map<String,Double> result=new LinkedHashMap<>();
        for(String outcome:List.of("miss","hit","read_fallback","write_fallback","write","corrupt","db_search","db_revalidate")) {
            var counter=meters.find("kride.backend.operations").tag("event",outcome.startsWith("db_")?"kpop_public_products":"kpop_cache").tag("outcome",outcome).counter();
            result.put(outcome,counter==null?0d:counter.count());
        }
        return result;
    }
    public void close(){connection.destroy();if(redisServer.isActive())redisServer.stop();meters.close();}
}
