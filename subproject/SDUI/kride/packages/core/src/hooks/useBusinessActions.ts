import { useCallback } from "react";
import { useBaseActions } from "./useBaseActions";
import { useOnboardingStore } from "../store/onboarding-store";
import { useSessionStore } from "../store/session-store";
import type { NavigationAdapter, RuntimeConfig } from "../config/runtimeConfig";

export const useBusinessActions = (
  screenId: string,
  metadata: any[] = [],
  initialData: any = {},
  navigation: NavigationAdapter,
  routeParams: RuntimeConfig["routeParams"] = {},
  runtime: RuntimeConfig = {}
) => {
  const base = useBaseActions(screenId, metadata, initialData, routeParams);
  const apiBase = runtime.apiBase ?? "";

  const handleAction = useCallback(
    async (meta: any, data?: any) => {
      const info = base.getMetaInfo(meta);
      if (!info) return;

      const { actionType, actionUrl, currentData } = info;
      const store = useOnboardingStore.getState();

      switch (actionType) {
        case "LOGIN_SUBMIT": {
          // The seed splits the address across two fields (`user_email` +
          // `user_email_domain`); the server expects the joined address.
          const localPart = String(currentData?.user_email ?? "").trim();
          const domain = String(currentData?.user_email_domain ?? "").trim();
          const password = String(currentData?.user_pw ?? "");

          if (!localPart || !domain || !password) {
            navigation.notify?.("이메일과 비밀번호를 모두 입력해주세요.");
            return;
          }

          try {
            const res = await fetch(`${apiBase}${actionUrl || "/api/auth/login"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_email: `${localPart}@${domain}`,
                user_pw: password,
              }),
            });

            if (!res.ok) {
              navigation.notify?.(
                res.status === 401
                  ? "로그인 정보가 올바르지 않습니다."
                  : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요."
              );
              return;
            }

            // `/api/auth/login` returns a TokenResponse body alongside the web's
            // httpOnly cookies, so mobile reads tokens and role straight from it
            // instead of following up with `/api/auth/me`.
            const token = await res.json();
            if (!token?.accessToken) {
              navigation.notify?.("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
              return;
            }

            useSessionStore.getState().setSession(token);
            navigation.push("/MAIN_PAGE");
          } catch {
            navigation.notify?.("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
          }
          break;
        }

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
    [base, navigation, apiBase]
  );

  return { ...base, handleAction };
};
