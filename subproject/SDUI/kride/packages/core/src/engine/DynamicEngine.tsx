'use client';
import React from "react";
import { componentMap } from "./componentMap";
import { useDynamicEngine } from "./useDynamicEngine";
import { DynamicEngineProps, Metadata } from "./type";

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
              <div
                key={`${uId}-${idx}`}
                className={combinedClassName}
                style={{ cursor: hasAction ? "pointer" : "default" }}
                onClick={handleClick}
              >
                {renderNodes(node.children, item)}
              </div>
            );
          });
        }

        const handleGroupClick = hasAction ? () => onAction(node, rowData) : undefined;
        return (
          <div
            key={uId}
            className={combinedClassName}
            style={{ cursor: hasAction ? "pointer" : "default" }}
            onClick={handleGroupClick}
          >
            {renderNodes(node.children, rowData)}
          </div>
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
    <div className="engine-container">
      <div className="content-area">{renderNodes(treeData)}</div>
      {renderModals(treeData)}
    </div>
  );
};

export default DynamicEngine;
