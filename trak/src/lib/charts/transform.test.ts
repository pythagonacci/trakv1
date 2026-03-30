import { describe, it, expect } from "vitest";
import { buildChartData } from "./transform";
import { applySpecFallbacks, parseChartSpec, type ChartRow, type ChartSpec } from "./chartSpec";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSpec(overrides: Partial<ChartSpec>): ChartSpec {
  const base: ChartSpec = {
    version: 1,
    chartType: "pie",
    orientation: "horizontal",
    breakdown: { field: "status" },
    measure: { type: "count" },
    normalizeTo: "focus",
    pieComposition: "breakdownOnly",
    restLabel: "Rest",
    includeOtherBucket: false,
    otherLabel: "Other",
    sort: "value_desc",
  };
  return applySpecFallbacks({ ...base, ...overrides });
}

const TASK_ROWS: ChartRow[] = [
  { id: "1", status: "todo", priority: "high", assignee: "alice" },
  { id: "2", status: "todo", priority: "low", assignee: "bob" },
  { id: "3", status: "in-progress", priority: "high", assignee: "alice" },
  { id: "4", status: "in-progress", priority: "medium", assignee: "carol" },
  { id: "5", status: "done", priority: "low", assignee: "bob" },
];

// ─── 1. Focus normalisation ───────────────────────────────────────────────────

describe("focus normalisation (pie by status)", () => {
  it("counts categories correctly", () => {
    const result = buildChartData({
      focusRows: TASK_ROWS,
      spec: makeSpec({ chartType: "pie", normalizeTo: "focus" }),
    });

    expect(result.type).toBe("categorical");
    if (result.type !== "categorical") return;

    const byLabel = Object.fromEntries(result.data.map((d) => [d.label, d.value]));
    expect(byLabel["todo"]).toBe(2);
    expect(byLabel["in-progress"]).toBe(2);
    expect(byLabel["done"]).toBe(1);
  });

  it("percents sum to 100 (focus)", () => {
    const result = buildChartData({
      focusRows: TASK_ROWS,
      spec: makeSpec({ chartType: "pie", normalizeTo: "focus" }),
    });
    if (result.type !== "categorical") return;
    const total = result.data.reduce((s, d) => s + d.percent, 0);
    expect(total).toBeCloseTo(100, 1);
  });

  it("sorts value_desc by default", () => {
    const result = buildChartData({
      focusRows: TASK_ROWS,
      spec: makeSpec({ chartType: "pie", sort: "value_desc" }),
    });
    if (result.type !== "categorical") return;
    const values = result.data.map((d) => d.value);
    expect(values[0]).toBeGreaterThanOrEqual(values[1]!);
    expect(values[1]).toBeGreaterThanOrEqual(values[2]!);
  });
});

// ─── 2. Universe normalisation ───────────────────────────────────────────────

describe("universe normalisation", () => {
  const FIGMA_ROWS: ChartRow[] = [
    { id: "1", type: "Figma", status: "Active" },
    { id: "2", type: "Figma", status: "Active" },
    { id: "3", type: "Figma", status: "Draft" },
  ];

  it("percents relative to universeTotal=10, not focusRows.length=3", () => {
    const result = buildChartData({
      focusRows: FIGMA_ROWS,
      universeTotal: 10,
      spec: makeSpec({ chartType: "pie", normalizeTo: "universe", breakdown: { field: "status" } }),
    });
    if (result.type !== "categorical") return;
    const active = result.data.find((d) => d.label === "Active");
    // 2 out of 10 = 20%
    expect(active?.percent).toBeCloseTo(20, 1);
  });

  it("warns and falls back to focus when universeTotal missing", () => {
    const result = buildChartData({
      focusRows: FIGMA_ROWS,
      // universeTotal omitted
      spec: makeSpec({ chartType: "pie", normalizeTo: "universe", breakdown: { field: "status" } }),
    });
    if (result.type !== "categorical") return;
    expect(result.meta.normalizationWarning).toBeTruthy();
    // Falls back to focus: total should equal 100%
    const total = result.data.reduce((s, d) => s + d.percent, 0);
    expect(total).toBeCloseTo(100, 1);
  });
});

// ─── 3. focusPlusRest remainder slice ────────────────────────────────────────

describe("focusPlusRest remainder", () => {
  const FIGMA_ROWS: ChartRow[] = [
    { id: "1", status: "Active" },
    { id: "2", status: "Active" },
    { id: "3", status: "Draft" },
  ];

  it("adds a Rest slice for the non-focus portion", () => {
    const result = buildChartData({
      focusRows: FIGMA_ROWS,
      universeTotal: 10,
      spec: makeSpec({
        chartType: "pie",
        normalizeTo: "universe",
        pieComposition: "focusPlusRest",
        restLabel: "Non-Figma",
        breakdown: { field: "status" },
      }),
    });
    if (result.type !== "categorical") return;
    const rest = result.data.find((d) => d.label === "Non-Figma");
    expect(rest).toBeDefined();
    expect(rest!.value).toBe(7); // 10 - 3
    expect(rest!.percent).toBeCloseTo(70, 1);
  });

  it("does NOT add rest slice when focus total == universe total", () => {
    const result = buildChartData({
      focusRows: FIGMA_ROWS,
      universeTotal: 3,
      spec: makeSpec({
        chartType: "pie",
        normalizeTo: "universe",
        pieComposition: "focusPlusRest",
        breakdown: { field: "status" },
      }),
    });
    if (result.type !== "categorical") return;
    const rest = result.data.find((d) => d.label === "Rest");
    expect(rest).toBeUndefined();
  });
});

// ─── 4. topN + Other bucket ──────────────────────────────────────────────────

describe("topN + Other bucket", () => {
  const ROWS: ChartRow[] = [
    { id: "1", tag: "alpha" }, { id: "2", tag: "alpha" }, { id: "3", tag: "alpha" },
    { id: "4", tag: "beta" }, { id: "5", tag: "beta" },
    { id: "6", tag: "gamma" },
    { id: "7", tag: "delta" },
  ];

  it("limits to top 2 categories (no Other)", () => {
    const result = buildChartData({
      focusRows: ROWS,
      spec: makeSpec({ chartType: "bar", breakdown: { field: "tag" }, topN: 2, includeOtherBucket: false }),
    });
    if (result.type !== "categorical") return;
    expect(result.data.length).toBe(2);
  });

  it("adds Other bucket when includeOtherBucket=true", () => {
    const result = buildChartData({
      focusRows: ROWS,
      spec: makeSpec({
        chartType: "bar",
        breakdown: { field: "tag" },
        topN: 2,
        includeOtherBucket: true,
        otherLabel: "Other",
      }),
    });
    if (result.type !== "categorical") return;
    const other = result.data.find((d) => d.label === "Other");
    expect(other).toBeDefined();
    expect(other!.value).toBe(2); // gamma + delta = 1+1
  });
});

// ─── 5. Null / empty bucketing ───────────────────────────────────────────────

describe("null and empty field bucketing", () => {
  const ROWS: ChartRow[] = [
    { id: "1", status: null },
    { id: "2", status: undefined },
    { id: "3", status: "" },
    { id: "4", status: "done" },
  ];

  it("maps null/undefined/empty to Unspecified", () => {
    const result = buildChartData({
      focusRows: ROWS,
      spec: makeSpec({ chartType: "pie", breakdown: { field: "status" } }),
    });
    if (result.type !== "categorical") return;
    const unspecified = result.data.find((d) => d.label === "Unspecified");
    expect(unspecified).toBeDefined();
    expect(unspecified!.value).toBe(3);
  });
});

describe("sparse persisted specs", () => {
  it("applies defaults for older specs missing measure and other defaulted fields", () => {
    const result = buildChartData({
      focusRows: TASK_ROWS,
      spec: applySpecFallbacks({
        version: 1,
        chartType: "doughnut",
        breakdown: { field: "status", fieldLabel: "Task Status" },
        normalizeTo: "focus",
        title: "Phase Overview",
      }),
    });

    expect(result.type).toBe("categorical");
    if (result.type !== "categorical") return;
    expect(result.meta.valueLabel).toBe("Count");
    expect(result.data.find((d) => d.label === "todo")?.value).toBe(2);
  });
});

// ─── 6. Multi-series bar correctness ────────────────────────────────────────

describe("multi-series bar", () => {
  const ROWS: ChartRow[] = [
    { id: "1", assignee: "alice", status: "todo" },
    { id: "2", assignee: "alice", status: "done" },
    { id: "3", assignee: "bob",   status: "todo" },
    { id: "4", assignee: "bob",   status: "todo" },
    { id: "5", assignee: "carol", status: "done" },
  ];

  it("produces SeriesDatum rows with correct counts", () => {
    const result = buildChartData({
      focusRows: ROWS,
      spec: makeSpec({
        chartType: "bar",
        breakdown: { field: "assignee" },
        series: { field: "status" },
      }),
    });
    expect(result.type).toBe("series");
    if (result.type !== "series") return;

    const alice = result.data.find((d) => d.label === "alice");
    const bob   = result.data.find((d) => d.label === "bob");
    const carol = result.data.find((d) => d.label === "carol");

    expect(alice?.todo).toBe(1);
    expect(alice?.done).toBe(1);
    expect(bob?.todo).toBe(2);
    expect(carol?.done).toBe(1);
  });

  it("includes all series keys in meta.seriesKeys", () => {
    const result = buildChartData({
      focusRows: ROWS,
      spec: makeSpec({
        chartType: "bar",
        breakdown: { field: "assignee" },
        series: { field: "status" },
      }),
    });
    if (result.type !== "series") return;
    expect(result.meta.seriesKeys).toContain("todo");
    expect(result.meta.seriesKeys).toContain("done");
  });
});

// ─── 7. Spec validation & fallbacks ─────────────────────────────────────────

describe("spec fallbacks", () => {
  it("auto-corrects vertical bar with no series to horizontal", () => {
    const { spec } = parseChartSpec({
      version: 1,
      chartType: "bar",
      orientation: "vertical",
      breakdown: { field: "status" },
    });
    expect(spec).not.toBeNull();
    const safe = applySpecFallbacks(spec!);
    expect(safe.orientation).toBe("horizontal");
  });

  it("drops series from pie spec", () => {
    const { spec } = parseChartSpec({
      version: 1,
      chartType: "pie",
      orientation: "horizontal",
      breakdown: { field: "status" },
      series: { field: "assignee" },
    });
    expect(spec).not.toBeNull();
    const safe = applySpecFallbacks(spec!);
    expect(safe.series).toBeUndefined();
  });

  it("returns error for invalid schema", () => {
    const { spec, error } = parseChartSpec({ version: 99, chartType: "pie" });
    expect(spec).toBeNull();
    expect(error).toBeTruthy();
  });
});

// ─── 8. Tag multi-value field ─────────────────────────────────────────────────

describe("multi-value tags field", () => {
  const ROWS: ChartRow[] = [
    { id: "1", tags: ["frontend", "bug"] },
    { id: "2", tags: ["frontend"] },
    { id: "3", tags: ["backend", "bug"] },
    { id: "4", tags: [] },
  ];

  it("counts each tag independently (row counted once per tag)", () => {
    const result = buildChartData({
      focusRows: ROWS,
      spec: makeSpec({ chartType: "pie", breakdown: { field: "tags" }, sort: "value_desc" }),
    });
    if (result.type !== "categorical") return;
    const byLabel = Object.fromEntries(result.data.map((d) => [d.label, d.value]));
    expect(byLabel["frontend"]).toBe(2);
    expect(byLabel["bug"]).toBe(2);
    expect(byLabel["backend"]).toBe(1);
    expect(byLabel["Unspecified"]).toBe(1);
  });
});
