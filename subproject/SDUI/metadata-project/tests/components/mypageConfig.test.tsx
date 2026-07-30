import React from "react";
import { render, screen } from "@testing-library/react";
import { SCREEN_MAP } from "@/components/constants/screenMap";
import { normalizeNode } from "@/components/DynamicEngine/normalizeNode";
import { useDynamicEngine } from "@/components/DynamicEngine/useDynamicEngine";
import { buildDirectApiParams, buildExecuteParams, resolveDataApiUrl } from "@/components/DynamicEngine/hook/usePageMetadata";
import Chart from "@/components/fields/stats/Chart";
import StatCard from "@/components/fields/stats/StatCard";
import { normalizeChartData, readMetaProps } from "@/components/fields/stats/statsUtils";
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

    it("renders goal labels from backend props instead of raw metric keys", () => {
        const meta = normalizeNode({
            component_id: "mypage_goal_donut",
            component_type: "CHART",
            label_text: "Goal status",
            props: {
                type: "donut",
                series: [
                    { key: "success_count", label: "Success" },
                    { key: "failure_count", label: "Failure" },
                    { key: "pending_count", label: "Pending" },
                ],
            },
        });

        render(
            <Chart
                id="mypage_goal_donut"
                meta={meta}
                data={{
                    total_goals: 6,
                    success_count: 3,
                    failure_count: 1,
                    pending_count: 2,
                    attainment_rate: 50,
                }}
            />
        );

        expect(screen.getByText("Success")).toBeInTheDocument();
        expect(screen.getByText("Failure")).toBeInTheDocument();
        expect(screen.getByText("Pending")).toBeInTheDocument();
        expect(screen.queryByText("total_goals")).not.toBeInTheDocument();
        expect(screen.queryByText("attainment_rate")).not.toBeInTheDocument();
    });

    it("selects preferred artists from a backend-shaped metadata response", () => {
        const meta = normalizeNode({
            component_id: "mypage_route_artists_chart",
            component_type: "CHART",
            label_text: "Preferred artists",
            props: {
                dataPath: "preferred_artists",
                labelKey: "label",
                valueKey: "value",
            },
        });

        render(
            <Chart
                id="mypage_route_artists_chart"
                meta={meta}
                data={{
                    total_routes: 4,
                    total_distance_km: 37.2,
                    avg_safety_score: 0.88,
                    preferred_artists: [
                        { label: "BTS", value: 3 },
                        { label: "IVE", value: 1 },
                    ],
                }}
            />
        );

        expect(screen.getByText("BTS")).toBeInTheDocument();
        expect(screen.getByText("IVE")).toBeInTheDocument();
        expect(screen.queryByText("total_routes")).not.toBeInTheDocument();
        expect(screen.queryByText("avg_safety_score")).not.toBeInTheDocument();
    });

    it("uses backend props for MY_PAGE stat cards and JSON metadata", () => {
        const meta = normalizeNode({
            component_id: "mypage_goal_rate_card",
            component_type: "STAT_CARD",
            label_text: "Goal attainment",
            props: { valueKey: "attainment_rate", suffix: "%" },
        });

        render(<StatCard id="mypage_goal_rate_card" meta={meta} data={{ attainment_rate: 82 }} />);

        expect(screen.getByLabelText("Goal attainment")).toHaveTextContent("82%");
        expect(readMetaProps({ props: '{"dataPath":"preferred_artists"}' }))
            .toEqual({ dataPath: "preferred_artists" });
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

    it("keeps server identity out of K-POP SQL payloads", () => {
        const context = {
            pageSize: 5,
            offset: 0,
            filterId: "member@example.com",
            contentId: null,
        };

        expect(buildExecuteParams("kpop_artist_cards", {}, context)).toEqual({
            pageSize: 5,
            offset: 0,
        });
        expect(buildExecuteParams("kpop_artist_detail", {}, { ...context, contentId: 7 })).toEqual({
            contentId: 7,
        });
        expect(buildExecuteParams("kpop_artist_cards", {}, { ...context, pageSize: 8, offset: 16 })).toEqual({
            pageSize: 8,
            offset: 16,
        });
    });

    it("keeps framework-generated params out of MY_PAGE SQL payloads", () => {
        const context = {
            pageSize: 5,
            offset: 10,
            filterId: "member@example.com",
            contentId: 99,
        };

        expect(buildExecuteParams("mypage_profile", {}, context)).toEqual({});
        expect(buildExecuteParams("mypage_goal_stats", { locale: "ko" }, context)).toEqual({
            locale: "ko",
        });
    });

    it("keeps framework-generated query params out of direct API requests", () => {
        expect(buildDirectApiParams({})).toEqual({});
        expect(buildDirectApiParams({ limit: 8, locale: "ko" })).toEqual({
            limit: 8,
            locale: "ko",
        });
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
