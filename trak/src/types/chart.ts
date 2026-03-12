import type { ChartRow, ChartSpec } from "@/lib/charts/chartSpec";

export type ChartType = "bar" | "line" | "pie" | "doughnut";

// ─── Chart data source (refresh + scope) ───────────────────────────────────

/**
 * Serializable query params for re-running search on refresh.
 * Shapes match the corresponding search API (searchTasks, searchTimelineEvents, searchTableRows, searchCards).
 */
export type ChartDataQuery =
  | { type: "tasks"; params: Record<string, unknown> }
  | { type: "timeline_events"; params: Record<string, unknown> }
  | { type: "table_rows"; params: Record<string, unknown> }
  | { type: "cards"; params: Record<string, unknown> };

/**
 * Refreshable query scope: chart is driven by the stored query; refresh re-runs it.
 */
export interface ChartDataSourceRefreshableQuery {
  mode: "refreshable";
  scope: "query";
  query: ChartDataQuery;
  previousQuery?: ChartDataQuery;
}

/**
 * Refreshable fixed scope: chart is tied to the listed entities; refresh re-fetches by ID only.
 */
export interface ChartDataSourceRefreshableFixed {
  mode: "refreshable";
  scope: "fixed";
  entityType: "task" | "timeline_event" | "table_row" | "card";
  entityIds: string[];
  previousQuery?: ChartDataQuery;
}

/**
 * Snapshot: no refresh, no scope selector. Use for saved/locked charts.
 */
export interface ChartDataSourceSnapshot {
  mode: "snapshot";
}

export type ChartDataSource =
  | ChartDataSourceRefreshableQuery
  | ChartDataSourceRefreshableFixed
  | ChartDataSourceSnapshot;

export function isRefreshableDataSource(
  ds: ChartDataSource | undefined
): ds is ChartDataSourceRefreshableQuery | ChartDataSourceRefreshableFixed {
  return ds !== undefined && ds.mode === "refreshable";
}

export interface ChartSimulationMetadata {
  isSimulation?: boolean;
  originalChartId?: string | null;
  description?: string;
}

export interface ChartMetadata extends ChartSimulationMetadata {
  sourcePrompt?: string;
  sourceBlockIds?: string[];
  sourceFileIds?: string[];
  dataNotes?: string;
  customization?: {
    title?: string | null;
    labels?: string[];
    values?: number[];
    colors?: string[];
    height?: number | null;
  };
}

/**
 * Legacy content shape — JSX-code-based chart blocks.
 * Kept for backward compatibility with existing blocks.
 */
export interface LegacyChartBlockContent {
  code: string;
  chartType: ChartType;
  title?: string | null;
  metadata?: ChartMetadata;
}

/**
 * Spec-driven content shape (v1).
 * The AI outputs a ChartSpec + rows; the block renders them locally
 * using the transform engine + Recharts (no LLM-generated JSX).
 */
export interface SpecChartBlockContent {
  /** Discriminant — must be present to use the spec-driven render path */
  spec: ChartSpec;
  /**
   * Serialised focus rows (the data subset being charted).
   * Stored inline to avoid re-fetching; up to ~500 rows is practical.
   */
  rows: ChartRow[];
  /**
   * Denominator count for universe-normalised charts.
   * Omit when spec.normalizeTo = "focus".
   */
  universeTotal?: number;
  chartType: ChartType;
  title?: string | null;
  metadata?: ChartMetadata;
  /**
   * When set (and mode === "refreshable"), the chart can be refreshed and scope can be switched.
   * When missing or mode === "snapshot", the chart is static (current rows only).
   */
  dataSource?: ChartDataSource;
}

/** Union — ChartBlock handles both shapes transparently */
export type ChartBlockContent = LegacyChartBlockContent | SpecChartBlockContent;

/** Type guard: true when content uses the new spec-driven path */
export function isSpecChart(content: ChartBlockContent): content is SpecChartBlockContent {
  return "spec" in content && content.spec !== null && typeof content.spec === "object";
}
