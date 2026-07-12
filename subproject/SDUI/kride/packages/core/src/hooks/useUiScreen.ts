'use client';
import { useQuery } from "@tanstack/react-query";
import { Metadata } from "../type";

export function useUiScreen(screenId: string, apiBase = "") {
  return useQuery<Metadata[]>({
    queryKey: ["ui-screen", screenId],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/ui/${screenId}`);
      if (!res.ok) throw new Error(`Failed to load screen: ${screenId}`);
      const json = await res.json();
      return json.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!screenId,
  });
}
