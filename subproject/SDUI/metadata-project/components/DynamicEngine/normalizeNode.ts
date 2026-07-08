import { Metadata, NormalizedNode } from "./type";

const firstDefined = <T,>(...values: T[]): T | undefined =>
    values.find((value) => value !== undefined && value !== null);

export const normalizeNode = (raw: Metadata): NormalizedNode => {
    const node = raw as Record<string, any>;

    const children = Array.isArray(raw.children)
        ? raw.children.map(normalizeNode)
        : raw.children ?? null;

    return {
        ...raw,
        componentId: firstDefined(node.componentId, node.component_id, node.uiId, node.ui_id),
        componentType: firstDefined(node.componentType, node.component_type),
        parentGroupId: firstDefined(node.parentGroupId, node.parent_group_id),
        groupId: firstDefined(node.groupId, node.group_id),
        refDataId: firstDefined(node.refDataId, node.ref_data_id),
        isVisible: firstDefined(node.isVisible, node.is_visible),
        groupDirection: firstDefined(node.groupDirection, node.group_direction),
        cssClass: firstDefined(node.cssClass, node.css_class),
        inlineStyle: firstDefined(node.inlineStyle, node.inline_style),
        actionType: firstDefined(node.actionType, node.action_type),
        uiId: firstDefined(node.uiId, node.ui_id),
        labelText: firstDefined(node.labelText, node.label_text),
        isReadonly: firstDefined(node.isReadonly, node.is_readonly),
        dataSqlKey: firstDefined(node.dataSqlKey, node.data_sql_key),
        dataParams: firstDefined(node.dataParams, node.data_params),
        children,
    };
};

export const normalizeTree = (nodes?: Metadata[] | null): NormalizedNode[] =>
    Array.isArray(nodes) ? nodes.map(normalizeNode) : [];
