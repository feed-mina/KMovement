package com.domain.kride.domain.ui.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "ui_metadata")
@Getter
@Setter
@NoArgsConstructor
public class UiMetadata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ui_id", nullable = false)
    private Long uiId;

    @Column(name = "screen_id", nullable = false, length = 50)
    private String screenId;

    @Column(name = "component_id", nullable = false, length = 50)
    private String componentId;

    @Column(name = "label_text", nullable = false, length = 100)
    private String labelText;

    @Column(name = "component_type", nullable = false, length = 20)
    private String componentType;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "is_required")
    private Boolean isRequired = false;

    @Column(name = "is_readonly")
    private Boolean isReadonly = true;

    @Column(name = "default_value")
    private String defaultValue;

    private String placeholder;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "css_class", length = 100)
    private String cssClass;

    @Column(name = "inline_style")
    private String inlineStyle;

    @Column(name = "action_type", length = 50)
    private String actionType;

    @Column(name = "action_url")
    private String actionUrl;

    @Column(name = "data_sql_key", length = 50)
    private String dataSqlKey;

    @Column(name = "data_api_url")
    private String dataApiUrl;

    @Column(name = "data_params", length = 50)
    private String dataParams;

    @Column(name = "ref_data_id")
    private String refDataId;

    @Column(name = "group_id", length = 50)
    private String groupId;

    @Column(name = "group_direction", length = 10)
    private String groupDirection; // 'ROW' 또는 'COLUMN'

    @Column(name = "submit_group_id", length = 50)
    private String submitGroupId;

    @Column(name = "submit_group_order")
    private Integer submitGroupOrder;

    @Column(name = "submit_group_separator", length = 5)
    private String submitGroupSeparator;

    @Column(name = "parent_group_id", length = 50)
    private String parentGroupId;

    @Column(name = "is_visible", length = 50)
    private String isVisible;

    // RBAC 지원 컬럼 (2026-03-01 추가)
    @Column(name = "allowed_roles", length = 255)
    private String allowedRoles;

    @Column(name = "label_text_overrides", columnDefinition = "jsonb")
    private String labelTextOverrides;

    @Column(name = "css_class_overrides", columnDefinition = "jsonb")
    private String cssClassOverrides;

    @Column(name = "system_prompt_template", columnDefinition = "TEXT")
    private String systemPromptTemplate;

    @Column(name = "component_props", columnDefinition = "jsonb")
    private String componentProps;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
    }


}
