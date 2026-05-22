package com.domain.demo_backend.domain.ui.service;

import com.domain.demo_backend.domain.ui.domain.UiMetadata;
import com.domain.demo_backend.domain.ui.domain.UiMetadataRepository;
import com.domain.demo_backend.domain.ui.dto.UiResponseDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("K-Ride UI metadata service unit tests")
class UiServiceKrideTest {

    @Mock
    private UiMetadataRepository uiMetadataRepository;

    private UiService uiService;

    @BeforeEach
    void setUp() {
        uiService = new UiService(uiMetadataRepository);
    }

    @Test
    @DisplayName("KRIDE_INTRO4 metadata keeps DB order and nests children")
    void getUiTree_buildsNestedKrideIntroTree() {
        UiMetadata root = metadata("KRIDE_INTRO4", "INTRO4_ROOT", null, "GROUP", "Pick purpose", 1);
        UiMetadata nextButton = metadata("KRIDE_INTRO4", "INTRO4_NEXT", "INTRO4_ROOT", "KRIDE_NEXT_BTN", "Next", 2);
        nextButton.setComponentProps("{\"checkKey\":\"selectedPurposes\",\"minCount\":1}");

        when(uiMetadataRepository.findByScreenIdOrderBySortOrderAsc("KRIDE_INTRO4"))
                .thenReturn(List.of(root, nextButton));

        List<UiResponseDto> tree = uiService.getUiTree("KRIDE_INTRO4", "ROLE_USER");

        assertThat(tree).hasSize(1);
        UiResponseDto rootDto = tree.get(0);
        assertThat(rootDto.getComponentId()).isEqualTo("INTRO4_ROOT");
        assertThat(rootDto.getChildren())
                .extracting(UiResponseDto::getComponentId)
                .containsExactly("INTRO4_NEXT");

        UiResponseDto buttonDto = rootDto.getChildren().get(0);
        assertThat(buttonDto.getComponentType()).isEqualTo("KRIDE_NEXT_BTN");
        Map<?, ?> props = (Map<?, ?>) buttonDto.getProps();
        assertThat(props.get("checkKey")).isEqualTo("selectedPurposes");
        assertThat(props.get("minCount")).isEqualTo(1);
    }

    @Test
    @DisplayName("ROLE_USER cannot receive admin-only K-Ride metadata")
    void getUiTree_filtersAdminOnlyKrideMetadata() {
        UiMetadata publicCard = metadata("KRIDE_INTRO5", "INTRO5_PUBLIC", null, "CARD", "Public", 1);
        UiMetadata adminOnlyCard = metadata("KRIDE_INTRO5", "INTRO5_ADMIN", null, "CARD", "Admin", 2);
        adminOnlyCard.setAllowedRoles("ROLE_ADMIN");

        when(uiMetadataRepository.findByScreenIdOrderBySortOrderAsc("KRIDE_INTRO5"))
                .thenReturn(List.of(publicCard, adminOnlyCard));

        List<UiResponseDto> tree = uiService.getUiTree("KRIDE_INTRO5", "ROLE_USER");

        assertThat(tree)
                .extracting(UiResponseDto::getComponentId)
                .containsExactly("INTRO5_PUBLIC");
    }

    private UiMetadata metadata(
            String screenId,
            String componentId,
            String parentGroupId,
            String componentType,
            String labelText,
            int sortOrder
    ) {
        UiMetadata metadata = new UiMetadata();
        metadata.setScreenId(screenId);
        metadata.setComponentId(componentId);
        metadata.setParentGroupId(parentGroupId);
        metadata.setComponentType(componentType);
        metadata.setLabelText(labelText);
        metadata.setSortOrder(sortOrder);
        metadata.setIsRequired(false);
        metadata.setIsReadonly(false);
        return metadata;
    }
}
