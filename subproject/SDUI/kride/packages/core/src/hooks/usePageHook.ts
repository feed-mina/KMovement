'use client';
import { useCallback } from "react";
import { useBusinessActions } from "./useBusinessActions";

export const usePageHook = (
  screenId: string,
  metadata: any[],
  initialData: any = {}
) => {
  const actions = useBusinessActions(screenId, metadata, initialData);

  const handleAction = useCallback(
    async (meta: any, data?: any) => {
      return await actions.handleAction(meta, data);
    },
    [actions]
  );

  return { ...actions, handleAction };
};
