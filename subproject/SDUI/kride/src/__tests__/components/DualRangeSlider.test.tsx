import { render, screen, fireEvent } from "@testing-library/react";
// React 18.2 does not export `act` from the `react` package (added in 18.3+).
import { act } from "react-dom/test-utils";
import DualRangeSlider from "@/components/kride/DualRangeSlider";
import { useOnboardingStore } from "@/store/onboarding-store";

beforeEach(() => {
  act(() => {
    useOnboardingStore.getState().reset();
  });
});

describe("DualRangeSlider - Intro5 예산 슬라이더", () => {
  const defaultProps = { id: "slider", meta: {}, data: {} };

  it("초기 최솟값 라벨(₩30,000)이 렌더링된다", () => {
    render(<DualRangeSlider {...defaultProps} />);
    // RangeLabel(상단)과 경계값 span(하단)에 동일 텍스트가 2개 존재
    const labels = screen.getAllByText("₩30,000");
    expect(labels).toHaveLength(2);
  });

  it("초기 최댓값 라벨(₩2,000,000)이 렌더링된다", () => {
    render(<DualRangeSlider {...defaultProps} />);
    const labels = screen.getAllByText("₩2,000,000");
    expect(labels).toHaveLength(2);
  });

  it("min 슬라이더를 변경하면 스토어 budget.min이 업데이트된다", () => {
    render(<DualRangeSlider {...defaultProps} />);
    const [minInput] = screen.getAllByRole("slider");
    fireEvent.change(minInput, { target: { value: "200000" } });
    expect(useOnboardingStore.getState().budget.min).toBe(200000);
  });

  it("max 슬라이더를 변경하면 스토어 budget.max가 업데이트된다", () => {
    render(<DualRangeSlider {...defaultProps} />);
    const [, maxInput] = screen.getAllByRole("slider");
    fireEvent.change(maxInput, { target: { value: "1500000" } });
    expect(useOnboardingStore.getState().budget.max).toBe(1500000);
  });

  it("min이 max보다 커지지 않도록 제한된다 (gap 10000)", () => {
    render(<DualRangeSlider {...defaultProps} />);
    const [minInput] = screen.getAllByRole("slider");
    // max는 2000000, min을 1999999로 설정하면 max-10000 = 1990000으로 clamp
    fireEvent.change(minInput, { target: { value: "1999999" } });
    expect(useOnboardingStore.getState().budget.min).toBeLessThanOrEqual(1990000);
  });

  it("경계값: min = 30000 설정 가능", () => {
    render(<DualRangeSlider {...defaultProps} />);
    const [minInput] = screen.getAllByRole("slider");
    fireEvent.change(minInput, { target: { value: "30000" } });
    expect(useOnboardingStore.getState().budget.min).toBe(30000);
  });

  it("경계값: max = 2000000 설정 가능", () => {
    render(<DualRangeSlider {...defaultProps} />);
    const [, maxInput] = screen.getAllByRole("slider");
    fireEvent.change(maxInput, { target: { value: "2000000" } });
    expect(useOnboardingStore.getState().budget.max).toBe(2000000);
  });
});
