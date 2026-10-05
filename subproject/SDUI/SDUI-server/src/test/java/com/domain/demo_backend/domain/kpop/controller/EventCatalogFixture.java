package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.domain.kpop.service.*;
import com.domain.demo_backend.global.exception.GlobalExceptionHandler;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;
import static org.mockito.Mockito.mock;

/** Isolated test records; never loads application properties or production credentials. */
class EventCatalogFixture {
    final NamedParameterJdbcTemplate jdbc;
    final MockMvc mvc;
    EventCatalogFixture() { this(Clock.fixed(Instant.parse("2026-10-04T15:30:00Z"), ZoneOffset.UTC)); }
    EventCatalogFixture(Clock clock) {
        jdbc=new NamedParameterJdbcTemplate(new DriverManagerDataSource("jdbc:h2:mem:f6b_"+UUID.randomUUID()+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1","sa",""));
        jdbc.getJdbcTemplate().execute("CREATE TABLE artist(artist_id BIGINT PRIMARY KEY,name_ko VARCHAR(200),approved_yn CHAR(1))");
        jdbc.getJdbcTemplate().execute("CREATE TABLE event(event_id BIGINT PRIMARY KEY,artist_id BIGINT,title_ko VARCHAR(200),title_en VARCHAR(200),region VARCHAR(100),venue VARCHAR(200),event_date DATE,official_url VARCHAR(300),description TEXT,approved_yn CHAR(1))");
        jdbc.getJdbcTemplate().execute("CREATE TABLE artist_follow(artist_id BIGINT,user_sqno BIGINT,PRIMARY KEY(artist_id,user_sqno))");
        jdbc.update("INSERT INTO artist VALUES(1,'검증 아티스트','Y'),(2,'비공개 아티스트','N')",Map.of());
        add(1,1,"지난 서울 일정","서울","2026-10-04","Y");
        add(2,1,"오늘 서울 일정","서울","2026-10-05","Y");
        add(3,1,"부산 미래 일정","부산","2026-10-06","Y");
        add(4,1,"서울 미래 일정","서울","2026-10-07","Y");
        add(5,1,"미승인 이벤트","서울","2026-10-06","N");
        add(6,2,"미승인 아티스트 일정","서울","2026-10-06","Y");
        add(7,1,"서울특별시 별도 지역","서울특별시","2026-10-05","Y");
        mvc=MockMvcBuilders.standaloneSetup(new KpopController(jdbc,mock(KpopAnalysisService.class),mock(KpopProductService.class),Runnable::run,null,new EventCatalogService(jdbc,clock)))
                .setCustomArgumentResolvers(new org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver())
                .setControllerAdvice(new GlobalExceptionHandler(mock(OperationAlertService.class))).build();
    }
    private void add(int id,int artist,String title,String region,String date,String approval) {
        jdbc.update("INSERT INTO event VALUES(:id,:artist,:title,'Test event',:region,'검증 공연장',CAST(:date AS date),'https://example.com/event','격리 DB의 검증용 일정입니다.',:approval)",Map.of("id",id,"artist",artist,"title",title,"region",region,"date",date,"approval",approval));
    }
}
