import { z } from "zod";

// ─── Measure ────────────────────────────────────────────────────────────────

export const ChartMeasureSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("count") }),
  z.object({ type: z.literal("sum"), field: z.string().min(1) }),
  z.object({ type: z.literal("avg"), field: z.string().min(1) }),
]);
export type ChartMeasure = z.infer<typeof ChartMeasureSchema>;

// ─── Breakdown field ────────────────────────────────────────────────────────

export const ChartBreakdownFieldSchema = z.object({
  /** Key that exists on ChartRow objects, e.g. "status", "priority", "assignee" */
  field: z.string().min(1),
  /** Human label for axis / legend header */
  fieldLabel: z.string().optional(),
});
export type ChartBreakdownField = z.infer<typeof ChartBreakdownFieldSchema>;

// ─── Main Spec ──────────────────────────────────────────────────────────────

export const ChartSpecV1Schema = z.object({
  /** Schema version — always 1 for this version */
  version: z.literal(1),

  /** Render style */
  chartType: z.enum(["pie", "doughnut", "bar"]),

  /**
   * Bar orientation.
   * "horizontal" works for both single-series and multi-series.
   * "vertical"   is only valid when a series field is set; auto-corrected otherwise.
   */
  orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),

  /** Primary grouping dimension (required) */
  breakdown: ChartBreakdownFieldSchema,

  /**
   * Secondary grouping dimension — enables multi-series bars.
   * Ignored for pie / doughnut.
   */
  series: ChartBreakdownFieldSchema.optional(),

  /** What numeric value to aggregate */
  measure: ChartMeasureSchema.default({ type: "count" }),

  /**
   * What the denominator is when computing percentages.
   * "focus"    → 100% = total of focus rows
   * "universe" → 100% = universeTotal (must be supplied; falls back to "focus" with warning)
   */
  normalizeTo: z.enum(["focus", "universe"]).default("focus"),

  /**
   * Controls whether a "rest of universe" slice is added.
   * Only relevant for pie/doughnut when normalizeTo = "universe".
   * "breakdownOnly"  → render only the focus breakdown slices
   * "focusPlusRest"  → add a remainder slice for universe − focus total
   */
  pieComposition: z
    .enum(["breakdownOnly", "focusPlusRest"])
    .default("breakdownOnly"),

  /** Label for the remainder slice */
  restLabel: z.string().default("Rest"),

  /** Keep only the top N categories (by value). Applied before "Other" bucket. */
  topN: z.number().int().positive().optional(),

  /** Roll categories beyond topN into a single "Other" bucket */
  includeOtherBucket: z.boolean().default(false),

  /** Label for the "Other" bucket */
  otherLabel: z.string().default("Other"),

  /**
   * Sort order for categories / breakdown labels.
   * Stable tiebreak: label asc after primary sort.
   */
  sort: z
    .enum(["value_desc", "value_asc", "label_asc", "label_desc"])
    .default("value_desc"),

  /** Chart title (optional; shown in ChartCard header) */
  title: z.string().optional(),

  /** Y-axis / value axis label override */
  valueLabel: z.string().optional(),

  /** X-axis / category axis label override */
  labelLabel: z.string().optional(),
});

export type ChartSpec = z.infer<typeof ChartSpecV1Schema>;

// ─── Row type (normalized entity row) ───────────────────────────────────────

/**
 * A single data row passed to the transform engine.
 * Field values should be scalars or string arrays (for multi-value fields like tags).
 */
export interface ChartRow {
  id: string;
  [field: string]: unknown;
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface CategoryDatum {
  label: string;
  value: number;
  /** Percentage within the normalisation scope (0-100) */
  percent: number;
  meta?: Record<string, unknown>;
}

/**
 * One row in a multi-series bar dataset.
 * label = breakdown category; each series key maps to a numeric value.
 */
export type SeriesDatum = {
  label: string;
} & Record<string, number | string>;

export interface ChartMeta {
  /** Series keys present in SeriesDatum rows (multi-series bar only) */
  seriesKeys?: string[];
  /** Denominator total (universe count) */
  totalUniverse?: number;
  /** Sum of all focus row values */
  totalFocus?: number;
  /** Axis / tooltip label for the value */
  valueLabel: string;
  /** Axis / tooltip label for the category */
  labelLabel: string;
  /** Shown in UI when fallback normalisation is applied */
  normalizationWarning?: string;
}

export type CategoricalChartData = {
  type: "categorical";
  data: CategoryDatum[];
  meta: ChartMeta;
};

export type SeriesChartData = {
  type: "series";
  data: SeriesDatum[];
  meta: ChartMeta;
};

export type ChartData = CategoricalChartData | SeriesChartData;

const DEFAULT_CHART_SPEC_INPUT = {
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
} as const;

// ─── Validation helpers ──────────────────────────────────────────────────────

/** Safe parse with Zod — returns parsed spec or null + error message */
export function parseChartSpec(
  raw: unknown
): { spec: ChartSpec; error: null } | { spec: null; error: string } {
  const result = ChartSpecV1Schema.safeParse(raw);
  if (result.success) {
    return { spec: result.data, error: null };
  }
  // Zod v4 uses .issues; v3 used .errors – handle both
  const issues = (result.error as any).issues ?? (result.error as any).errors ?? [];
  const first = issues[0] as { path: (string | number)[]; message: string } | undefined;
  const msg = first ? `${first.path.join(".")}: ${first.message}` : "Invalid chart spec";
  return { spec: null, error: msg };
}

/** Apply safe fallbacks so ChartBlock never crashes */
export function applySpecFallbacks(spec: unknown): ChartSpec {
  const raw =
    spec && typeof spec === "object" ? (spec as Record<string, unknown>) : {};

  const normalizedCandidate = {
    ...DEFAULT_CHART_SPEC_INPUT,
    ...raw,
    breakdown:
      raw.breakdown && typeof raw.breakdown === "object"
        ? {
            ...DEFAULT_CHART_SPEC_INPUT.breakdown,
            ...(raw.breakdown as Record<string, unknown>),
          }
        : DEFAULT_CHART_SPEC_INPUT.breakdown,
    ...(raw.series && typeof raw.series === "object"
      ? {
          series: {
            field: "status",
            ...(raw.series as Record<string, unknown>),
          },
        }
      : {}),
  };

  const parsed = ChartSpecV1Schema.safeParse(normalizedCandidate);
  let safe = parsed.success
    ? parsed.data
    : ChartSpecV1Schema.parse({
        ...DEFAULT_CHART_SPEC_INPUT,
        ...(typeof raw.title === "string" ? { title: raw.title } : {}),
        ...(typeof raw.valueLabel === "string" ? { valueLabel: raw.valueLabel } : {}),
        ...(typeof raw.labelLabel === "string" ? { labelLabel: raw.labelLabel } : {}),
      });

  // Vertical bar without series → switch to horizontal single-series
  if (safe.chartType === "bar" && safe.orientation === "vertical" && !safe.series) {
    safe = { ...safe, orientation: "horizontal" };
  }

  // Pie/doughnut with series → ignore series
  if ((safe.chartType === "pie" || safe.chartType === "doughnut") && safe.series) {
    const { series: _ignored, ...rest } = safe;
    safe = rest as ChartSpec;
  }

  // focusPlusRest only makes sense for pie/doughnut + universe normalisation
  if (
    safe.pieComposition === "focusPlusRest" &&
    (safe.chartType === "bar" || safe.normalizeTo !== "universe")
  ) {
    safe = { ...safe, pieComposition: "breakdownOnly" };
  }

  return safe;
}

/** Default field priority when breakdown.field is not found in rows */
export const DEFAULT_BREAKDOWN_PRIORITY = [
  "status",
  "priority",
  "assignee",
  "type",
  "tags",
];
