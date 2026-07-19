import { normalizeNode, normalizeTree } from "@/components/DynamicEngine/normalizeNode";

describe("normalizeNode", () => {
    it("normalizes snake_case metadata to canonical fields", () => {
        const result = normalizeNode({
            component_id: "summary_card",
            component_type: "STAT_CARD",
            ref_data_id: "summary",
            css_class: "metric-card",
            action_type: "OPEN_DETAIL",
            is_visible: "true",
            data_sql_key: "select_summary",
            children: [
                {
                    component_id: "label",
                    component_type: "TEXT",
                },
            ],
        });

        expect(result).toMatchObject({
            componentId: "summary_card",
            componentType: "STAT_CARD",
            refDataId: "summary",
            cssClass: "metric-card",
            actionType: "OPEN_DETAIL",
            isVisible: "true",
            dataSqlKey: "select_summary",
        });
        expect(result.children?.[0]).toMatchObject({
            componentId: "label",
            componentType: "TEXT",
        });
    });

    it("prefers existing camelCase metadata when both shapes are present", () => {
        const result = normalizeNode({
            componentId: "camel_id",
            component_id: "snake_id",
            componentType: "CHART",
            component_type: "TEXT",
            refDataId: "camel_ref",
            ref_data_id: "snake_ref",
        });

        expect(result.componentId).toBe("camel_id");
        expect(result.componentType).toBe("CHART");
        expect(result.refDataId).toBe("camel_ref");
    });

    it("normalizes backend props without overriding canonical component props", () => {
        expect(normalizeNode({
            component_id: "artist_chart",
            props: { dataPath: "preferred_artists" },
        }).componentProps).toEqual({ dataPath: "preferred_artists" });

        expect(normalizeNode({
            componentProps: { source: "camel" },
            component_props: { source: "snake" },
            props: { source: "backend" },
        }).componentProps).toEqual({ source: "camel" });
    });

    it("returns an empty normalized tree for missing input", () => {
        expect(normalizeTree(null)).toEqual([]);
        expect(normalizeTree(undefined)).toEqual([]);
    });
});
