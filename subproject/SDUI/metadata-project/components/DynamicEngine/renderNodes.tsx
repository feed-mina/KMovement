import React from "react";
import { componentRegistry } from "@/components/constants/componentMap";
import { DynamicEngineProps, NormalizedNode } from "@/components/DynamicEngine/type";

export interface RenderNodesContext {
    pageData: any;
    formData: any;
    setFormData?: DynamicEngineProps["setFormData"];
    onChange: DynamicEngineProps["onChange"];
    onAction: DynamicEngineProps["onAction"];
    getComponentData: (node: NormalizedNode, rowData: any) => any;
    extraProps: Record<string, any>;
}

export const resolveClassName = (node: NormalizedNode): string => {
    const classList: string[] = [];
    const cid = node.componentId;
    const customClass = node.cssClass;

    if (cid) {
        classList.push(`group-${cid}`);
    }

    if (customClass) {
        classList.push(customClass);
    } else if (cid) {
        classList.push(cid);
    }

    const hasCustomLayout = customClass && /\b(grid|flex)\b/.test(customClass);
    if (!hasCustomLayout) {
        classList.push(node.groupDirection === "ROW" ? "flex-row-layout" : "flex-col-layout");
    }

    return Array.from(new Set(classList)).filter(Boolean).join(" ").trim();
};

export const resolveAction = (
    node: NormalizedNode,
    onAction: DynamicEngineProps["onAction"],
    data: any
) => {
    const hasAction = !!node.actionType;

    if (!hasAction) {
        return {
            hasAction,
            actionProps: {
                style: { cursor: "default" as const },
            },
        };
    }

    return {
        hasAction,
        actionProps: {
            style: { cursor: "pointer" as const },
            onClick: () => onAction(node, data),
            onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onAction(node, data);
                }
            },
            role: "link",
            tabIndex: 0,
        },
    };
};

export const renderLeaf = (
    node: NormalizedNode,
    rowData: any,
    context: RenderNodesContext
): React.ReactNode => {
    const uId = String(node.componentId || node.uiId);
    const typeKey = (node.componentType || "").toUpperCase();
    const registration = componentRegistry[typeKey];
    const Component = registration?.component;

    if (!Component || registration.renderAsModal) return null;

    const finalData = context.getComponentData(node, rowData);
    const componentProps: any = {
        id: uId,
        meta: node,
        data: finalData,
        onChange: context.onChange,
        onAction: context.onAction,
        ...(registration.needsFormData && { formData: context.formData }),
        ...(registration.needsSetFormData && context.setFormData && { setFormData: context.setFormData }),
        ...context.extraProps,
    };

    return <Component key={uId} {...componentProps} />;
};

export const renderGridRepeater = (
    node: NormalizedNode,
    list: any[],
    className: string,
    uId: string,
    context: RenderNodesContext
): React.ReactNode => (
    <div key={uId} className={className}>
        {list.map((item: any, idx: number) => (
            <div key={`${uId}-${idx}`} {...resolveAction(node, context.onAction, item).actionProps}>
                {renderNodes(node.children, context, item)}
            </div>
        ))}
    </div>
);

export const renderRepeater = (
    node: NormalizedNode,
    list: any[],
    className: string,
    uId: string,
    context: RenderNodesContext
): React.ReactNode =>
    list.map((item: any, idx: number) => (
        <div
            key={`${uId}-${idx}`}
            className={className}
            {...resolveAction(node, context.onAction, item).actionProps}
        >
            {renderNodes(node.children, context, item)}
        </div>
    ));

export const renderGroup = (
    node: NormalizedNode,
    className: string,
    uId: string,
    context: RenderNodesContext,
    rowData: any
): React.ReactNode => (
    <div key={uId} className={className} {...resolveAction(node, context.onAction, rowData).actionProps}>
        {renderNodes(node.children, context, rowData)}
    </div>
);

export const renderNode = (
    node: NormalizedNode,
    context: RenderNodesContext,
    rowData: any = null
): React.ReactNode => {
    const isVisible = node.isVisible !== false && node.isVisible !== "false";
    if (!isVisible) return null;

    const uId = String(node.componentId || node.uiId);
    const isGroup = node.children && node.children.length > 0;
    if (!isGroup) {
        return renderLeaf(node, rowData, context);
    }

    const className = resolveClassName(node);
    const refId = node.refDataId;
    if (!refId) {
        return renderGroup(node, className, uId, context, rowData);
    }

    const list = context.pageData?.[refId];
    if (!Array.isArray(list)) {
        return null;
    }

    if (list.length === 0) {
        if (refId === 'events' && node.componentId === 'kpop_events_grid') {
            return (
                <div key={`${uId}-empty`} className={className}>
                    {renderNodes(node.children, context, null)}
                </div>
            );
        }
        return null;
    }

    const customClass = node.cssClass;
    const isGridLayout = customClass && /\bgrid\b|\bflex-wrap\b/.test(customClass);
    return isGridLayout
        ? renderGridRepeater(node, list, className, uId, context)
        : renderRepeater(node, list, className, uId, context);
};

export const renderNodes = (
    nodes: NormalizedNode[] | null | undefined,
    context: RenderNodesContext,
    rowData: any = null
): React.ReactNode => {
    if (!nodes) return null;
    return nodes.map((node) => renderNode(node, context, rowData));
};
