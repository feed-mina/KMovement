import { render, screen, fireEvent } from "@testing-library/react";
// React 18.2 does not export `act` from the `react` package (added in 18.3+).
import { act } from "react-dom/test-utils";
import SelectionCard from "@/components/kride/SelectionCard";
import { useOnboardingStore } from "@/store/onboarding-store";

// Next.js Image mock
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}));

const makeItem = (id: number) => ({
  id,
  name: `Item${id}`,
  imageUrl: "https://example.com/img.jpg",
});

beforeEach(() => {
  act(() => {
    useOnboardingStore.getState().reset();
  });
});

describe("SelectionCard - 아티스트 선택 (circle 모드)", () => {
  const circleMeta = { cssClass: "circle", actionType: "TOGGLE_ARTIST" };

  it("클릭 시 아티스트가 선택된다", () => {
    render(<SelectionCard id="c1" meta={circleMeta} data={makeItem(1)} />);
    const card = screen.getByText("Item1").closest("div[class*=selection-card]")!;
    fireEvent.click(card);
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(1);
  });

  it("5개 초과 시 disabled가 되어 추가 선택이 안 된다", () => {
    // 먼저 5개 선택
    act(() => {
      for (let i = 1; i <= 5; i++) {
        useOnboardingStore.getState().toggleArtist(makeItem(i));
      }
    });
    render(<SelectionCard id="c6" meta={circleMeta} data={makeItem(6)} />);
    const card = screen.getByText("Item6").closest("div[class*=selection-card]")!;
    fireEvent.click(card);
    // 여전히 5개
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(5);
  });

  it("선택된 카드를 다시 클릭하면 제거된다", () => {
    act(() => {
      useOnboardingStore.getState().toggleArtist(makeItem(1));
    });
    render(<SelectionCard id="c1" meta={circleMeta} data={makeItem(1)} />);
    const card = screen.getByText("Item1").closest("div[class*=selection-card]")!;
    fireEvent.click(card);
    expect(useOnboardingStore.getState().selectedArtists).toHaveLength(0);
  });
});

describe("SelectionCard - 지역 선택 (square 모드)", () => {
  const squareMeta = { cssClass: "square", actionType: "TOGGLE_REGION" };

  it("클릭 시 지역이 선택된다", () => {
    render(<SelectionCard id="r1" meta={squareMeta} data={makeItem(1)} />);
    const card = screen.getByText("Item1").closest("div[class*=selection-card]")!;
    fireEvent.click(card);
    expect(useOnboardingStore.getState().selectedRegions).toHaveLength(1);
  });

  it("5개 초과 시 추가 선택이 안 된다", () => {
    act(() => {
      for (let i = 1; i <= 5; i++) {
        useOnboardingStore.getState().toggleRegion(makeItem(i));
      }
    });
    render(<SelectionCard id="r6" meta={squareMeta} data={makeItem(6)} />);
    const card = screen.getByText("Item6").closest("div[class*=selection-card]")!;
    fireEvent.click(card);
    expect(useOnboardingStore.getState().selectedRegions).toHaveLength(5);
  });
});
