import { Metadata } from "./type";

export const useDynamicEngine = (metadata: Metadata[], pageData: any, formData: any) => {
  const treeData = metadata;

  const getComponentData = (node: Metadata, rowData: any) => {
    const refId = node.refDataId || node.ref_data_id;

    if (refId && formData && formData[refId] !== undefined) {
      return formData[refId];
    }

    if (rowData) {
      return rowData;
    }

    if (refId && pageData && pageData[refId]) {
      const isRepeater = node.children && node.children.length > 0;
      if (!isRepeater && Array.isArray(pageData[refId])) {
        return pageData[refId][0] || {};
      }
      return isRepeater ? pageData[refId] : pageData;
    }

    return pageData || {};
  };

  return { treeData, getComponentData };
};
