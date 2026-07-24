'use client';
import { useQuery } from "@tanstack/react-query";
import { Metadata } from "../engine/type";
import { authHeader, useSessionStore } from "../store/session-store";

export function useUiScreen(screenId: string, apiBase = "") {
  // Role-gated screens (ADMIN_DASHBOARD 등) are filtered server-side by the
  // caller's role: send the bearer token when we have one, and key the cache
  // on it so login/logout swaps the metadata instead of reusing GUEST rows.
  const accessToken = useSessionStore((state) => state.accessToken);

  return useQuery<Metadata[]>({
    queryKey: ["ui-screen", screenId, accessToken ?? "guest"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/ui/${screenId}`, { headers: authHeader() });
      // Status is part of the message so release builds, which have no logs,
      // can tell a server rejection apart from an unreachable host on screen.
      if (!res.ok) throw new Error(`Failed to load screen: ${screenId} (HTTP ${res.status})`);
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!screenId,
  });
}
