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
}

export interface ChartBlockContent {
  code: string;
  chartType: ChartType;
  title?: string | null;
  metadata?: ChartMetadata;
}
