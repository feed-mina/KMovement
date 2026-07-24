import { normalizeChartData, readMetaProps, selectDataPath } from "@kride/core";

describe("stats helpers (ADMIN_DASHBOARD / MY_PAGE chart contract)", () => {
  it("reads series props against a SINGLE-type record (community stats bar)", () => {
    // V79 MY_PAGE / V71 admin_community_stats shape.
    const props = {
      series: [
        { key: "posts", label: "게시글", color: "#e11d48" },
        { key: "likes", label: "좋아요" },
        { key: "missing", label: "없음" },
      ],
    };
    expect(normalizeChartData({ posts: 4, likes: 9 }, props)).toEqual([
      { label: "게시글", value: 4, color: "#e11d48" },
      { label: "좋아요", value: 9, color: undefined },
    ]);
  });

  it("maps label/value keys over MULTI rows (signup trend line)", () => {
    const props = { labelKey: "label", valueKey: "value" };
    expect(
      normalizeChartData(
        [
          { label: "07-20", value: 2 },
          { label: "07-21", value: "1,024" },
        ],
        props
      )
    ).toEqual([
      { label: "07-20", value: 2, color: undefined },
      { label: "07-21", value: 1024, color: undefined },
    ]);
  });

  it("walks dataPath into nested api payloads (goal dashboard monthly)", () => {
    const props = readMetaProps({
      component_props: { dataPath: "monthly", labelKey: "month", valueKey: "attainmentRate" },
    });
    const payload = { monthly: [{ month: "07", attainmentRate: 80 }] };
    expect(normalizeChartData(selectDataPath(payload, props), props)).toEqual([
      { label: "07", value: 80, color: undefined },
    ]);
  });

  it("parses stringified component_props like the web engine", () => {
    expect(readMetaProps({ component_props: '{"valueKey":"total_users"}' })).toEqual({
      valueKey: "total_users",
    });
    expect(readMetaProps({ component_props: "not-json" })).toEqual({});
  });
});
