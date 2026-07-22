import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { useKpopPageData } from "@kride/core";

let queryClient: QueryClient;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe("useKpopPageData", () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 7, nameKo: "BTS" } }),
    }) as jest.Mock;
  });

  it("loads an artist detail by id in the SDUI single-row shape", async () => {
    const hook = renderHook(
      () => useKpopPageData("KPOP_ARTIST_DETAIL", "https://api.example.com", { artistId: 7 }),
      { wrapper },
    );

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/api/v1/kpop/artists/7");
    expect(hook.result.current.data).toEqual({ artist: [{ id: 7, nameKo: "BTS" }] });
  });

  it("does not request a detail endpoint until its id is present", () => {
    const hook = renderHook(
      () => useKpopPageData("KPOP_EVENT_DETAIL", "https://api.example.com"),
      { wrapper },
    );

    expect(hook.result.current.fetchStatus).toBe("idle");
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
