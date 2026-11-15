// @@@@ 2026-02-07 추가
// 동적 ui 렌더링 > 빅오 값으로 로직 변경 (트리구조에서 부모가 있을때 자식 조회, 아니면 말단노드 조회)

package com.domain.kride.domain.ui.dto;

import com.domain.kride.domain.ui.domain.UiMetadata;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class UiResponseDto {
    // 식별자 및 계층 정보
    private String componentId; // 컴포넌트 고유 ID
    private String parentGroupId; // 부모그룹 Id( 트리 구성의 기준)

    // UI 표시 관련 데이터
    private String labelText; // 화면에 표시될 라벨
    private String componentType; // 컴포넌트 유형
    private Integer sortOrder; // 정렬 순서

    // 상태 및 제약조건
    private Boolean isRequired; // 필수 입력 여부
    private Boolean isReadonly;  // 읽기 전용 여부
    private String isVisible; //  표시 여부 (조건부 로직 포함 가능)

    // 스타일 및 액션
    private String cssClass; // 적용할 CSS 클래스
    private String groupDirection; // 그룹 방향 ('ROW' 또는 'COLUMN')
    private String actionType; // 클릭 등 이벤트 발생 시 액션타입
    private String actionUrl; // 액션 수행 URL


    // 데이터
    private String dataApiUrl;  // 이 필드가 있는지 확인!
    private String dataSqlKey;
    private String refDataId;

    // AI 컴포넌트 전용
    @JsonProperty("system_prompt_template")
    private String systemPromptTemplate;

    // 컴포넌트 동적 속성 (showWhen 등 조건부 렌더링에 사용)
    private Object props;

    // 트리 구조의 핵심 ㅣ 자식 노드 리스트
    @JsonInclude(JsonInclude.Include.NON_EMPTY) // 자식이 없을 때 필드 자체를 숨기고 싶다면 사용
    private List<UiResponseDto> children = new ArrayList<>();

    // Entity를 DTO로 변환하는 생성자 (기존 - 하위 호환성 유지)
    public UiResponseDto(UiMetadata entity) {
        this(entity, null); // userRole 없이 호출 시 오버라이드 미적용
    }

    // RBAC 지원: 역할별 오버라이드를 적용하는 생성자 (2026-03-01 추가)
    public UiResponseDto(UiMetadata entity, String userRole) {
        this.componentId = entity.getComponentId();
        this.parentGroupId = entity.getParentGroupId();
        this.componentType = entity.getComponentType();
        this.sortOrder = entity.getSortOrder();
        this.isRequired = entity.getIsRequired();
        this.isReadonly = entity.getIsReadonly();
        this.isVisible = entity.getIsVisible();
        this.actionType = entity.getActionType();
        this.actionUrl = entity.getActionUrl();
        this.dataApiUrl = entity.getDataApiUrl();
        this.dataSqlKey = entity.getDataSqlKey();
        this.refDataId = entity.getRefDataId();
        this.groupDirection = entity.getGroupDirection();
        this.systemPromptTemplate = entity.getSystemPromptTemplate();

        // component_props JSONB → props 파싱
        if (entity.getComponentProps() != null && !entity.getComponentProps().isBlank()) {
            try {
                ObjectMapper mapper = new ObjectMapper();
                this.props = mapper.readValue(entity.getComponentProps(), Object.class);
            } catch (Exception e) {
                this.props = null;
            }
        }

        // 역할별 label_text 오버라이드 처리
        this.labelText = resolveOverriddenValue(
            entity.getLabelText(),
            entity.getLabelTextOverrides(),
            userRole
        );

        // 역할별 css_class 오버라이드 처리
        this.cssClass = resolveOverriddenValue(
            entity.getCssClass(),
            entity.getCssClassOverrides(),
            userRole
        );

        // children은 트리 구성 로직에서 별도로 채워짐
    }

    /**
     * JSONB 오버라이드 값을 역할에 따라 해석하는 헬퍼 메서드
     * @param defaultValue 기본값
     * @param overridesJson JSONB 형식의 오버라이드 맵 (예: {"ROLE_ADMIN":"관리자용","ROLE_USER":"사용자용"})
     * @param userRole 사용자 역할 (예: "ROLE_USER")
     * @return 오버라이드된 값 또는 기본값
     */
    private String resolveOverriddenValue(String defaultValue, String overridesJson, String userRole) {
        // overridesJson이 없거나 userRole이 없으면 기본값 반환
        if (overridesJson == null || overridesJson.trim().isEmpty() || userRole == null) {
            return defaultValue;
        }

        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, String> overrides = mapper.readValue(overridesJson, Map.class);
            return overrides.getOrDefault(userRole, defaultValue);
        } catch (Exception e) {
            // JSON 파싱 실패 시 기본값 반환 (로깅은 생략, 성능 고려)
            return defaultValue;
        }
    }
}
