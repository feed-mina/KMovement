'use client';
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useBaseActions } from "./useBaseActions";
import { useOnboardingStore } from "@/store/onboarding-store";

export const useBusinessActions = (
  screenId: string,
  metadata: any[] = [],
  initialData: any = {}
) => {
  const base = useBaseActions(screenId, metadata, initialData);
  const router = useRouter();

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
            window.location.href = actionUrl;
          } else {
            router.push(actionUrl);
          }
          break;

        case "SET_DURATION":
          store.setDuration(data?.value ?? data);
          router.push("/movies");
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
          router.push("/focus");
          break;

        case "GOTO_MY_LIST":
          router.push("/my-list");
          break;

        default:
          break;
      }
    },
    [base, router]
  );

  return { ...base, handleAction };
};
