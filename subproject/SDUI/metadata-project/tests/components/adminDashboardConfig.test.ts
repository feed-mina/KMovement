import { SCREEN_MAP } from "@/components/constants/screenMap";
import { normalizeChartData, selectDataPath } from "@/components/fields/stats/statsUtils";

describe("ADMIN_DASHBOARD SDUI config helpers", () => {
    it("maps the admin dashboard route to the screen id", () => {
        expect(SCREEN_MAP["/ADMIN_DASHBOARD"]).toBe("ADMIN_DASHBOARD");
    });

    it("selects nested API data for chart components", () => {
        const apiResponse = {
            monthly: [
                { month: "2026-06", attainmentRate: 71.5 },
                { month: "2026-07", attainmentRate: 82 },
            ],
        };

        const selected = selectDataPath(apiResponse, { dataPath: "monthly" });
        expect(normalizeChartData(selected, { labelKey: "month", valueKey: "attainmentRate" })).toEqual([
            { label: "2026-06", value: 71.5, color: undefined },
            { label: "2026-07", value: 82, color: undefined },
        ]);
    });

    it("selects travel trend regions from FastAPI aggregate responses", () => {
        const apiResponse = {
            regions: [
                { label: "Seoul", value: 9 },
                { label: "Busan", value: 4 },
            ],
            artists: [
                { label: "BTS", value: 7 },
            ],
        };

        const selected = selectDataPath(apiResponse, { dataPath: "regions" });
        expect(normalizeChartData(selected, { labelKey: "label", valueKey: "value" })).toEqual([
            { label: "Seoul", value: 9, color: undefined },
            { label: "Busan", value: 4, color: undefined },
        ]);
    });
});
