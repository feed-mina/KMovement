package com.domain.demo_backend.domain.kpop.controller;

import com.domain.demo_backend.domain.kpop.service.PersonalSavedService;
import com.domain.demo_backend.global.security.CustomUserDetails;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PersonalSavedControllerTest {
    PersonalSavedService service;MockMvc mvc;
    @BeforeEach void setup(){service=mock(PersonalSavedService.class);mvc=MockMvcBuilders.standaloneSetup(new PersonalSavedController(service)).setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver()).build();}
    @AfterEach void clear(){SecurityContextHolder.clearContext();}
    @ParameterizedTest @ValueSource(strings={"artists","events","products"})
    void guestCannotUseAnyPersonalOperation(String kind) throws Exception {
        String path="/api/v1/kpop/me/saved/"+kind;
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(get(path+"/1")).andExpect(status().isUnauthorized());
        mvc.perform(post(path+"/1")).andExpect(status().isUnauthorized());
        mvc.perform(delete(path+"/1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }
    @ParameterizedTest @ValueSource(strings={"artists","events","products"})
    void allOperationsUsePrincipalAndIgnoreCallerSelectedOwner(String kind) throws Exception {
        var user=mock(CustomUserDetails.class);when(user.getUserSqno()).thenReturn(101L);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user,null,List.of()));
        when(service.page(kind,1,101L)).thenReturn(Map.of("items",List.of(),"totalCount",0));
        when(service.state(kind,1L,101L)).thenReturn(Map.of("saved",false));
        when(service.save(kind,1L,101L)).thenReturn(Map.of("saved",true));
        when(service.remove(kind,1L,101L)).thenReturn(Map.of("saved",false));
        String path="/api/v1/kpop/me/saved/"+kind;
        mvc.perform(get(path).param("userSqno","202")).andExpect(status().isOk()).andExpect(header().string("Cache-Control","private, no-store"));
        mvc.perform(get(path+"/1").param("userSqno","202")).andExpect(jsonPath("$.data.saved").value(false));
        mvc.perform(post(path+"/1").param("userSqno","202")).andExpect(jsonPath("$.data.saved").value(true));
        mvc.perform(delete(path+"/1").param("userSqno","202")).andExpect(jsonPath("$.data.saved").value(false));
        verify(service).page(kind,1,101L);verify(service).state(kind,1L,101L);verify(service).save(kind,1L,101L);verify(service).remove(kind,1L,101L);verifyNoMoreInteractions(service);
    }
}
