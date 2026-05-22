package com.domain.demo_backend.domain.ui.controller;

import com.domain.demo_backend.domain.ui.dto.UiResponseDto;
import com.domain.demo_backend.domain.ui.service.UiService;
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
import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "openai.api-key=test-key",
        "openai.model=gpt-4o-mini",
        "openai.whisper-model=whisper-1"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("K-Ride UI metadata controller integration tests")
class UiControllerKrideIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UiService uiService;

    @Test
    @DisplayName("KRIDE_INTRO4 returns ApiResponse payload and passes ROLE_USER")
    void krideIntro4ReturnsUserMetadata() throws Exception {
        UiResponseDto nextButton = dto("INTRO4_NEXT", "KRIDE_NEXT_BTN", "Next");
        nextButton.setProps(Map.of("checkKey", "selectedPurposes", "minCount", 1));

        when(uiService.getUiTree("KRIDE_INTRO4", "ROLE_USER"))
                .thenReturn(List.of(nextButton));

        mockMvc.perform(get("/api/ui/KRIDE_INTRO4")
                        .with(user("traveler").roles("USER"))
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].componentId").value("INTRO4_NEXT"))
                .andExpect(jsonPath("$.data[0].componentType").value("KRIDE_NEXT_BTN"))
                .andExpect(jsonPath("$.data[0].props.checkKey").value("selectedPurposes"))
                .andExpect(jsonPath("$.data[0].props.minCount").value(1));

        verify(uiService).getUiTree("KRIDE_INTRO4", "ROLE_USER");
    }

    @Test
    @DisplayName("KRIDE_INTRO5 uses ROLE_GUEST when there is no authentication principal")
    void krideIntro5DefaultsToGuestRole() throws Exception {
        when(uiService.getUiTree("KRIDE_INTRO5", "ROLE_GUEST"))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/ui/KRIDE_INTRO5")
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("success"))
                .andExpect(jsonPath("$.data", hasSize(0)));

        verify(uiService).getUiTree("KRIDE_INTRO5", "ROLE_GUEST");
    }

    private UiResponseDto dto(String id, String type, String label) {
        UiResponseDto dto = new UiResponseDto();
        dto.setComponentId(id);
        dto.setComponentType(type);
        dto.setLabelText(label);
        dto.setSortOrder(1);
        return dto;
    }
}
