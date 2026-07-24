import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { PATH_TO_SCREEN, collectSqlPageDataSources, useSqlPageData } from "@kride/core";

// Shaped like the V53 KRIDE_INTRO2 tree: the artist grid is a repeater GROUP
// carrying its own query key.
const INTRO2_METADATA: any[] = [
  {
    component_id: "intro2_root",
    component_type: "GROUP",
    children: [
      { component_id: "intro2_title", component_type: "TYPEWRITER_TEXT", children: null },
      {
        component_id: "intro2_artist_grid",
        component_type: "GROUP",
        ref_data_id: "artists",
        data_sql_key: "kride_artist_list",
        children: [{ component_id: "intro2_artist_card", component_type: "SELECTION_CARD", children: null }],
      },
    ],
  },
];

let queryClient: QueryClient;
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("PATH_TO_SCREEN", () => {
  it("resolves the SDUI /view/INTRO* action_url paths the main page emits", () => {
    expect(PATH_TO_SCREEN["/INTRO1"]).toBe("KRIDE_INTRO1");
    expect(PATH_TO_SCREEN["/INTRO5"]).toBe("KRIDE_INTRO5");
    expect(PATH_TO_SCREEN["/FOCUS"]).toBe("KRIDE_FOCUS");
    expect(PATH_TO_SCREEN["/MY_LIST"]).toBe("KRIDE_MY_LIST");
  });
});

describe("collectSqlPageDataSources", () => {
  it("finds repeater groups that carry a query key anywhere in the tree", () => {
    expect(collectSqlPageDataSources(INTRO2_METADATA)).toEqual([
      { refId: "artists", sqlKey: "kride_artist_list" },
    ]);
  });

  it("ignores groups without a key and inputs with a ref only", () => {
    expect(
      collectSqlPageDataSources([
        { component_id: "g", component_type: "GROUP", ref_data_id: "rows", children: null },
        { component_id: "i", component_type: "INPUT", ref_data_id: "email", children: null },
      ] as any[])
    ).toEqual([]);
  });
});

describe("useSqlPageData", () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it("fetches /api/execute/{sqlKey} and keys rows by ref_data_id", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "success", data: [{ id: 1, name: "BTS", imageUrl: "" }] }),
    });
    global.fetch = fetchMock as any;

    const hook = renderHook(
      () => useSqlPageData("KRIDE_INTRO2", INTRO2_METADATA, "https://api.test"),
      { wrapper }
    );

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/execute/kride_artist_list",
      { headers: {} }
    );
    expect(hook.result.current.data).toEqual({
      artists: [{ id: 1, name: "BTS", imageUrl: "" }],
    });
  });

  it("keeps SINGLE-type payloads as objects and fetches data_api_url sources", async () => {
    // Shaped like V71 ADMIN_DASHBOARD: an AUTO_FETCH DATA_SOURCE per stat.
    const adminMetadata: any[] = [
      {
        component_id: "admin_overview_source",
        component_type: "DATA_SOURCE",
        action_type: "AUTO_FETCH",
        ref_data_id: "admin_overview_source",
        data_sql_key: "admin_overview_stats",
        children: null,
      },
      {
        component_id: "admin_goal_dashboard_source",
        component_type: "DATA_SOURCE",
        action_type: "AUTO_FETCH",
        ref_data_id: "admin_goal_dashboard_source",
        data_api_url: "/api/admin/goal-dashboard",
        children: null,
      },
    ];
    const fetchMock = jest.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/api/execute/")
          ? { status: "success", data: { total_users: 12, today_signups: 3 } }
          : { monthly: [{ month: "07", attainmentRate: 80 }] },
    }));
    global.fetch = fetchMock as any;

    const hook = renderHook(
      () => useSqlPageData("ADMIN_DASHBOARD", adminMetadata, "https://api.test"),
      { wrapper }
    );

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/execute/admin_overview_stats",
      { headers: {} }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/api/admin/goal-dashboard",
      { headers: {} }
    );
    expect(hook.result.current.data).toEqual({
      admin_overview_source: { total_users: 12, today_signups: 3 },
      admin_goal_dashboard_source: { monthly: [{ month: "07", attainmentRate: 80 }] },
    });
  });

  it("resolves an empty list for a failing query instead of erroring the screen", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;

    const hook = renderHook(
      () => useSqlPageData("KRIDE_INTRO2", INTRO2_METADATA, "https://api.test"),
      { wrapper }
    );

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    expect(hook.result.current.data).toEqual({ artists: [] });
  });

  it("fetches nothing for screens without bound queries", () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as any;

    const hook = renderHook(() => useSqlPageData("LOGIN_PAGE", [], "https://api.test"), { wrapper });

    expect(hook.result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
