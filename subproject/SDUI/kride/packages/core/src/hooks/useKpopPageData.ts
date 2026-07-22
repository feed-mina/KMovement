'use client';
import { useQuery } from "@tanstack/react-query";

const EMPTY: Record<string, unknown> = {};

export type KpopPageParams = {
  artistId?: string | number | null;
  eventId?: string | number | null;
  region?: string | null;
  from?: string | null;
  to?: string | null;
};

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load KPOP data (${res.status})`);
  }
  const json = await res.json();
  return json.data ?? [];
}

const withQuery = (path: string, params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value).trim()) {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export function useKpopPageData(
  screenId: string,
  apiBase = "",
  params: KpopPageParams = {},
) {
  const artistId = params.artistId == null ? "" : String(params.artistId);
  const eventId = params.eventId == null ? "" : String(params.eventId);
  const region = params.region ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const hasRequiredId =
    (screenId !== "KPOP_ARTIST_DETAIL" || Boolean(artistId)) &&
    (screenId !== "KPOP_EVENT_DETAIL" || Boolean(eventId));

  return useQuery<Record<string, unknown>>({
    queryKey: ["kpop-page-data", screenId, apiBase, artistId, eventId, region, from, to],
    enabled: screenId.startsWith("KPOP_") && hasRequiredId,
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
        const path = withQuery(`${apiBase}/api/v1/kpop/events`, { region, from, to });
        return { events: await getJson(path) };
      }
      if (screenId === "KPOP_ARTIST_DETAIL") {
        return {
          // Non-repeater SDUI leaves resolve a ref_data_id array to its first
          // row. Keep detail data in that established pageData shape.
          artist: [
            await getJson(
              `${apiBase}/api/v1/kpop/artists/${encodeURIComponent(artistId)}`,
            ),
          ],
        };
      }
      if (screenId === "KPOP_EVENT_DETAIL") {
        return {
          event: [
            await getJson(
              `${apiBase}/api/v1/kpop/events/${encodeURIComponent(eventId)}`,
            ),
          ],
        };
      }
      return EMPTY;
    },
  });
}
