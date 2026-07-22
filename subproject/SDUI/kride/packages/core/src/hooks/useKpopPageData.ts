'use client';
import { useQuery } from "@tanstack/react-query";

const EMPTY: Record<string, unknown> = {};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load KPOP data (${res.status})`);
  }
  const json = await res.json();
  return json.data ?? [];
}

export function useKpopPageData(screenId: string, apiBase = "") {
  return useQuery<Record<string, unknown>>({
    queryKey: ["kpop-page-data", screenId, apiBase],
    enabled: screenId.startsWith("KPOP_"),
    staleTime: 1000 * 60 * 3,
    queryFn: async () => {
      if (screenId === "KPOP_EXPLORE") {
        const [artists, events] = await Promise.all([
          getJson(`${apiBase}/api/v1/kpop/artists`),
          getJson(`${apiBase}/api/v1/kpop/events`),
        ]);
        return { artists, events };
      }
      if (screenId === "KPOP_EVENTS") {
        return { events: await getJson(`${apiBase}/api/v1/kpop/events`) };
      }
      return EMPTY;
    },
  });
}
