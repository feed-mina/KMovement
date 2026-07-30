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
            // formData는 조회 결과(pageData)를 통째로 복사해 오므로 refId가 목록을 가리킬 수 있다.
            // 리피터가 넘겨준 현재 행이 있는데 바인딩된 값이 목록이면, 그 값은 사용자의 입력값이
            // 아니라 컬렉션이므로 현재 행이 우선한다. (KPOP_ARTIST_DETAIL처럼 리피터와 그 자식이
            // 같은 ref_data_id를 쓰는 경우) 그 외에는 기존 우선순위를 그대로 유지한다 —
            // 차트·갤러리처럼 배열 전체를 받아야 하는 목록형 컴포넌트가 있기 때문이다.
            if (rowData && Array.isArray(boundValue)) {
                return rowData;
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
