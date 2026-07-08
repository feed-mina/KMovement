import React from "react";
import { render, screen } from "@testing-library/react";
import { SCREEN_MAP } from "@/components/constants/screenMap";
import { useDynamicEngine } from "@/components/DynamicEngine/useDynamicEngine";
import { resolveDataApiUrl } from "@/components/DynamicEngine/hook/usePageMetadata";
import { normalizeChartData } from "@/components/fields/stats/statsUtils";
import GalleryGrid from "@/components/fields/gallery/GalleryGrid";
import HistoryList from "@/components/fields/history/HistoryList";

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

function MissingRefProbe() {
    const { getComponentData } = useDynamicEngine([], {}, {});
    const data = getComponentData({
        componentId: "waiting",
        componentType: "STAT_CARD",
        refDataId: "missing_source",
    }, null);

    return <span data-testid="missing">{String(data === undefined)}</span>;
}

describe("MY_PAGE SDUI config helpers", () => {
    it("maps MY_PAGE and returns object ref data directly", () => {
        expect(SCREEN_MAP["/MY_PAGE"]).toBe("MY_PAGE");

        render(<RefProbe />);
        expect(screen.getByTestId("rate")).toHaveTextContent("82");
    });

    it("returns undefined for missing ref data so leaf widgets can show skeletons", () => {
        render(<MissingRefProbe />);
        expect(screen.getByTestId("missing")).toHaveTextContent("true");
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

    it("renders gallery skeleton while direct API data is pending", () => {
        const { container } = render(
            <GalleryGrid
                id="memories"
                meta={{ labelText: "Memory gallery" }}
                data={undefined}
            />
        );

        expect(container.querySelector(".gallery-grid.is-loading")).toBeInTheDocument();
        expect(screen.getByLabelText("Memory gallery")).toHaveAttribute("aria-busy", "true");
    });

    it("resolves direct API URL templates with logged-in user params", () => {
        expect(resolveDataApiUrl("/kride-api/users/{userSqno}/summary", { userSqno: 77 })).toBe(
            "/kride-api/users/77/summary"
        );
        expect(resolveDataApiUrl("/kride-api/users/:userId/summary", { userId: "mina@example.com" })).toBe(
            "/kride-api/users/mina%40example.com/summary"
        );
        expect(resolveDataApiUrl("/kride-api/users/{userSqno}/summary", {})).toBeNull();
    });

    it("renders travel history and recommend-again action", () => {
        render(
            <HistoryList
                id="history"
                meta={{ labelText: "Travel history", componentProps: { actionText: "Recommend again" } }}
                data={[
                    {
                        id: "h1",
                        date: "2026.07.08",
                        title: "Route planning: Seoul",
                        summary: "Seoul · BTS · 12.4km",
                        regions: ["Seoul"],
                        artists: ["BTS"],
                        distance_km: 12.4,
                    },
                ]}
            />
        );

        expect(screen.getByText("Route planning: Seoul")).toBeInTheDocument();
        expect(screen.getByText("Seoul")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Recommend again" })).toHaveAttribute("href", "/view/INTRO1");
    });

    it("renders a friendly empty state for missing travel history", () => {
        render(
            <HistoryList
                id="history"
                meta={{ labelText: "Travel history", componentProps: { emptyText: "No routes yet" } }}
                data={[]}
            />
        );

        expect(screen.getByText("No routes yet")).toBeInTheDocument();
        expect(screen.getByText(/추천을 다시 시작하면/)).toBeInTheDocument();
    });
});
