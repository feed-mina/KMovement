import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/onboarding-store";
import LatestPage from "@/app/(afterLogin)/latest/page";

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
      {pageData?.regionList?.map((r: any) => (
        <div key={r.id} data-testid="region-item">{r.name}</div>
      ))}
    </div>
  ),
}));
jest.mock("@/engine/screenMap", () => ({ SCREEN_IDS: { INTRO3: "INTRO3" } }));

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

describe("LatestPage 통합 테스트", () => {
  it("FastAPI /api/regions 응답 → 지역 이름 렌더링", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/kride-api/regions")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            regions: [
              { id: 1, name: "서울", imageUrl: "" },
              { id: 2, name: "경기", imageUrl: "" },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    }) as jest.Mock;

    render(<LatestPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("서울")).toBeInTheDocument();
      expect(screen.getByText("경기")).toBeInTheDocument();
    });
  });

  it("지역 0개 선택 시 '다음 →' 버튼 disabled", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ regions: [] }) })
    ) as jest.Mock;

    render(<LatestPage />, { wrapper });

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /다음/ });
      expect(btn).toBeDisabled();
    });
  });

  it("fetch가 올바른 FastAPI URL로 호출됨", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ regions: [] }) })
    ) as jest.Mock;

    render(<LatestPage />, { wrapper });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/kride-api/regions`)
      );
    });
  });
});
