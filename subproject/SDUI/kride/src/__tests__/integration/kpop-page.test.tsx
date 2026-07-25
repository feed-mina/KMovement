import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Stub engine/SDUI dependencies — rendering logic is covered elsewhere
jest.mock("@kride/core", () => ({
  useUiScreen: () => ({ data: [], isLoading: false, error: null }),
  useKpopPageData: (screenId: string) => {
    if (screenId !== "KPOP_EXPLORE") return { data: {}, isLoading: false, error: null };
    return {
      data: {
        artists: [
          { id: 1, nameKo: "BTS", nameEn: "BTS", imageUrl: "" },
          { id: 2, nameKo: "BLACKPINK", nameEn: "BLACKPINK", imageUrl: "" },
        ],
        events: [
          { id: 10, titleKo: "서울 팬 이벤트", region: "서울", date: "2026-08-15" },
        ],
      },
      isLoading: false,
      error: null,
    };
  },
}));

jest.mock("@/engine/DynamicEngine", () => ({
  __esModule: true,
  default: ({ pageData }: any) => (
    <div data-testid="dynamic-engine">
      {pageData?.artists?.map((a: any) => (
        <div key={a.id} data-testid="artist-item">{a.nameKo}</div>
      ))}
      {pageData?.events?.map((e: any) => (
        <div key={e.id} data-testid="event-item">{e.titleKo}</div>
      ))}
    </div>
  ),
}));

jest.mock("@/engine/hooks/usePageHook", () => ({
  usePageHook: () => ({
    formData: {},
    handleChange: jest.fn(),
    handleAction: jest.fn(),
  }),
}));

jest.mock("@/engine/screenMap", () => ({
  SCREEN_IDS: { KPOP_EXPLORE: "KPOP_EXPLORE" },
}));

// Lazy-import the page AFTER mocks are set up
let KpopExplorePage: React.ComponentType;
beforeAll(async () => {
  ({ default: KpopExplorePage } = await import("@/app/kpop/page"));
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("KpopExplorePage 통합 테스트", () => {
  it("KPOP_EXPLORE 화면이 아티스트 목록을 렌더링한다", async () => {
    render(<KpopExplorePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("dynamic-engine")).toBeInTheDocument();
      expect(screen.getAllByTestId("artist-item").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("BTS")).toBeInTheDocument();
    expect(screen.getByText("BLACKPINK")).toBeInTheDocument();
  });

  it("KPOP_EXPLORE 화면이 이벤트 목록을 렌더링한다", async () => {
    render(<KpopExplorePage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("서울 팬 이벤트")).toBeInTheDocument();
    });
  });

  it("데이터 로딩 중 로딩 메시지를 표시한다", async () => {
    // Override the mock to simulate loading state
    jest.resetModules();
    const coreMock = {
      useUiScreen: () => ({ data: [], isLoading: true, error: null }),
      useKpopPageData: () => ({ data: {}, isLoading: true, error: null }),
    };
    jest.doMock("@kride/core", () => coreMock);

    // Re-import with new mock
    const { default: PageWithLoading } = await import("@/app/kpop/page");
    render(<PageWithLoading />, { wrapper });

    // Loading state shows a non-empty status message
    const loadingEl = await screen.findByRole("main");
    expect(loadingEl).toBeInTheDocument();
    expect(loadingEl.textContent).toBeTruthy();
  });

  it("API 오류 시 오류 메시지를 표시한다", async () => {
    jest.resetModules();
    jest.doMock("@kride/core", () => ({
      useUiScreen: () => ({ data: [], isLoading: false, error: new Error("network") }),
      useKpopPageData: () => ({ data: {}, isLoading: false, error: new Error("network") }),
    }));

    const { default: PageWithError } = await import("@/app/kpop/page");
    render(<PageWithError />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/Could not load K-POP screen/)).toBeInTheDocument();
    });
  });
});
