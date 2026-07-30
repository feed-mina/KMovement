import { useCallback, useMemo } from "react";
import { Metadata, NormalizedNode } from "@/components/DynamicEngine/type";
import { normalizeTree } from "@/components/DynamicEngine/normalizeNode";

export const useDynamicEngine = (metadata: Metadata[], pageData: any, formData: any) => {
    const treeData = useMemo(() => normalizeTree(metadata), [metadata]);

    const getComponentData = useCallback((node: NormalizedNode, rowData: any) => {
        const refId = node.refDataId;
        const isRepeater = node.children && node.children.length > 0;

        if (refId && formData && formData[refId] !== undefined) {
            const boundValue = formData[refId];
            // formData는 조회 결과(pageData)를 통째로 복사해 오므로, refId가 목록을 가리키면
            // 이 값은 사용자의 입력값이 아니라 컬렉션이다. 리피터 안에서는 현재 행이,
            // 단일 컴포넌트에서는 첫 행이 우선한다. (스칼라 입력값은 기존대로 formData가 우선)
            if (!Array.isArray(boundValue)) {
                return boundValue;
            }
            if (rowData) {
                return rowData;
            }
            if (!isRepeater) {
                return boundValue[0] || {};
            }
            return boundValue;
        }

        if (rowData) {
            return rowData;
        }

        if (refId && pageData && pageData[refId] !== undefined) {
            if (!isRepeater && Array.isArray(pageData[refId])) {
                return pageData[refId][0] || {};
            }
            return pageData[refId];
        }

        if (refId) {
            return undefined;
        }

        return pageData || {};
    }, [formData, pageData]);

    return { treeData, getComponentData };
};
