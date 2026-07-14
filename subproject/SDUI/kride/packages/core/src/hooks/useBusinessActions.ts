import { useCallback } from "react";
import { useBaseActions } from "./useBaseActions";
import { useOnboardingStore } from "../store/onboarding-store";
import type { NavigationAdapter, RuntimeConfig } from "../config/runtimeConfig";

export const useBusinessActions = (
  screenId: string,
  metadata: any[] = [],
  initialData: any = {},
  navigation: NavigationAdapter,
  routeParams: RuntimeConfig["routeParams"] = {}
) => {
  const base = useBaseActions(screenId, metadata, initialData, routeParams);

  const handleAction = useCallback(
    async (meta: any, data?: any) => {
      const info = base.getMetaInfo(meta);
      if (!info) return;

      const { actionType, actionUrl } = info;
      const store = useOnboardingStore.getState();

      switch (actionType) {
        case "LINK":
        case "ROUTE":
          if (!actionUrl) return;
          if (actionUrl.startsWith("http")) {
            navigation.openExternal?.(actionUrl);
          } else {
            navigation.push(actionUrl);
          }
          break;

        case "SET_DURATION":
          store.setDuration(data?.value ?? data);
          navigation.push("/movies");
          break;

        case "TOGGLE_ARTIST":
          store.toggleArtist(data);
          break;

        case "TOGGLE_REGION":
          store.toggleRegion(data);
          break;

        case "SET_PURPOSES":
          store.togglePurpose(data?.value ?? data);
          break;

        case "SET_BUDGET":
          store.setBudget(data);
          break;

        case "GOTO_FOCUS":
          navigation.push("/focus");
          break;

        case "GOTO_MY_LIST":
          navigation.push("/my-list");
          break;

        default:
          break;
      }
    },
    [base, navigation]
  );

  return { ...base, handleAction };
};
