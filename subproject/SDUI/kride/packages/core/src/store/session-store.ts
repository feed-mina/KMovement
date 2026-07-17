import { create } from "zustand";

export interface SessionUser {
  userId: string | null;
  userSqno: number | null;
  email: string | null;
  role: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken?: string | null;
  userId?: string | null;
  userSqno?: number | null;
  email?: string | null;
  role?: string | null;
}

/**
 * Async key/value storage injected by the platform, so core depends on no
 * native module. Mobile registers an expo-secure-store adapter; web registers
 * nothing and keeps relying on the server's httpOnly cookies.
 */
export interface SessionStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// Stored under separate keys: expo-secure-store warns above 2048 bytes per
// value, and two JWTs plus the user record in one blob can approach that.
const ACCESS_TOKEN_KEY = "kride.accessToken";
const REFRESH_TOKEN_KEY = "kride.refreshToken";
const USER_KEY = "kride.user";

let storage: SessionStorage | null = null;

/** Registers the platform's storage. Call once, before `hydrateSession`. */
export const setSessionStorage = (adapter: SessionStorage | null) => {
  storage = adapter;
};

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  isLoggedIn: boolean;
  /** False until `hydrateSession` has run, so screens can avoid a logged-out flash. */
  isHydrated: boolean;
  setSession: (tokens: SessionTokens) => Promise<void>;
  clearSession: () => Promise<void>;
}

const toUser = (tokens: SessionTokens): SessionUser => ({
  userId: tokens.userId ?? null,
  userSqno: tokens.userSqno ?? null,
  email: tokens.email ?? null,
  role: tokens.role ?? null,
});

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoggedIn: false,
  isHydrated: false,

  setSession: async (tokens) => {
    // State first: a storage failure must not leave the app logged out in a
    // session it just authenticated.
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      user: toUser(tokens),
      isLoggedIn: true,
      isHydrated: true,
    });

    if (!storage) return;
    try {
      await Promise.all([
        storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
        tokens.refreshToken
          ? storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
          : storage.removeItem(REFRESH_TOKEN_KEY),
        storage.setItem(USER_KEY, JSON.stringify(toUser(tokens))),
      ]);
    } catch {
      // Session stays valid in memory; it just will not survive a restart.
    }
  },

  clearSession: async () => {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoggedIn: false,
      isHydrated: true,
    });

    if (!storage) return;
    try {
      await Promise.all([
        storage.removeItem(ACCESS_TOKEN_KEY),
        storage.removeItem(REFRESH_TOKEN_KEY),
        storage.removeItem(USER_KEY),
      ]);
    } catch {
      // Ignored: in-memory state is already cleared.
    }
  },
}));

/**
 * Restores a persisted session into the store. Safe to call with no storage
 * registered — it just marks the store hydrated.
 */
export const hydrateSession = async (): Promise<void> => {
  if (!storage) {
    useSessionStore.setState({ isHydrated: true });
    return;
  }

  try {
    const [accessToken, refreshToken, rawUser] = await Promise.all([
      storage.getItem(ACCESS_TOKEN_KEY),
      storage.getItem(REFRESH_TOKEN_KEY),
      storage.getItem(USER_KEY),
    ]);

    if (!accessToken) {
      useSessionStore.setState({ isHydrated: true });
      return;
    }

    let user: SessionUser | null = null;
    if (rawUser) {
      try {
        user = JSON.parse(rawUser) as SessionUser;
      } catch {
        // Corrupt record: keep the token, drop the profile.
      }
    }

    useSessionStore.setState({
      accessToken,
      refreshToken: refreshToken ?? null,
      user,
      isLoggedIn: true,
      isHydrated: true,
    });
  } catch {
    useSessionStore.setState({ isHydrated: true });
  }
};

/** `Authorization: Bearer …` header for authenticated calls, or `{}` when logged out. */
export const authHeader = (): Record<string, string> => {
  const token = useSessionStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
