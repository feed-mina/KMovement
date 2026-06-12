/**
 * DualRangeSlider — INTRO5 예산 슬라이더 라벨 겹침/가림 수정 검증 (issue #4)
 */
import { render, screen, fireEvent } from "@testing-library/react";
import DualRangeSlider from "@/components/fields/kride/DualRangeSlider";

describe("DualRangeSlider", () => {
    it("중앙 요약 라벨은 절대배치가 아닌 중앙 정렬로 잘리지 않는다", () => {
        const { container } = render(
            <DualRangeSlider id="budget" data={{}} onChange={jest.fn()} />
        );
        expect(screen.getByText("₩30,000 ~ ₩2,000,000")).toBeInTheDocument();
        // 요약 라벨 래퍼는 text-center 정적 블록 (left: % 절대배치 시 좌측 잘림 버그)
        const summary = screen.getByText("₩30,000 ~ ₩2,000,000").parentElement!;
        expect(summary.className).toContain("text-center");
        expect(summary.style.left).toBe("");
        expect(container).toBeInTheDocument();
    });

    it("min/max가 가까우면 max 라벨이 트랙 아래(top-9)로 내려가 겹치지 않는다", () => {
        render(
            <DualRangeSlider
                id="budget"
                data={{ budget: { min: 30000, max: 300000 } }}
                onChange={jest.fn()}
            />
        );
        // max 라벨(₩300,000 알약)의 래퍼가 top-9 (트랙 아래)
        const maxPill = screen.getByText("₩300,000", { selector: "span" });
        expect(maxPill.parentElement!.className).toContain("top-9");
        // min 라벨은 위쪽 유지
        const minPill = screen.getAllByText("₩30,000", { selector: "span" })
            .find((el) => el.className.includes("bg-gray-800"))!;
        expect(minPill.parentElement!.className).toContain("-top-7");
    });

    it("min/max가 충분히 멀면 두 라벨 모두 트랙 위(-top-7)에 위치한다", () => {
        render(
            <DualRangeSlider
                id="budget"
                data={{ budget: { min: 30000, max: 2000000 } }}
                onChange={jest.fn()}
            />
        );
        const maxPill = screen.getAllByText("₩2,000,000", { selector: "span" })
            .find((el) => el.className.includes("bg-gray-800"))!;
        expect(maxPill.parentElement!.className).toContain("-top-7");
        expect(maxPill.parentElement!.className).not.toContain("top-9");
    });

    it("라벨 클릭 시 편집 input이 최상위(z-30)로 올라와 가려지지 않는다", () => {
        render(
            <DualRangeSlider
                id="budget"
                data={{ budget: { min: 30000, max: 300000 } }}
                onChange={jest.fn()}
            />
        );
        const minPill = screen.getAllByText("₩30,000", { selector: "span" })
            .find((el) => el.className.includes("bg-gray-800"))!;
        fireEvent.click(minPill.parentElement!);

        // 숨겨진 range input도 value가 30000이므로 텍스트 편집 input만 골라낸다
        const editInput = screen
            .getAllByDisplayValue("30000")
            .find((el) => (el as HTMLInputElement).type === "text")!;
        expect(editInput).toBeInTheDocument();
        expect(editInput.parentElement!.className).toContain("z-30");
    });
});
