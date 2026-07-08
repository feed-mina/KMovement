import { useCallback, useMemo } from "react";
import { Metadata, NormalizedNode } from "@/components/DynamicEngine/type";
import { normalizeTree } from "@/components/DynamicEngine/normalizeNode";

export const useDynamicEngine = (metadata: Metadata[], pageData: any, formData: any) => {
    const treeData = useMemo(() => normalizeTree(metadata), [metadata]);

    const getComponentData = useCallback((node: NormalizedNode, rowData: any) => {
        const refId = node.refDataId;

        if (refId && formData && formData[refId] !== undefined) {
            return formData[refId];
        }

        if (rowData) {
            return rowData;
        }

        if (refId && pageData && pageData[refId] !== undefined) {
            const isRepeater = node.children && node.children.length > 0;
            if (!isRepeater && Array.isArray(pageData[refId])) {
                return pageData[refId][0] || {};
            }
            return pageData[refId];
        }

        return pageData || {};
    }, [formData, pageData]);

    return { treeData, getComponentData };
};
