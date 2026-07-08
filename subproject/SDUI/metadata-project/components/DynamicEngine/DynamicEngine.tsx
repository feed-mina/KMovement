'use client';

import React from "react";
import { componentRegistry } from "../constants/componentMap";
import { useDynamicEngine } from "./useDynamicEngine";
import { DynamicEngineProps, NormalizedNode } from "./type";
import { renderNodes, RenderNodesContext } from "./renderNodes";
import { useRenderCount } from "@/components/DynamicEngine/hook/useRenderCount";
import { useDeviceType } from "../../hooks/useDeviceType";
import PostcodeModal from "@/components/fields/PostcodeModal";

const DynamicEngine: React.FC<DynamicEngineProps> = (props) => {
    const {
        metadata,
        screenId,
        pageData,
        formData,
        setFormData,
        onChange,
        onAction,
        closeModal,
        activeModal,
        ...rest
    } = props;
    const { treeData, getComponentData } = useDynamicEngine(metadata, pageData, formData);
    const { deviceClass } = useDeviceType();

    useRenderCount(`DynamicEngine (Screen: ${screenId})`);

    const renderContext: RenderNodesContext = {
        pageData,
        formData,
        setFormData,
        onChange,
        onAction,
        getComponentData,
        extraProps: rest,
    };

    const renderModals = (nodes?: NormalizedNode[] | null) => {
        if (!nodes) return null;
        return nodes
            .filter((node) => componentRegistry[(node.componentType || "").toUpperCase()]?.renderAsModal)
            .map((node) => {
                const cid = node.componentId;
                if (activeModal !== cid) return null;

                const ModalComponent = componentRegistry[(node.componentType || "").toUpperCase()].component;
                return (
                    <ModalComponent
                        key={String(node.uiId || node.componentId)}
                        meta={node}
                        onConfirm={() => onAction(node, formData)}
                        onClose={closeModal}
                    />
                );
            });
    };

    return (
        <div className={`engine-container ${deviceClass}`}>
            <div className="content-area">
                {renderNodes(treeData, renderContext)}
            </div>
            {renderModals(treeData)}
            <PostcodeModal />
        </div>
    );
};

export default DynamicEngine;
