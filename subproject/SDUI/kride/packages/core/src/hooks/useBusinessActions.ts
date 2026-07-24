import { useCallback } from "react";
import { useBaseActions } from "./useBaseActions";
import { useOnboardingStore } from "../store/onboarding-store";
import { useSessionStore } from "../store/session-store";
import { formatKoreanPhoneNumber, isValidKoreanMobileNumber } from "../lib/phone";
import type { NavigationAdapter, RuntimeConfig } from "../config/runtimeConfig";

const USER_ID_PATTERN = /^[A-Za-z0-9_]{4,20}$/;

/**
 * REGISTER_PAGE stores id-check bookkeeping under `_`-prefixed keys and some
 * fields under their `reg_*` component ids. The server's RegisterRequest wants
 * bare camelCase keys, so mirror the web's payload cleanup here.
 */
export const buildRegisterPayload = (formData: Record<string, unknown>) =>
  Object.keys(formData ?? {}).reduce<Record<string, unknown>>((acc, key) => {
    if (key.startsWith("_")) return acc;
    const cleanKey = key.startsWith("reg_") ? key.replace("reg_", "") : key;
    acc[cleanKey] = formData[key];
    return acc;
  }, {});

/** Best-effort human message out of a text-or-JSON error body. */
const readErrorMessage = async (res: Response, fallback: string) => {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const body = JSON.parse(text);
      return String(body?.message || fallback);
    } catch {
      return text.length <= 200 ? text.trim() : fallback;
    }
  } catch {
    return fallback;
  }
};

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
          // Typing the full address into the ID field produces
          // `id@naver.com@naver.com` → a 401 that reads as a wrong password.
          // Catch it here with a message that says what to fix.
          if (localPart.includes("@")) {
            navigation.notify?.("아이디 칸에는 @ 앞부분만 입력하세요. 도메인은 아래에서 선택해주세요.");
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
              // Prefer the server's own reason (e.g. 비활성화 계정 403, 소셜
              // 전용 계정) so a device with no logs still shows the real cause.
              const fallback =
                res.status === 401
                  ? "로그인 정보가 올바르지 않습니다."
                  : "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.";
              navigation.notify?.(await readErrorMessage(res, fallback));
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

            await useSessionStore.getState().setSession(token);
            navigation.push("/MAIN_PAGE");
          } catch {
            navigation.notify?.("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
          }
          break;
        }

        case "CHECK_USER_ID": {
          const userId = String(currentData?.userId ?? "").trim();
          if (!USER_ID_PATTERN.test(userId)) {
            navigation.notify?.("아이디는 영문, 숫자, 밑줄을 사용해 4~20자로 입력해주세요.");
            return;
          }
          try {
            const res = await fetch(
              `${apiBase}${actionUrl || "/api/auth/check-user-id"}?userId=${encodeURIComponent(userId)}`
            );
            const body = await res.json().catch(() => null);
            const available = res.ok && Boolean(body?.available);
            base.setFormData((prev: any) => ({
              ...prev,
              userId,
              _userIdChecked: available,
              _checkedUserId: available ? userId : "",
            }));
            navigation.notify?.(
              String(body?.message || (available ? "사용 가능한 아이디입니다." : "이미 사용 중인 아이디입니다."))
            );
          } catch {
            navigation.notify?.("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
          }
          break;
        }

        case "REGISTER_SUBMIT": {
          const userId = String(currentData?.userId ?? "").trim();
          if (!USER_ID_PATTERN.test(userId)) {
            navigation.notify?.("아이디는 영문, 숫자, 밑줄을 사용해 4~20자로 입력해주세요.");
            return;
          }
          if (!currentData?._userIdChecked || currentData?._checkedUserId !== userId) {
            navigation.notify?.("아이디 중복 확인을 완료해주세요.");
            return;
          }

          const submitData = buildRegisterPayload(currentData);
          submitData.userId = userId;
          submitData.phone = formatKoreanPhoneNumber(submitData.phone);
          if (!isValidKoreanMobileNumber(submitData.phone)) {
            navigation.notify?.("휴대폰 번호를 010-1234-5678 형식으로 입력해주세요.");
            return;
          }
          if (!submitData.zipCode || !submitData.roadAddress) {
            navigation.notify?.("주소 찾기로 우편번호와 도로명 주소를 입력해주세요.");
            return;
          }
          const email = String(submitData.email ?? "").trim();
          if (!email) {
            navigation.notify?.("이메일을 입력해주세요.");
            return;
          }

          try {
            const res = await fetch(`${apiBase}${actionUrl || "/api/auth/register"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(submitData),
            });
            if (res.status !== 200 && res.status !== 201) {
              navigation.notify?.(await readErrorMessage(res, "회원가입에 실패했습니다."));
              return;
            }

            // Account creation and the welcome mail are separate: a mail
            // failure must not read as a failed signup (web does the same).
            let mailSent = false;
            try {
              const mailRes = await fetch(`${apiBase}/api/auth/signup?message=welcome`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              mailSent = mailRes.ok;
            } catch {
              mailSent = false;
            }

            navigation.notify?.(
              mailSent
                ? "가입 성공! 이메일로 발송된 인증코드를 확인해주세요."
                : "가입은 완료됐지만 인증 메일 전송에 실패했습니다. 인증 페이지에서 재전송해주세요."
            );
            navigation.push(`/VERIFY_CODE_PAGE?email=${encodeURIComponent(email)}`);
          } catch {
            navigation.notify?.("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
          }
          break;
        }

        case "VERIFY_CODE": {
          const email = String(currentData?.email ?? currentData?.reg_email ?? "").trim();
          const code = String(currentData?.code ?? currentData?.reg_code ?? "").trim();
          if (!email) {
            navigation.notify?.("이메일 정보가 없습니다. 다시 시도해주세요.");
            return;
          }
          if (!code) {
            navigation.notify?.("인증 번호를 입력해주세요.");
            return;
          }
          try {
            const res = await fetch(`${apiBase}${actionUrl || "/api/auth/verify-code"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, code }),
            });
            if (!res.ok) {
              navigation.notify?.(await readErrorMessage(res, "인증에 실패했습니다."));
              return;
            }
            navigation.notify?.("인증을 성공했습니다.");
            navigation.push("/LOGIN_PAGE");
          } catch {
            navigation.notify?.("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
          }
          break;
        }

        case "RESEND_CODE": {
          const email = String(currentData?.email ?? currentData?.reg_email ?? "").trim();
          if (!email) {
            navigation.notify?.("이메일 정보가 없습니다. 다시 시도해주세요.");
            return;
          }
          try {
            const res = await fetch(`${apiBase}${actionUrl || "/api/auth/resend-code"}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            navigation.notify?.(
              res.ok ? "새 인증코드가 이메일로 전송되었습니다." : await readErrorMessage(res, "인증코드 재전송에 실패했습니다.")
            );
          } catch {
            navigation.notify?.("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
          }
          break;
        }

        case "OPEN_POSTCODE":
          navigation.openPostcode?.((result) => {
            base.setFormData((prev: any) => ({
              ...prev,
              zipCode: result.zipCode,
              roadAddress: result.roadAddress,
            }));
          });
          break;

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
