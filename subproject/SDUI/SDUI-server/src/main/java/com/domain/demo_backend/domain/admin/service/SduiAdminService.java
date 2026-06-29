package com.domain.demo_backend.domain.admin.service;

import com.domain.demo_backend.domain.admin.dto.SduiQueryMasterResponse;
import com.domain.demo_backend.domain.admin.dto.SduiScreenDetailResponse;
import com.domain.demo_backend.domain.admin.dto.SduiScreenSummaryResponse;
import com.domain.demo_backend.domain.admin.dto.SduiThemeSummaryResponse;
import com.domain.demo_backend.domain.query.domain.QueryMaster;
import com.domain.demo_backend.domain.query.repository.QueryMasterRepository;
import com.domain.demo_backend.domain.theme.domain.DesignToken;
import com.domain.demo_backend.domain.theme.domain.DesignTokenRepository;
import com.domain.demo_backend.domain.ui.domain.UiMetadata;
import com.domain.demo_backend.domain.ui.domain.UiMetadataRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@Transactional(readOnly = true)
public class SduiAdminService {

    private final UiMetadataRepository uiMetadataRepository;
    private final DesignTokenRepository designTokenRepository;
    private final QueryMasterRepository queryMasterRepository;

    public SduiAdminService(
            UiMetadataRepository uiMetadataRepository,
            DesignTokenRepository designTokenRepository,
            QueryMasterRepository queryMasterRepository
    ) {
        this.uiMetadataRepository = uiMetadataRepository;
        this.designTokenRepository = designTokenRepository;
        this.queryMasterRepository = queryMasterRepository;
    }

    public List<SduiScreenSummaryResponse> listScreens() {
        Map<String, List<UiMetadata>> byScreen = new LinkedHashMap<>();
        for (UiMetadata item : uiMetadataRepository.findAllByOrderByScreenIdAscSortOrderAscUiIdAsc()) {
            byScreen.computeIfAbsent(item.getScreenId(), key -> new ArrayList<>()).add(item);
        }

        return byScreen.entrySet().stream()
                .map(entry -> toScreenSummary(entry.getKey(), entry.getValue()))
                .toList();
    }

    public SduiScreenDetailResponse getScreen(String screenId) {
        List<SduiScreenDetailResponse.ComponentResponse> components =
                uiMetadataRepository.findByScreenIdOrderBySortOrderAsc(screenId).stream()
                        .map(this::toComponentResponse)
                        .toList();
        return new SduiScreenDetailResponse(screenId, components);
    }

    public List<SduiThemeSummaryResponse> listThemes() {
        Map<String, List<DesignToken>> byTheme = new LinkedHashMap<>();
        for (DesignToken token : designTokenRepository.findAllByOrderByThemeIdAscCategoryAscTokenKeyAsc()) {
            byTheme.computeIfAbsent(token.getThemeId(), key -> new ArrayList<>()).add(token);
        }

        return byTheme.entrySet().stream()
                .map(entry -> toThemeSummary(entry.getKey(), entry.getValue()))
                .toList();
    }

    public List<SduiQueryMasterResponse> listQueryMasters() {
        return queryMasterRepository.findAll(Sort.by(Sort.Direction.ASC, "sqlKey")).stream()
                .map(this::toQueryMasterResponse)
                .toList();
    }

    private SduiScreenSummaryResponse toScreenSummary(String screenId, List<UiMetadata> items) {
        String firstLabel = items.stream()
                .min(Comparator.comparing(UiMetadata::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .map(UiMetadata::getLabelText)
                .orElse("");

        LocalDateTime lastCreatedAt = items.stream()
                .map(UiMetadata::getCreatedAt)
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);

        List<String> componentTypes = items.stream()
                .map(UiMetadata::getComponentType)
                .filter(value -> value != null && !value.isBlank())
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll)
                .stream()
                .toList();

        List<String> dataSqlKeys = items.stream()
                .map(UiMetadata::getDataSqlKey)
                .filter(value -> value != null && !value.isBlank())
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll)
                .stream()
                .toList();

        return new SduiScreenSummaryResponse(
                screenId,
                items.size(),
                firstLabel,
                lastCreatedAt,
                componentTypes,
                dataSqlKeys
        );
    }

    private SduiScreenDetailResponse.ComponentResponse toComponentResponse(UiMetadata item) {
        return new SduiScreenDetailResponse.ComponentResponse(
                item.getUiId(),
                item.getComponentId(),
                item.getLabelText(),
                item.getComponentType(),
                item.getSortOrder(),
                item.getActionType(),
                item.getActionUrl(),
                item.getDataSqlKey(),
                item.getDataApiUrl(),
                item.getGroupId(),
                item.getParentGroupId(),
                item.getIsVisible(),
                item.getAllowedRoles(),
                item.getComponentProps()
        );
    }

    private SduiThemeSummaryResponse toThemeSummary(String themeId, List<DesignToken> tokens) {
        LocalDateTime lastUpdatedAt = tokens.stream()
                .map(token -> token.getUpdatedAt() != null ? token.getUpdatedAt() : token.getCreatedAt())
                .filter(Objects::nonNull)
                .max(LocalDateTime::compareTo)
                .orElse(null);

        List<String> categories = tokens.stream()
                .map(DesignToken::getCategory)
                .filter(value -> value != null && !value.isBlank())
                .collect(LinkedHashSet::new, LinkedHashSet::add, LinkedHashSet::addAll)
                .stream()
                .toList();

        return new SduiThemeSummaryResponse(themeId, tokens.size(), lastUpdatedAt, categories);
    }

    private SduiQueryMasterResponse toQueryMasterResponse(QueryMaster queryMaster) {
        return new SduiQueryMasterResponse(
                queryMaster.getSqlKey(),
                queryMaster.getReturnType(),
                queryMaster.getRequiredRole(),
                queryMaster.getDescription(),
                queryMaster.getQueryText(),
                queryMaster.getUpdatedAt()
        );
    }
}
