import React from "react";
import { render, screen } from "@testing-library/react";
import { SCREEN_MAP } from "@/components/constants/screenMap";
import { useDynamicEngine } from "@/components/DynamicEngine/useDynamicEngine";
import { normalizeChartData } from "@/components/fields/stats/statsUtils";
import GalleryGrid from "@/components/fields/gallery/GalleryGrid";

function RefProbe() {
    const { getComponentData } = useDynamicEngine([], {
        mypage_goal_stats_source: { attainment_rate: 82 },
    }, {});
    const data = getComponentData({
        componentId: "goal",
        componentType: "STAT_CARD",
        refDataId: "mypage_goal_stats_source",
    }, null);

    return <span data-testid="rate">{data.attainment_rate}</span>;
}

describe("MY_PAGE SDUI config helpers", () => {
    it("maps MY_PAGE and returns object ref data directly", () => {
        expect(SCREEN_MAP["/MY_PAGE"]).toBe("MY_PAGE");

        render(<RefProbe />);
        expect(screen.getByTestId("rate")).toHaveTextContent("82");
    });

    it("builds chart points from object series props", () => {
        const points = normalizeChartData(
            { success_count: 3, failure_count: 1, pending_count: 2 },
            {
                series: [
                    { key: "success_count", label: "Success" },
                    { key: "failure_count", label: "Failure" },
                    { key: "pending_count", label: "Pending" },
                ],
            }
        );

        expect(points).toEqual([
            { label: "Success", value: 3, color: undefined },
            { label: "Failure", value: 1, color: undefined },
            { label: "Pending", value: 2, color: undefined },
        ]);
    });

    it("renders a selectable gallery item and detail preview", () => {
        render(
            <GalleryGrid
                id="memories"
                meta={{ labelText: "Memory gallery" }}
                data={[
                    {
                        id: 1,
                        title: "Seoul clip",
                        status: "DONE",
                        result_url: "https://cdn.example.com/seoul.mp4",
                        created_at: "2026-07-08T09:00:00",
                    },
                ]}
            />
        );

        expect(screen.getByRole("button", { name: /Seoul clip/i })).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute(
            "href",
            "https://cdn.example.com/seoul.mp4"
        );
    });
});
