import { create } from "zustand";

export interface SessionUser {
  userId: string | null;
  userSqno: number | null;
  email: string | null;
  role: string | null;
}

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
  isLoggedIn: boolean;
  setSession: (tokens: {
    accessToken: string;
    refreshToken?: string | null;
    userId?: string | null;
    userSqno?: number | null;
    email?: string | null;
    role?: string | null;
  }) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isLoggedIn: false,
  setSession: (tokens) =>
    set({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? null,
      user: {
        userId: tokens.userId ?? null,
        userSqno: tokens.userSqno ?? null,
        email: tokens.email ?? null,
        role: tokens.role ?? null,
      },
      isLoggedIn: true,
    }),
  clearSession: () =>
    set({ accessToken: null, refreshToken: null, user: null, isLoggedIn: false }),
}));

/** `Authorization: Bearer …` header for authenticated calls, or `{}` when logged out. */
export const authHeader = (): Record<string, string> => {
  const token = useSessionStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
