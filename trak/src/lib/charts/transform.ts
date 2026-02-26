import {
  applySpecFallbacks,
  DEFAULT_BREAKDOWN_PRIORITY,
  type CategoricalChartData,
  type CategoryDatum,
  type ChartData,
  type ChartMeta,
  type ChartRow,
  type ChartSpec,
  type SeriesChartData,
  type SeriesDatum,
} from "./chartSpec";

// ─── Constants ───────────────────────────────────────────────────────────────

const UNSPECIFIED_LABEL = "Unspecified";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Normalize a raw field value to an array of string labels */
function fieldToLabels(value: unknown): string[] {
  if (value === null || value === undefined || value === "") {
    return [UNSPECIFIED_LABEL];
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return [UNSPECIFIED_LABEL];
    return value.map((v) =>
      v === null || v === undefined || v === "" ? UNSPECIFIED_LABEL : String(v).trim() || UNSPECIFIED_LABEL
    );
  }
  const str = String(value).trim();
  return [str || UNSPECIFIED_LABEL];
}

/** Get the numeric measure value for a row */
function measureValue(row: ChartRow, spec: ChartSpec): number {
  if (spec.measure.type === "count") return 1;
  const field = (spec.measure as { type: "sum" | "avg"; field: string }).field;
  const v = row[field];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const parsed = parseFloat(String(v));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Sort an array of [label, value] pairs */
function sortEntries(
  entries: Array<[string, number]>,
  sort: ChartSpec["sort"]
): Array<[string, number]> {
  return [...entries].sort(([labelA, valueA], [labelB, valueB]) => {
    if (sort === "value_desc") {
      const d = valueB - valueA;
      return d !== 0 ? d : labelA.localeCompare(labelB);
    }
    if (sort === "value_asc") {
      const d = valueA - valueB;
      return d !== 0 ? d : labelA.localeCompare(labelB);
    }
    if (sort === "label_asc") return labelA.localeCompare(labelB);
    if (sort === "label_desc") return labelB.localeCompare(labelA);
    return 0;
  });
}

/** Detect the first field that exists in all/most rows */
function autoPickField(rows: ChartRow[]): string | null {
  for (const candidate of DEFAULT_BREAKDOWN_PRIORITY) {
    if (rows.some((r) => r[candidate] !== undefined)) return candidate;
  }
  // Fall back to first non-id key
  const keys = Object.keys(rows[0] || {}).filter((k) => k !== "id");
  return keys[0] ?? null;
}

/** Aggregate a list of rows → Map<label, sumValue> for a single field */
function aggregateField(
  rows: ChartRow[],
  field: string,
  spec: ChartSpec
): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    const labels = fieldToLabels(row[field]);
    // For multi-value fields (tags), count row once per label value
    for (const label of labels) {
      const existing = result.get(label) ?? 0;
      result.set(label, existing + measureValue(row, spec));
    }
  }
  return result;
}

/** Apply topN + optional "Other" bucket to sorted entries */
function applyTopN(
  sorted: Array<[string, number]>,
  topN: number | undefined,
  includeOther: boolean,
  otherLabel: string
): Array<[string, number]> {
  if (!topN || topN >= sorted.length) return sorted;
  const top = sorted.slice(0, topN);
  if (includeOther) {
    const restValue = sorted.slice(topN).reduce((acc, [, v]) => acc + v, 0);
    if (restValue > 0) {
      top.push([otherLabel, restValue]);
    }
  }
  return top;
}

// ─── avg finalisation ─────────────────────────────────────────────────────────

/** When measure is avg, we need sum/count per cell separately */
function aggregateFieldAvg(
  rows: ChartRow[],
  field: string,
  avgField: string
): Map<string, { sum: number; count: number }> {
  const result = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    const labels = fieldToLabels(row[field]);
    const v = parseFloat(String(row[avgField]));
    const numericV = Number.isNaN(v) ? 0 : v;
    for (const label of labels) {
      const existing = result.get(label) ?? { sum: 0, count: 0 };
      result.set(label, { sum: existing.sum + numericV, count: existing.count + 1 });
    }
  }
  return result;
}

function finalizeAvg(acc: Map<string, { sum: number; count: number }>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [label, { sum, count }] of acc) {
    out.set(label, count > 0 ? sum / count : 0);
  }
  return out;
}

// ─── Categorical (pie / doughnut / single-series bar) ────────────────────────

function buildCategorical(
  rows: ChartRow[],
  field: string,
  spec: ChartSpec,
  universeTotal: number | undefined
): CategoricalChartData {
  let aggMap: Map<string, number>;

  if (spec.measure.type === "avg") {
    const acc = aggregateFieldAvg(rows, field, (spec.measure as any).field);
    aggMap = finalizeAvg(acc);
  } else {
    aggMap = aggregateField(rows, field, spec);
  }

  const focusTotal = [...aggMap.values()].reduce((s, v) => s + v, 0);

  // Determine universe total and warn if unavailable
  let uTotal = universeTotal;
  let normalizationWarning: string | undefined;
  if (spec.normalizeTo === "universe" && !uTotal) {
    uTotal = focusTotal;
    normalizationWarning =
      "Universe total unavailable; percentages are relative to focus data.";
  }
  const denominator =
    spec.normalizeTo === "universe" && uTotal ? uTotal : focusTotal;

  // Sort entries
  const sorted = sortEntries([...aggMap.entries()], spec.sort);

  // topN + other
  const trimmed = applyTopN(
    sorted,
    spec.topN,
    spec.includeOtherBucket,
    spec.otherLabel
  );

  // Build CategoryDatum[]
  const data: CategoryDatum[] = trimmed.map(([label, value]) => ({
    label,
    value,
    percent: denominator > 0 ? (value / denominator) * 100 : 0,
  }));

  // Add rest slice for pie/doughnut + universe normalisation
  if (
    (spec.chartType === "pie" || spec.chartType === "doughnut") &&
    spec.normalizeTo === "universe" &&
    spec.pieComposition === "focusPlusRest" &&
    uTotal !== undefined
  ) {
    const focusTrimmedTotal = data.reduce((s, d) => s + d.value, 0);
    const rest = uTotal - focusTrimmedTotal;
    if (rest > 0) {
      data.push({
        label: spec.restLabel,
        value: rest,
        percent: (rest / uTotal) * 100,
      });
    }
  }

  const meta: ChartMeta = {
    totalFocus: focusTotal,
    totalUniverse: uTotal,
    valueLabel: spec.valueLabel ?? (spec.measure.type === "count" ? "Count" : "Value"),
    labelLabel: spec.labelLabel ?? (spec.breakdown.fieldLabel ?? field),
    normalizationWarning,
  };

  return { type: "categorical", data, meta };
}

// ─── Multi-series bar ────────────────────────────────────────────────────────

function buildSeries(
  rows: ChartRow[],
  breakdownField: string,
  seriesField: string,
  spec: ChartSpec
): SeriesChartData {
  // Double-aggregate: breakdown × series → Map<breakdownLabel, Map<seriesLabel, value>>
  const outer = new Map<string, Map<string, number>>();

  for (const row of rows) {
    const breakdownLabels = fieldToLabels(row[breakdownField]);
    const seriesLabels = fieldToLabels(row[seriesField]);
    const val = measureValue(row, spec);

    for (const bl of breakdownLabels) {
      if (!outer.has(bl)) outer.set(bl, new Map());
      const inner = outer.get(bl)!;
      for (const sl of seriesLabels) {
        inner.set(sl, (inner.get(sl) ?? 0) + val);
      }
    }
  }

  // Collect all series keys (stable sorted)
  const allSeriesKeys = Array.from(
    new Set([...outer.values()].flatMap((m) => [...m.keys()]))
  ).sort((a, b) => a.localeCompare(b));

  // Aggregate breakdown totals for sorting
  const breakdownTotals: Array<[string, number]> = [...outer.entries()].map(
    ([label, inner]) => [label, [...inner.values()].reduce((s, v) => s + v, 0)]
  );
  const sorted = sortEntries(breakdownTotals, spec.sort);
  const trimmed = applyTopN(sorted, spec.topN, spec.includeOtherBucket, spec.otherLabel);

  const data: SeriesDatum[] = trimmed.map(([label]) => {
    const inner = outer.get(label) ?? new Map<string, number>();
    const row: SeriesDatum = { label };
    for (const sk of allSeriesKeys) {
      row[sk] = inner.get(sk) ?? 0;
    }
    return row;
  });

  // Universe / focus totals
  const focusTotal = breakdownTotals.reduce((s, [, v]) => s + v, 0);
  let uTotal = spec.normalizeTo === "universe" ? (undefined as number | undefined) : undefined;
  let normalizationWarning: string | undefined;
  if (spec.normalizeTo === "universe" && !uTotal) {
    uTotal = focusTotal;
    normalizationWarning =
      "Universe total unavailable; percentages are relative to focus data.";
  }

  const meta: ChartMeta = {
    seriesKeys: allSeriesKeys,
    totalFocus: focusTotal,
    totalUniverse: uTotal,
    valueLabel: spec.valueLabel ?? (spec.measure.type === "count" ? "Count" : "Value"),
    labelLabel: spec.labelLabel ?? (spec.breakdown.fieldLabel ?? breakdownField),
    normalizationWarning,
  };

  return { type: "series", data, meta };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BuildChartDataInput {
  /** Focus rows (the subset being charted) */
  focusRows: ChartRow[];
  /**
   * Universe total — total count of the denominator scope.
   * Required when spec.normalizeTo === "universe".
   * If omitted, falls back to focusRows.length with a warning.
   */
  universeTotal?: number;
  /** Validated and fallback-applied chart spec */
  spec: ChartSpec;
}

/**
 * Core transform: rows + spec → chart-ready data.
 * Always returns a valid ChartData or throws a typed error.
 *
 * Call applySpecFallbacks(spec) before passing here to guarantee safe defaults.
 */
export function buildChartData(input: BuildChartDataInput): ChartData {
  const { focusRows, universeTotal, spec: rawSpec } = input;
  const spec = applySpecFallbacks(rawSpec);

  // Auto-detect breakdown field if not present in rows
  const fieldCandidate =
    focusRows.length === 0 || focusRows.some((r) => r[spec.breakdown.field] !== undefined)
      ? spec.breakdown.field
      : (autoPickField(focusRows) ?? spec.breakdown.field);

  const isMultiSeries =
    spec.chartType === "bar" &&
    spec.series !== undefined &&
    spec.series.field !== fieldCandidate;

  if (isMultiSeries && spec.series) {
    return buildSeries(focusRows, fieldCandidate, spec.series.field, spec);
  }

  return buildCategorical(focusRows, fieldCandidate, spec, universeTotal);
}
