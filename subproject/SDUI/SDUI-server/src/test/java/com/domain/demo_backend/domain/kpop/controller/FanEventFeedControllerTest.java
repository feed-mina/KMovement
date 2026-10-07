package com.domain.demo_backend.domain.kpop.controller;
import com.domain.demo_backend.domain.kpop.service.*;
import com.domain.demo_backend.domain.kakao.service.OperationAlertService;
import com.domain.demo_backend.global.exception.GlobalExceptionHandler;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.*;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
class FanEventFeedControllerTest {
 EventCatalogFixture f; MockMvc mvc;
 @BeforeEach void setup(){f=new EventCatalogFixture();mvc=MockMvcBuilders.standaloneSetup(new FanEventFeedController(new FanEventFeedService(new EventCatalogService(f.jdbc,Clock.fixed(Instant.parse("2026-10-04T15:30:00Z"),ZoneOffset.UTC)),f.jdbc))).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).setControllerAdvice(new GlobalExceptionHandler(mock(OperationAlertService.class))).build();}
 @AfterEach void clear(){SecurityContextHolder.clearContext();}
 void login(long id){var u=mock(CustomUserDetails.class);when(u.getUserSqno()).thenReturn(id);SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(u,null,List.of()));}
 @Test void ownershipAndPublicAudienceCannotBeOverridden() throws Exception {
  mvc.perform(get("/api/v1/kpop/me/event-feed")).andExpect(status().isUnauthorized());
  f.jdbc.update("INSERT INTO artist_follow VALUES(1,100)",Map.of());login(100);
  mvc.perform(get("/api/v1/kpop/me/event-feed")).andExpect(jsonPath("$.data.totalCount").value(4)).andExpect(jsonPath("$.data.audience").value("mine")).andExpect(header().string("Cache-Control","private, no-store")).andExpect(header().string("Vary","Cookie, Authorization"));
  login(200);mvc.perform(get("/api/v1/kpop/me/event-feed?userSqno=100&artistId=1")).andExpect(jsonPath("$.data.totalCount").value(0));
  mvc.perform(get("/api/v1/kpop/event-feed")).andExpect(jsonPath("$.data.totalCount").value(4)).andExpect(jsonPath("$.data.audience").value("all"));
 }
 @Test void allFavoritesBeyondFiveAndPaginationCountAreComplete() throws Exception {
  for(int i=10;i<24;i++){f.jdbc.update("INSERT INTO artist VALUES(:i,'Favorite','Y')",Map.of("i",i));f.jdbc.update("INSERT INTO artist_follow VALUES(:i,100)",Map.of("i",i));f.jdbc.update("INSERT INTO event(event_id,artist_id,title_ko,region,event_date,approved_yn) VALUES(:i,:i,'Fixture','일본','2026-10-06','Y')",Map.of("i",i));}
  login(100);mvc.perform(get("/api/v1/kpop/me/event-feed?geography=overseas&countryCode=JP")).andExpect(jsonPath("$.data.artists",hasSize(14))).andExpect(jsonPath("$.data.items",hasSize(12))).andExpect(jsonPath("$.data.totalCount").value(14));
  mvc.perform(get("/api/v1/kpop/me/event-feed?page=2")).andExpect(jsonPath("$.data.items[*].id",contains(22,23)));
  mvc.perform(get("/api/v1/kpop/me/event-feed?artistId=23")).andExpect(jsonPath("$.data.items[0].id").value(23));
 }
 @Test void locationIsExactAndUnknownIsNeverOverseas(){
  for(String region:List.of("서울","경기도","제주특별자치도"))org.assertj.core.api.Assertions.assertThat(FanEventFeedService.location(region).get("geography")).isEqualTo("domestic");
  org.assertj.core.api.Assertions.assertThat(FanEventFeedService.location("온라인").get("geography")).isEqualTo("online");
  for(String region:List.of("","서울/도쿄","미정","Tokyo"))org.assertj.core.api.Assertions.assertThat(FanEventFeedService.location(region).get("geography")).isEqualTo("unknown");
 }
 @Test void filtersRejectInvalidAndApprovalChangesApplyImmediately() throws Exception {
  for(String q:List.of("page=0","page=100001","artistId=-1","countryCode=JP","geography=overseas&countryCode=ZZ","from=2026-02-30","from=2026-10-07&to=2026-10-06"))mvc.perform(get("/api/v1/kpop/event-feed?"+q)).andExpect(status().isBadRequest());
  mvc.perform(get("/api/v1/kpop/event-feed?geography=domestic")).andExpect(jsonPath("$.data.counts.domestic").value(4)).andExpect(jsonPath("$.data.items[*].id",contains(2,7,3,4)));
  f.jdbc.update("UPDATE artist SET approved_yn='N' WHERE artist_id=1",Map.of());mvc.perform(get("/api/v1/kpop/event-feed")).andExpect(jsonPath("$.data.totalCount").value(0));
 }
}
