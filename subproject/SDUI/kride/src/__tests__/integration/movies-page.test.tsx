import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/onboarding-store";
import MoviesPage from "@/app/(afterLogin)/movies/page";

// useUiScreen / usePageHook / DynamicEngine은 테스트 범위 밖 — 단순 stub
jest.mock("@/engine/hooks/useUiScreen", () => ({
  useUiScreen: () => ({ data: [], isLoading: false }),
}));
jest.mock("@/engine/hooks/usePageHook", () => ({
  usePageHook: () => ({ formData: {}, handleChange: jest.fn(), handleAction: jest.fn() }),
}));
jest.mock("@/engine/DynamicEngine", () => ({
  __esModule: true,
  default: ({ pageData }: any) => (
    <div data-testid="dynamic-engine">
      {pageData?.artistList?.map((a: any) => (
        <div key={a.id} data-testid="artist-item">{a.name}</div>
      ))}
    </div>
  ),
}));
jest.mock("@/engine/screenMap", () => ({ SCREEN_IDS: { INTRO2: "INTRO2" } }));

const FASTAPI_BASE = "http://localhost:8000";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  useOnboardingStore.setState({ selectedArtists: [], selectedRegions: [] });
  process.env.NEXT_PUBLIC_KRIDE_API_BASE = FASTAPI_BASE;
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("MoviesPage 통합 테스트", () => {
  it("FastAPI /api/artists 응답 → 아티스트 이름 렌더링", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/kride-api/artists")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            artists: [
              { id: 1, name: "BTS", imageUrl: "" },
              { id: 2, name: "블랙핑크", imageUrl: "" },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    }) as jest.Mock;

    render(<MoviesPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("BTS")).toBeInTheDocument();
      expect(screen.getByText("블랙핑크")).toBeInTheDocument();
    });
  });

  it("아티스트 0개 선택 시 '다음 →' 버튼 disabled", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ artists: [] }) })
    ) as jest.Mock;

    render(<MoviesPage />, { wrapper });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /다음/ });
      expect(btn).toBeDisabled();
    });
  });

  it("fetch가 올바른 FastAPI URL로 호출됨", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ artists: [] }) })
    ) as jest.Mock;

    render(<MoviesPage />, { wrapper });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/kride-api/artists`)
      );
    });
  });
});
