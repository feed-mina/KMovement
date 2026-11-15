package com.domain.kride.domain.ui.service;

import com.domain.kride.domain.ui.domain.UiMetadata;
import com.domain.kride.domain.ui.domain.UiMetadataRepository;
import com.domain.kride.domain.ui.dto.UiResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;
/*
@@@@ 2026-02-08 추가
- 동적 ui구성 성능 최적화
- ui_metadata 테이블을 DTO 변환 및 Map 구성
-  LinkedHashMap을 사용하여 DB 정렬 순서를 Map에서도 유지 (O(n))
-  중복 ID 처리 : 중복 ID가 발생하면 기존 값을 유지하고 로그를 남김
-  정합성 체크 : 부모 ID가 존재하지만 실제 데이터가 없는 경우 (고아 노드) 처리
 */

@Service
public class UiService {
    private static final Logger log = LoggerFactory.getLogger(UiService.class);
    private final UiMetadataRepository uiMetadataRepository;

    public UiService(UiMetadataRepository uiMetadataRepository) {
        this.uiMetadataRepository = uiMetadataRepository;
    }

    // 기존 메서드 (하위 호환성 유지) - ROLE_GUEST로 호출
    @Transactional(readOnly = true)
    public List<UiResponseDto> getUiTree(String screenId) {
        return getUiTree(screenId, "ROLE_GUEST");
    }

    // RBAC 지원: 역할 기반 필터링 및 오버라이드 적용 (2026-03-01 추가)
    @Transactional(readOnly = true)
    public List<UiResponseDto> getUiTree(String screenId, String userRole) {
        // DB에서 정렬된 상태로 전체 데이터 조회
        List<UiMetadata> entities = uiMetadataRepository.findByScreenIdOrderBySortOrderAsc(screenId);

        // 1. 역할 기반 필터링 + DTO 변환 (오버라이드 적용)
        // LinkedHashMap으로 DB 정렬 순서 유지 (O(n))
        Map<String, UiResponseDto> lookup =
                entities.stream()
                        .filter(entity -> isAccessible(entity, userRole))  // RBAC 필터링
                        .map(entity -> new UiResponseDto(entity, userRole))  // 역할별 오버라이드 적용
                        .collect(Collectors.toMap(
                                UiResponseDto::getComponentId, // Key
                                dto -> dto, // Value
                                (existing, replacement) -> { // Merge Function (중복처리)
                                    log.warn("Duplicate ID Detected: {}", existing.getComponentId());
                                    return existing;
                                },
                                LinkedHashMap::new // Map Supplier (구현체 지정)
                        ));

        // 2. 트리 재구성 (O(n)) 및 정합성 체크
        List<UiResponseDto> rootNodes = new ArrayList<>();
        for (UiResponseDto node : lookup.values()) {
            String parentId = node.getParentGroupId();
            // 최상위 노드인 경우 (부모 ID가 없는 경우)
            if (parentId == null || parentId.isEmpty()) {
                rootNodes.add(node);
            } else {
                // 부모 노드 찾기
                UiResponseDto parent = lookup.get(parentId);
                if (parent != null) {
                    // 부모가 존재하면 자식 리스트에 추가 (이미 정렬된 순서대로 추가됨)
                    parent.getChildren().add(node);
                } else {
                    // 정합성 체크: 부모 ID는 있는데 실제 Map에 없는 경우 (고아 노드)
                    // 부모가 권한 필터링으로 제거되었을 수 있으므로 최상위로 올림
                    log.warn("데이터 Integrity Warning: Parent {} not found for {} (possibly filtered by RBAC)", parentId, node.getComponentId());
                    rootNodes.add(node);
                }
            }
        }

        return rootNodes;
    }

    /**
     * RBAC: 사용자 역할이 컴포넌트에 접근 가능한지 확인
     * @param entity UI 메타데이터 엔티티
     * @param userRole 사용자 역할 (예: "ROLE_USER")
     * @return 접근 가능 여부
     */
    private boolean isAccessible(UiMetadata entity, String userRole) {
        String allowedRoles = entity.getAllowedRoles();

        // NULL이면 모두 허용 (기본값)
        if (allowedRoles == null || allowedRoles.trim().isEmpty()) {
            return true;
        }

        // 쉼표로 구분된 역할 목록에서 사용자 역할이 포함되어 있는지 확인
        return Arrays.stream(allowedRoles.split(","))
                .map(String::trim)
                .anyMatch(role -> role.equals(userRole));
    }

}
