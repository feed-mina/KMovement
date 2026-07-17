'use client';
import { useCallback } from "react";
import { useBusinessActions } from "./useBusinessActions";
import type { NavigationAdapter, RuntimeConfig } from "../config/runtimeConfig";

export const usePageHook = (
  screenId: string,
  metadata: any[],
  initialData: any = {},
  navigation: NavigationAdapter,
  routeParams: RuntimeConfig["routeParams"] = {},
  runtime: RuntimeConfig = {}
) => {
  const actions = useBusinessActions(screenId, metadata, initialData, navigation, routeParams, runtime);

  const handleAction = useCallback(
    async (meta: any, data?: any) => {
      return await actions.handleAction(meta, data);
    },
    [actions]
  );

  return { ...actions, handleAction };
};
