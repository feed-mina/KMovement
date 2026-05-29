import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOnboardingStore } from "@/store/onboarding-store";
import FocusPage from "@/app/(afterLogin)/focus/page";

jest.mock("@/engine/hooks/useUiScreen", () => ({
  useUiScreen: () => ({ data: [], isLoading: false }),
}));
jest.mock("@/engine/hooks/usePageHook", () => ({
  usePageHook: () => ({ formData: {}, handleChange: jest.fn(), handleAction: jest.fn() }),
}));
jest.mock("@/engine/DynamicEngine", () => ({
  __esModule: true,
  default: () => <div data-testid="dynamic-engine" />,
}));
jest.mock("@/engine/screenMap", () => ({ SCREEN_IDS: { FOCUS: "FOCUS" } }));
jest.mock("@/components/kride/ItineraryPanel", () => ({
  __esModule: true,
  default: ({ data }: any) => (
    <div data-testid="itinerary-panel">
      {data?.itinerary?.length > 0 && <span>일정 있음</span>}
    </div>
  ),
}));
jest.mock("@/components/kride/MapView", () => ({
  __esModule: true,
  default: () => <div data-testid="map-view" />,
}));

const FASTAPI_BASE = "http://localhost:8000";
const mockReplace = jest.fn();

// next-navigation mock은 jest.config.ts moduleNameMapper 경유
// 단, useRouter의 replace 검증을 위해 모듈을 명시적으로 mock
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  usePathname: () => "/focus",
  useSearchParams: () => new URLSearchParams(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  mockReplace.mockClear();
  process.env.NEXT_PUBLIC_KRIDE_API_BASE = FASTAPI_BASE;
});

afterEach(() => {
  jest.resetAllMocks();
});

describe("FocusPage 통합 테스트", () => {
  it("duration=null이면 /browse로 redirect", async () => {
    useOnboardingStore.setState({ duration: null });

    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    ) as jest.Mock;

    render(<FocusPage />, { wrapper });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/browse");
    });
  });

  it("isItineraryLoading=true → '일정 생성 중...' 텍스트", async () => {
    useOnboardingStore.setState({ duration: "day" });

    // fetch를 resolve하지 않아 loading 상태 유지
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock;

    render(<FocusPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText("일정 생성 중...")).toBeInTheDocument();
    });
  });

  it("FastAPI /api/recommend/itinerary 응답 → ItineraryPanel 렌더링", async () => {
    useOnboardingStore.setState({
      duration: "day",
      selectedArtists: [{ id: 1, name: "BTS", imageUrl: "" }],
      selectedRegions: [{ id: 1, name: "서울", imageUrl: "" }],
    });

    const mockItinerary = [
      {
        morning: { places: [{ name: "경복궁" }] },
        afternoon: { places: [{ name: "명동" }] },
      },
    ];

    global.fetch = jest.fn((url: string) => {
      if (url.includes("/kride-api/recommend/itinerary")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            itinerary: mockItinerary,
            mapData: { markers: [{ lat: 37.5796, lng: 126.977, label: "경복궁" }] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [] }) });
    }) as jest.Mock;

    render(<FocusPage />, { wrapper });

    await waitFor(() => {
      expect(screen.getByTestId("itinerary-panel")).toBeInTheDocument();
    });
  });

  it("fetch POST body에 store 값(duration)이 포함됨", async () => {
    useOnboardingStore.setState({
      duration: "onenight",
      selectedArtists: [],
      selectedRegions: [],
    });

    let capturedBody: any = null;
    global.fetch = jest.fn((_url: string, init?: RequestInit) => {
      if (init?.body) capturedBody = JSON.parse(init.body as string);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          itinerary: [],
          mapData: { markers: [] },
        }),
      });
    }) as jest.Mock;

    render(<FocusPage />, { wrapper });

    await waitFor(() => {
      expect(capturedBody).not.toBeNull();
      expect(capturedBody.duration).toBe("onenight");
    });
  });
});
