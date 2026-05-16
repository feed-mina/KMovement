// @@@@ 2026-02-07 변경 DynamicEngine 훅,렌더링,컴포넌트 부분 따로 분리
'use client';
import React from "react";
import { componentMap } from "../constants/componentMap";
import { useDynamicEngine } from "./useDynamicEngine";
import { DynamicEngineProps, Metadata } from "./type";
import { useRenderCount } from "@/components/DynamicEngine/hook/useRenderCount";
import { useDeviceType } from "../../hooks/useDeviceType";
import PostcodeModal from "@/components/fields/PostcodeModal";

// @@@@ 2026-02-07 주석 추가
// DynamicEngine 역할 : 분석된 구조를 바탕으로 실제 리액트 컴포넌트를 랜더링
// ... 이하 렌더링 로직 동일
const DynamicEngine: React.FC<DynamicEngineProps> = (props) => {

    //  구조 분해 할당 시 screenId 추출
    const { metadata, screenId, pageData, formData, setFormData, onChange, onAction, closeModal, activeModal, ...rest } = props;
    //   비즈니스 로직 훅에 필요한 데이터를 넘겨 트리 구조(treeData)를 생성한다.
    const { treeData, getComponentData } = useDynamicEngine(metadata, pageData, formData);
    // * 디바이스 별로 className을 is-pc 또는 is-mobile로 구분
    const { deviceClass } = useDeviceType();
    //  * 페이지별로 렌더링 횟수 체크 -> 배포할때 주석처리 필요

    useRenderCount(`DynamicEngine (Screen: ${screenId})`);

    // 1. 파라미터 타입을 Metadata[] | null | undefined 로 확장
    const renderNodes = (nodes?: Metadata[] | null, rowData: any = null) => {
        // 2. nodes가 없으면 즉시 null 반환 (런타임 에러 방지)
        if (!nodes) return null;

        return nodes.map((node) => {
            const isVisible = node.isVisible !== false && node.isVisible !== "false" &&
                node.is_visible !== false && node.is_visible !== "false";
            if (!isVisible) return null;

            const rawId = node.componentId || node.component_id || node.uiId;
            const uId = String(rawId);

            // * 메타데이터에서 json으로 내려줄때 요소(componentId) - 그룹(groupId) -  부모그룹(parentGroupId)로 묶을수있다.
            const isGroup = node.children && node.children.length > 0;

            if (isGroup) {
                const classList = [];
                const refId = node.refDataId || node.ref_data_id;
                const isRepeater = !!refId;
                const cid = node.componentId || node.component_id;

                // * 메타데이터에 css_class로 className이 있음
                const customClass = node.cssClass || node.css_class;
                //  그룹일때 className은 group-${componentId}로 지정한다.
                if (cid) {
                    classList.push(`group-${cid}`);
                }

                if (customClass) {
                    classList.push(customClass);
                } else if (cid && !classList.includes(cid)) {
                    classList.push(cid);
                }

                // css_class에 이미 grid/flex 레이아웃이 명시된 경우 direction 클래스를 추가하면 충돌 발생
                const hasCustomLayout = customClass && /\b(grid|flex)\b/.test(customClass);
                if (!hasCustomLayout) {
                    const directionClass = node.groupDirection === "ROW" ? "flex-row-layout" : "flex-col-layout";
                    classList.push(directionClass);
                }


                const combinedClassName = Array.from(new Set(classList))
                    .filter(Boolean)
                    .join(' ')
                    .trim();

                // * 액션타입으로 액션핸들러를 구분함, hasAction은 True or False
                // camelCase(actionType)와 snake_case(action_type) 모두 지원
                const hasAction = !!(node.actionType || node.action_type);


                // * 리피터 과정 (그룹일 경우 리스트이기 때문에 리피터로 렌더링)
                if (isRepeater) {
                    const list = pageData?.[refId];
                    if (!list || !Array.isArray(list)) {
                        // console.warn(`[DynamicEngine] ${refId} 데이터가 배열이 아닙니다.`, list);
                        return null;
                    }

                    // css_class에 grid 키워드가 있으면 wrapper div로 묶어 grid container로 동작
                    const isGridLayout = customClass && /\bgrid\b/.test(customClass);

                    if (isGridLayout) {
                        return (
                            <div key={uId} className={combinedClassName}>
                                {list.map((item: any, idx: number) => {
                                    const handleClick = hasAction ? () => onAction(node, item) : undefined;
                                    return (
                                        <div
                                            key={`${uId}-${idx}`}
                                            style={{ cursor: hasAction ? 'pointer' : 'default' }}
                                            onClick={handleClick}
                                        >
                                            {renderNodes(node.children, item)}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    }

                    // * 기존 동작 유지 (grid 아닌 REPEATER)
                    return list.map((item: any, idx: number) => {
                        // 3. 리피터 내의 개별 아이템 클릭 핸들러
                        const handleClick = hasAction ? () => onAction(node, item) : undefined;

                        return (
                            <div
                                key={`${uId}-${idx}`}
                                className={combinedClassName}
                                style={{ cursor: hasAction ? 'pointer' : 'default' }}
                                onClick={handleClick}
                            >
                                {renderNodes(node.children, item)}
                            </div>
                        );
                    });
                }

                // 4. 일반 그룹의 클릭 핸들러 (rowData 전달)
                const handleGroupClick = hasAction ? () => onAction(node, rowData) : undefined;
                return (
                    <div
                        key={uId}
                        className={combinedClassName}
                        style={{ cursor: hasAction ? 'pointer' : 'default' }}
                        onClick={handleGroupClick}
                    >
                        {renderNodes(node.children, rowData)}
                    </div>
                );
            }

            // * 각 노드들은 컴포넌트 타입을 가진다.
            const typeKey = (node.componentType || node.component_type || "").toUpperCase();
            // * 메터데이터에 각 필드를 component_type으로 지정했다. componentMap에는 component_Type의 태그가 모여있다.
            const Component = componentMap[typeKey];
            // * 노드(요소)가 아니거나 comonent_type이 DATA_SOURCE 일때는 화면에 null 로 주기때문에 보이지 않늗나.
            if (!Component || typeKey === "DATA_SOURCE") return null;

            const finalData = getComponentData(node, rowData);

            // ADDRESS_SEARCH_GROUP은 setFormData 필요, kride 컴포넌트는 formData 필요
            const KRIDE_NEEDS_FORM = new Set(["SELECTION_CARD", "PURPOSE_CARD", "DUAL_RANGE_SLIDER", "KRIDE_NEXT_BTN"]);
            const componentProps: any = {
                id: uId,
                meta: node,
                data: finalData,
                onChange,
                onAction,
                ...(KRIDE_NEEDS_FORM.has(typeKey) && { formData }),
                ...rest
            };

            if (typeKey === "ADDRESS_SEARCH_GROUP" && setFormData) {
                componentProps.formData = formData;
                componentProps.setFormData = setFormData;
            }

            return <Component key={uId} {...componentProps} />;
        });
    };


    // * rendalModel 은 componet_type이 MODAL인 경우
    const renderModals = (nodes?: Metadata[] | null) => {
        if (!nodes) return null;
        return nodes
            .filter(node => (node.componentType || node.component_type) === 'MODAL')
            .map(node => {
                const cid = node.componentId || node.component_id;
                if (activeModal === cid) {
                    const ModalComponent = componentMap['MODAL'];
                    return (
                        <ModalComponent
                            key={String(node.uiId)}
                            meta={node}
                            onConfirm={() => onAction(node, formData)}
                            onClose={closeModal}
                        />
                    );
                }
                return null;
            });
    };

    // * 페이지 최상단은 className 을 engine-container 로 시작

    return (
        // @@@@ 최상위 컨테이너에만 클래스를 부여해 CSS 상속 유도
        <div className={`engine-container ${deviceClass}`}>
            <div className="content-area">
                {renderNodes(treeData)}
            </div>
            {renderModals(treeData)}
            <PostcodeModal />
        </div>
    );
};

export default DynamicEngine;