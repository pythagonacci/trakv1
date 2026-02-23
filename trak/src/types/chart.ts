import type { ChartRow, ChartSpec } from "@/lib/charts/chartSpec";

export type ChartType = "bar" | "line" | "pie" | "doughnut";

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
}

/** Union — ChartBlock handles both shapes transparently */
export type ChartBlockContent = LegacyChartBlockContent | SpecChartBlockContent;

/** Type guard: true when content uses the new spec-driven path */
export function isSpecChart(content: ChartBlockContent): content is SpecChartBlockContent {
  return "spec" in content && content.spec !== null && typeof content.spec === "object";
}
