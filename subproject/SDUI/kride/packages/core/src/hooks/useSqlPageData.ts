'use client';
import { useQuery } from "@tanstack/react-query";
import type { Metadata } from "../engine/type";
import { authHeader, useSessionStore } from "../store/session-store";

export type SqlPageDataSource = { refId: string; sqlKey?: string; apiUrl?: string };

const flatten = (nodes: Metadata[] | null | undefined): Metadata[] => {
  if (!nodes) return [];
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
};

/**
 * Finds the metadata rows the web engine auto-fetches: repeater GROUPs that
 * carry their own query key (KRIDE_INTRO2/3 keep the artist/region list key on
 * the grid group) plus AUTO_FETCH DATA_SOURCE rows (ADMIN_DASHBOARD stats).
 * Sources may point at a query_master key or directly at an API url.
 */
export const collectSqlPageDataSources = (metadata: Metadata[]): SqlPageDataSource[] => {
  const sources: SqlPageDataSource[] = [];
  for (const node of flatten(metadata)) {
    const type = String(node.componentType || node.component_type || "").toUpperCase();
    const refId = node.refDataId || node.ref_data_id;
    const sqlKey = node.dataSqlKey || node.data_sql_key;
    const apiUrl = node.dataApiUrl || node.data_api_url;
    if (!refId || (!sqlKey && !apiUrl)) continue;
    // Parameterized urls need the web's param resolver; skip rather than 404.
    if (!sqlKey && typeof apiUrl === "string" && apiUrl.includes("{")) continue;
    if (type === "GROUP" || (type === "DATA_SOURCE" && (node.actionType || node.action_type) === "AUTO_FETCH")) {
      sources.push({
        refId: String(refId),
        sqlKey: sqlKey ? String(sqlKey) : undefined,
        apiUrl: apiUrl ? String(apiUrl) : undefined,
      });
    }
  }
  return sources;
};

/**
 * Fetches every bound source on the screen and shapes the payloads as
 * `{ [ref_data_id]: rows | record }` — the pageData contract the engine's
 * repeater path and the STAT_CARD/CHART leaves expect. SINGLE-type queries
 * return an object and are kept as-is (the web binds `res.data.data || res.data`
 * the same way). Screens without bound sources fetch nothing.
 */
export function useSqlPageData(screenId: string, metadata: Metadata[], apiBase = "") {
  const accessToken = useSessionStore((state) => state.accessToken);
  const sources = collectSqlPageDataSources(metadata);

  return useQuery<Record<string, unknown>>({
    queryKey: [
      "sql-page-data",
      screenId,
      sources.map((s) => s.sqlKey ?? s.apiUrl).join("|"),
      accessToken ?? "guest",
    ],
    enabled: sources.length > 0,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const entries = await Promise.all(
        sources.map(async ({ refId, sqlKey, apiUrl }) => {
          try {
            const url = sqlKey
              ? `${apiBase}/api/execute/${encodeURIComponent(sqlKey)}`
              : `${apiBase}${apiUrl}`;
            const res = await fetch(url, { headers: authHeader() });
            if (!res.ok) return [refId, []] as const;
            const json = await res.json().catch(() => null);
            const payload = (json as any)?.data ?? json;
            return [refId, payload ?? []] as const;
          } catch {
            // One failed source must not blank the whole screen; its consumers
            // simply render empty.
            return [refId, []] as const;
          }
        })
      );
      return Object.fromEntries(entries);
    },
  });
}
