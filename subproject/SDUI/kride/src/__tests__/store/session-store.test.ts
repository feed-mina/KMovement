import {
  hydrateSession,
  setSessionStorage,
  useSessionStore,
  type SessionStorage,
} from "@kride/core";

const TOKENS = {
  accessToken: "access-abc",
  refreshToken: "refresh-xyz",
  userId: "tester",
  userSqno: 7,
  email: "me@naver.com",
  role: "ROLE_USER",
};

/** In-memory stand-in for expo-secure-store. */
const makeStorage = (seed: Record<string, string> = {}) => {
  const data = new Map(Object.entries(seed));
  const storage: SessionStorage = {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
  return { storage, data };
};

const resetStore = () =>
  useSessionStore.setState({
    accessToken: null,
    refreshToken: null,
    user: null,
    isLoggedIn: false,
    isHydrated: false,
  });

describe("session persistence", () => {
  beforeEach(() => {
    resetStore();
    setSessionStorage(null);
  });

  it("writes the session through to storage on login", async () => {
    const { storage, data } = makeStorage();
    setSessionStorage(storage);

    await useSessionStore.getState().setSession(TOKENS);

    expect(data.get("kride.accessToken")).toBe("access-abc");
    expect(data.get("kride.refreshToken")).toBe("refresh-xyz");
    expect(JSON.parse(data.get("kride.user")!)).toEqual({
      userId: "tester",
      userSqno: 7,
      email: "me@naver.com",
      role: "ROLE_USER",
    });
  });

  it("restores a persisted session on hydrate", async () => {
    const { storage } = makeStorage({
      "kride.accessToken": "access-abc",
      "kride.refreshToken": "refresh-xyz",
      "kride.user": JSON.stringify({
        userId: "tester",
        userSqno: 7,
        email: "me@naver.com",
        role: "ROLE_USER",
      }),
    });
    setSessionStorage(storage);

    await hydrateSession();

    const state = useSessionStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.accessToken).toBe("access-abc");
    expect(state.refreshToken).toBe("refresh-xyz");
    expect(state.user?.role).toBe("ROLE_USER");
    expect(state.isHydrated).toBe(true);
  });

  it("survives a simulated restart: setSession then hydrate into a fresh store", async () => {
    const { storage } = makeStorage();
    setSessionStorage(storage);
    await useSessionStore.getState().setSession(TOKENS);

    resetStore(); // app restart — memory is gone, storage is not
    expect(useSessionStore.getState().isLoggedIn).toBe(false);

    await hydrateSession();

    expect(useSessionStore.getState().isLoggedIn).toBe(true);
    expect(useSessionStore.getState().accessToken).toBe("access-abc");
  });

  it("hydrates to logged-out when nothing is stored", async () => {
    const { storage } = makeStorage();
    setSessionStorage(storage);

    await hydrateSession();

    const state = useSessionStore.getState();
    expect(state.isLoggedIn).toBe(false);
    expect(state.isHydrated).toBe(true);
  });

  it("removes the persisted session on clear", async () => {
    const { storage, data } = makeStorage();
    setSessionStorage(storage);
    await useSessionStore.getState().setSession(TOKENS);

    await useSessionStore.getState().clearSession();

    expect(data.size).toBe(0);
    expect(useSessionStore.getState().isLoggedIn).toBe(false);
  });

  it("keeps the user logged in when the storage write fails", async () => {
    const { storage } = makeStorage();
    (storage.setItem as jest.Mock).mockRejectedValue(new Error("keystore unavailable"));
    setSessionStorage(storage);

    await useSessionStore.getState().setSession(TOKENS);

    // Persistence is best-effort; the authenticated session must still stand.
    expect(useSessionStore.getState().isLoggedIn).toBe(true);
    expect(useSessionStore.getState().accessToken).toBe("access-abc");
  });

  it("keeps the token but drops the profile when the stored user is corrupt", async () => {
    const { storage } = makeStorage({
      "kride.accessToken": "access-abc",
      "kride.user": "{not-json",
    });
    setSessionStorage(storage);

    await hydrateSession();

    const state = useSessionStore.getState();
    expect(state.isLoggedIn).toBe(true);
    expect(state.user).toBeNull();
  });

  it("hydrates to logged-out when storage itself throws", async () => {
    const { storage } = makeStorage();
    (storage.getItem as jest.Mock).mockRejectedValue(new Error("keystore unavailable"));
    setSessionStorage(storage);

    await hydrateSession();

    expect(useSessionStore.getState().isHydrated).toBe(true);
    expect(useSessionStore.getState().isLoggedIn).toBe(false);
  });

  it("no-ops safely when no storage is registered (web)", async () => {
    await useSessionStore.getState().setSession(TOKENS);
    expect(useSessionStore.getState().isLoggedIn).toBe(true);

    resetStore();
    await hydrateSession();

    expect(useSessionStore.getState().isHydrated).toBe(true);
    expect(useSessionStore.getState().isLoggedIn).toBe(false);
  });

  it("exposes the bearer header only while logged in", async () => {
    const { authHeader } = await import("@kride/core");
    expect(authHeader()).toEqual({});

    await useSessionStore.getState().setSession(TOKENS);
    expect(authHeader()).toEqual({ Authorization: "Bearer access-abc" });
  });
});
