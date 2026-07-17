import { act, renderHook, waitFor } from "@testing-library/react";
import { useBusinessActions, useSessionStore } from "@kride/core";

// Mirrors the V22 seed row for LOGIN_PAGE.login_btn.
const LOGIN_BTN = {
  component_id: "login_btn",
  component_type: "BUTTON",
  action_type: "LOGIN_SUBMIT",
  action_url: "/api/auth/login",
};

// What the server actually returns from POST /api/auth/login (TokenResponse).
const TOKEN_RESPONSE = {
  accessToken: "access-abc",
  refreshToken: "refresh-xyz",
  userId: "tester",
  userSqno: 7,
  email: "me@naver.com",
  role: "ROLE_USER",
};

// `useBaseActions` resets form state during render whenever metadata /
// routeParams / initialData change *by reference*, so these must be stable
// across renders or the hook re-render-loops (same trap as app/[screenId].tsx).
const METADATA = [LOGIN_BTN];
const EMPTY_OBJ = {};
const RUNTIME = { apiBase: "https://api.test" };

const setup = () => {
  const navigation = { push: jest.fn(), notify: jest.fn() };
  const hook = renderHook(() =>
    useBusinessActions("LOGIN_PAGE", METADATA, EMPTY_OBJ, navigation, EMPTY_OBJ, RUNTIME)
  );
  return { navigation, hook };
};

/** Fills the three login fields the way the SDUI leaves do. */
const fillLoginForm = async (hook: ReturnType<typeof setup>["hook"]) => {
  await act(async () => {
    hook.result.current.handleChange("user_email", "me");
    hook.result.current.handleChange("user_email_domain", "naver.com");
    hook.result.current.handleChange("user_pw", "pw1234");
  });
};

describe("LOGIN_SUBMIT", () => {
  beforeEach(() => {
    useSessionStore.getState().clearSession();
    jest.restoreAllMocks();
  });

  it("joins the split email fields and establishes a session on success", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => TOKEN_RESPONSE,
    });
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await fillLoginForm(hook);
    await act(async () => {
      await hook.result.current.handleAction(LOGIN_BTN);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/auth/login");
    expect(init.method).toBe("POST");
    // user_email must be the joined address, not the bare local part.
    expect(JSON.parse(init.body)).toEqual({ user_email: "me@naver.com", user_pw: "pw1234" });

    const session = useSessionStore.getState();
    expect(session.isLoggedIn).toBe(true);
    expect(session.accessToken).toBe("access-abc");
    expect(session.user?.role).toBe("ROLE_USER");
    expect(navigation.push).toHaveBeenCalledWith("/MAIN_PAGE");
    expect(navigation.notify).not.toHaveBeenCalled();
  });

  it("does not call the API when a field is missing", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const { navigation, hook } = setup();
    await act(async () => {
      hook.result.current.handleChange("user_email", "me");
      hook.result.current.handleChange("user_pw", "pw1234");
      // no domain selected
    });
    await act(async () => {
      await hook.result.current.handleAction(LOGIN_BTN);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigation.notify).toHaveBeenCalledWith("이메일과 비밀번호를 모두 입력해주세요.");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("reports bad credentials and keeps the user logged out on 401", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }) as any;

    const { navigation, hook } = setup();
    await fillLoginForm(hook);
    await act(async () => {
      await hook.result.current.handleAction(LOGIN_BTN);
    });

    expect(navigation.notify).toHaveBeenCalledWith("로그인 정보가 올바르지 않습니다.");
    expect(useSessionStore.getState().isLoggedIn).toBe(false);
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("reports a network failure instead of throwing", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline")) as any;

    const { navigation, hook } = setup();
    await fillLoginForm(hook);
    await act(async () => {
      await hook.result.current.handleAction(LOGIN_BTN);
    });

    expect(navigation.notify).toHaveBeenCalledWith("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
    expect(useSessionStore.getState().isLoggedIn).toBe(false);
  });
});
