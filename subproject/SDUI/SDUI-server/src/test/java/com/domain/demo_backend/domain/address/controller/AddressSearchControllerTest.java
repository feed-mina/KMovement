package com.domain.demo_backend.domain.address.controller;

import com.domain.demo_backend.domain.address.service.AddressSearchService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AddressSearchControllerTest {

    private AddressSearchService service;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        service = mock(AddressSearchService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new AddressSearchController(service)).build();
    }

    @Test
    @DisplayName("검색 결과를 모바일 계약으로 반환한다")
    void search_returnsItems() throws Exception {
        when(service.search("테헤란로 152")).thenReturn(List.of(Map.of(
                "zipCode", "06236",
                "roadAddress", "서울 강남구 테헤란로 152")));

        mockMvc.perform(get("/api/v1/address/search").param("keyword", "테헤란로 152"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].zipCode").value("06236"))
                .andExpect(jsonPath("$.items[0].roadAddress").value("서울 강남구 테헤란로 152"));
    }

    @Test
    @DisplayName("카카오 API 오류를 빈 목록과 502로 제한한다")
    void search_returnsBadGatewayWithoutLeakingDetails() throws Exception {
        when(service.search("테헤란로")).thenThrow(new IllegalStateException("upstream secret detail"));

        mockMvc.perform(get("/api/v1/address/search").param("keyword", "테헤란로"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.message").value("주소 검색에 실패했습니다."));
    }
}
