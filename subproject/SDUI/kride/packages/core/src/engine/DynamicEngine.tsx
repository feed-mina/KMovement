'use client';
import React from "react";
import { createBaseComponentMap } from "./componentMap";
import { useDynamicEngine } from "./useDynamicEngine";
import { DynamicEngineProps, Metadata } from "./type";
import { webPrimitives } from "./primitives";

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
    primitives = webPrimitives,
    componentMap: injectedComponentMap,
    ...rest
  } = props;

  // Platform-neutral base leaves are always available; the platform's registry
  // (web HTML leaves or RN leaves) is merged on top when provided.
  const componentMap = React.useMemo(
    () => ({ ...createBaseComponentMap(primitives), ...injectedComponentMap }),
    [primitives, injectedComponentMap]
  );

  const { treeData, getComponentData } = useDynamicEngine(metadata, pageData, formData);

  const renderNodes = (nodes?: Metadata[] | null, rowData: any = null) => {
    if (!nodes) return null;

    return nodes.map((node) => {
      const isVisible =
        node.isVisible !== false &&
        node.isVisible !== "false" &&
        node.is_visible !== false &&
        node.is_visible !== "false";
      if (!isVisible) return null;

      const rawId = node.componentId || node.component_id || node.uiId;
      const uId = String(rawId);
      const isGroup = node.children && node.children.length > 0;

      if (isGroup) {
        const classList: string[] = [];
        const refId = node.refDataId || node.ref_data_id;
        const isRepeater = !!refId;
        const cid = node.componentId || node.component_id;
        const customClass = node.cssClass || node.css_class;

        if (cid) classList.push(`group-${cid}`);

        if (customClass) {
          classList.push(customClass);
        } else if (cid && !classList.includes(cid)) {
          classList.push(cid);
        }

        const directionClass =
          node.groupDirection === "ROW" ? "flex-row-layout" : "flex-col-layout";
        classList.push(directionClass);

        const combinedClassName = Array.from(new Set(classList))
          .filter(Boolean)
          .join(" ")
          .trim();

        const hasAction = !!(node.actionType || node.action_type);

        if (isRepeater) {
          const list = pageData?.[refId!];
          if (!list || !Array.isArray(list)) return null;

          return list.map((item: any, idx: number) => {
            const handleClick = hasAction ? () => onAction(node, item) : undefined;
            return (
              <primitives.Box
                key={`${uId}-${idx}`}
                className={combinedClassName}
                onPress={handleClick}
              >
                {renderNodes(node.children, item)}
              </primitives.Box>
            );
          });
        }

        const handleGroupClick = hasAction ? () => onAction(node, rowData) : undefined;
        return (
          <primitives.Box
            key={uId}
            className={combinedClassName}
            onPress={handleGroupClick}
          >
            {renderNodes(node.children, rowData)}
          </primitives.Box>
        );
      }

      const typeKey = (node.componentType || node.component_type || "").toUpperCase();
      const Component = componentMap[typeKey];
      if (!Component || typeKey === "DATA_SOURCE") return null;

      const finalData = getComponentData(node, rowData);

      const componentProps: any = {
        id: uId,
        meta: node,
        data: finalData,
        formData,
        onChange,
        onAction,
        ...rest,
      };

      return <Component key={uId} {...componentProps} />;
    });
  };

  const renderModals = (nodes?: Metadata[] | null) => {
    if (!nodes) return null;
    return nodes
      .filter((node) => (node.componentType || node.component_type) === "MODAL")
      .map((node) => {
        const cid = node.componentId || node.component_id;
        if (activeModal === cid) {
          const ModalComponent = componentMap["MODAL"];
          if (!ModalComponent) return null;
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

  return (
    <primitives.Box className="engine-container">
      <primitives.Box className="content-area">{renderNodes(treeData)}</primitives.Box>
      {renderModals(treeData)}
    </primitives.Box>
  );
};

export default DynamicEngine;
