import React from "react";
import { render, screen } from "@testing-library/react";
import Chart from "@/components/fields/stats/Chart";
import { normalizeNode } from "@/components/DynamicEngine/normalizeNode";

/**
 * 빈 차트가 "기다리세요"로 끝나면 첫 사용자에게 카드가 죽어 보인다.
 * 데이터를 만들 수 있는 화면이 있으면 그 입구를 함께 둔다.
 */
function artistsChart(props: Record<string, unknown>) {
    return normalizeNode({
        component_id: "mypage_route_artists_chart",
        component_type: "CHART",
        label_text: "Preferred artists",
        props: { type: "donut", dataPath: "preferred_artists", labelKey: "label", valueKey: "value", ...props },
    });
}

describe("Chart 빈 상태", () => {
    it("emptyText·actionText·actionUrl 이 오면 진입 버튼을 함께 보여준다", () => {
        render(
            <Chart
                id="mypage_route_artists_chart"
                meta={artistsChart({
                    emptyText: "아직 추천 이력이 없어요.",
                    actionText: "K-POP 코스 만들기",
                    actionUrl: "/view/INTRO1",
                })}
                data={{ total_routes: 0, preferred_artists: [] }}
            />
        );

        expect(screen.getByText("아직 추천 이력이 없어요.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "K-POP 코스 만들기" }))
            .toHaveAttribute("href", "/view/INTRO1");
    });

    it("설정이 없으면 기존 문구를 그대로 쓰고 버튼을 만들지 않는다", () => {
        render(
            <Chart
                id="mypage_route_artists_chart"
                meta={artistsChart({})}
                data={{ total_routes: 0, preferred_artists: [] }}
            />
        );

        expect(screen.getByText("데이터가 쌓이면 라이와 함께 흐름을 보여드릴게요.")).toBeInTheDocument();
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("주소 없이 문구만 있으면 버튼을 만들지 않는다", () => {
        render(
            <Chart
                id="mypage_route_artists_chart"
                meta={artistsChart({ actionText: "코스 만들기" })}
                data={{ total_routes: 0, preferred_artists: [] }}
            />
        );

        expect(screen.queryByRole("link")).toBeNull();
    });

    it("데이터가 있으면 빈 상태를 보여주지 않는다", () => {
        render(
            <Chart
                id="mypage_route_artists_chart"
                meta={artistsChart({ actionText: "K-POP 코스 만들기", actionUrl: "/view/INTRO1" })}
                data={{ preferred_artists: [{ label: "BTS", value: 3 }] }}
            />
        );

        expect(screen.getByText("BTS")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "K-POP 코스 만들기" })).toBeNull();
    });
});
