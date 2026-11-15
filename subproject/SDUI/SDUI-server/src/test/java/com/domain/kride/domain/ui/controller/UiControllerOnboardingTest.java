package com.domain.kride.domain.ui.controller;

import com.domain.kride.domain.ui.dto.UiResponseDto;
import com.domain.kride.domain.ui.service.UiService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * UiController 온보딩 화면 통합 테스트
 *
 * 검증 대상:
 *   GET /api/ui/INTRO2  ─ 아티스트 선택 화면 (FastAPI /api/artists 데이터를 소비)
 *   GET /api/ui/INTRO3  ─ 지역 선택 화면   (FastAPI /api/regions 데이터를 소비)
 *   GET /api/ui/FOCUS   ─ 일정 화면        (FastAPI /api/recommend/itinerary 데이터를 소비)
 *
 * Spring Boot 는 UI 메타데이터(componentType, labelText 등)만 반환하고
 * 실제 아티스트/지역 목록은 FastAPI 가 담당한다.
 * 이 테스트는 "Spring Boot 가 올바른 스키마로 메타데이터를 내려주는가"를 검증한다.
 *
 * 실행:
 *   ./gradlew test --tests "UiControllerOnboardingTest"
 */
@SpringBootTest(properties = {
        "openai.api-key=test-key",
        "openai.model=gpt-4o",
        "openai.whisper-model=whisper-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("UiController 온보딩 화면 통합 테스트")
class UiControllerOnboardingTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UiService uiService;

    // ── fixture ────────────────────────────────────────────────────────────

    private UiResponseDto dto(String id, String type, String label) {
        UiResponseDto d = new UiResponseDto();
        d.setComponentId(id);
        d.setComponentType(type);
        d.setLabelText(label);
        d.setSortOrder(1);
        return d;
    }

    // ════════════════════════════════════════════════════════════════════════
    // 1. INTRO2 — 아티스트 선택 화면
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("INTRO2: 200 OK + ApiResponse 성공 구조 반환")
    void intro2_returns_200() throws Exception {
        when(uiService.getUiTree(eq("INTRO2"), anyString()))
                .thenReturn(List.of(dto("A1", "IMAGE_GRID", "아티스트 선택")));

        mockMvc.perform(get("/api/ui/INTRO2")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("INTRO2: data 배열에 componentType 필드 포함")
    void intro2_data_has_component_type() throws Exception {
        when(uiService.getUiTree(eq("INTRO2"), anyString()))
                .thenReturn(List.of(dto("A1", "IMAGE_GRID", "아티스트 선택")));

        mockMvc.perform(get("/api/ui/INTRO2")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.data[0].componentType").value("IMAGE_GRID"));
    }

    @Test
    @DisplayName("INTRO2: UiService 가 비어 있으면 data 배열도 비어야 함")
    void intro2_empty_metadata() throws Exception {
        when(uiService.getUiTree(eq("INTRO2"), anyString()))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/ui/INTRO2")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    @DisplayName("INTRO2: 인증 없이도 200 OK (게스트 허용)")
    void intro2_allows_unauthenticated() throws Exception {
        when(uiService.getUiTree(eq("INTRO2"), anyString()))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/ui/INTRO2")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk());
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. INTRO3 — 지역 선택 화면
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("INTRO3: 200 OK + data 배열 반환")
    void intro3_returns_200() throws Exception {
        when(uiService.getUiTree(eq("INTRO3"), anyString()))
                .thenReturn(List.of(dto("B1", "IMAGE_GRID", "지역 선택")));

        mockMvc.perform(get("/api/ui/INTRO3")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("INTRO3: componentType=IMAGE_GRID 메타데이터 반환")
    void intro3_data_has_image_grid() throws Exception {
        when(uiService.getUiTree(eq("INTRO3"), anyString()))
                .thenReturn(List.of(dto("B1", "IMAGE_GRID", "지역 선택")));

        mockMvc.perform(get("/api/ui/INTRO3")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.data[0].componentType").value("IMAGE_GRID"))
                .andExpect(jsonPath("$.data[0].labelText").value("지역 선택"));
    }

    @Test
    @DisplayName("INTRO3: sortOrder 필드 포함")
    void intro3_data_has_sort_order() throws Exception {
        when(uiService.getUiTree(eq("INTRO3"), anyString()))
                .thenReturn(List.of(dto("B1", "IMAGE_GRID", "지역 선택")));

        mockMvc.perform(get("/api/ui/INTRO3")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.data[0].sortOrder").isNumber());
    }

    @Test
    @DisplayName("INTRO3: 복수 컴포넌트 정상 반환")
    void intro3_multiple_components() throws Exception {
        when(uiService.getUiTree(eq("INTRO3"), anyString()))
                .thenReturn(List.of(
                        dto("B1", "TEXT",       "지역을 선택하세요"),
                        dto("B2", "IMAGE_GRID", "지역 선택"),
                        dto("B3", "BUTTON",     "다음")
                ));

        mockMvc.perform(get("/api/ui/INTRO3")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.data", hasSize(3)));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. FOCUS — 일정 화면
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("FOCUS: 200 OK + data 배열 반환")
    void focus_returns_200() throws Exception {
        when(uiService.getUiTree(eq("FOCUS"), anyString()))
                .thenReturn(List.of(dto("C1", "MAP", "일정 지도")));

        mockMvc.perform(get("/api/ui/FOCUS")
                        .with(user("user").roles("USER"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("FOCUS: 빈 메타데이터 → Next.js fallback UI 트리거 (빈 배열 반환)")
    void focus_empty_metadata_triggers_fallback() throws Exception {
        when(uiService.getUiTree(eq("FOCUS"), anyString()))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/ui/FOCUS")
                        .with(user("user").roles("USER"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    @DisplayName("FOCUS: componentId 필드 포함 (Next.js 키 바인딩 필수)")
    void focus_has_component_id() throws Exception {
        when(uiService.getUiTree(eq("FOCUS"), anyString()))
                .thenReturn(List.of(dto("C1", "MAP", "지도")));

        mockMvc.perform(get("/api/ui/FOCUS")
                        .with(user("user").roles("USER"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.data[0].componentId").value("C1"));
    }

    // ════════════════════════════════════════════════════════════════════════
    // 4. 공통 — 존재하지 않는 screenId
    // ════════════════════════════════════════════════════════════════════════

    @Test
    @DisplayName("존재하지 않는 screenId → 빈 data 배열 (크래시 없음)")
    void unknown_screen_id_returns_empty() throws Exception {
        when(uiService.getUiTree(eq("NOT_EXIST"), anyString()))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/ui/NOT_EXIST")
                        .with(user("guest").roles("GUEST"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }
}
