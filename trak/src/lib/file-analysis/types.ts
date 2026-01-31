export type FileAnalysisScope = "tab" | "project" | "workspace";

export interface AnalysisFile {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string | null;
  storage_path: string;
  workspace_id: string;
  project_id: string;
  created_at: string;
  source: "session" | "tab" | "project" | "workspace";
  is_attached: boolean;
  attached_tab_ids?: string[];
}

export interface ExtractedTable {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | null>>;
  rowCount: number;
  columnCount: number;
}

export interface FileArtifact {
  id: string;
  file_id: string;
  status: "pending" | "processing" | "ready" | "error";
  extracted_text: string | null;
  extracted_tables: ExtractedTable[] | null;
  page_count: number | null;
  row_count: number | null;
  column_count: number | null;
  token_estimate: number | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

export interface FileChunk {
  id: string;
  file_id: string;
  artifact_id: string;
  chunk_index: number;
  content: string;
  token_count: number | null;
  embedding: number[] | null;
}

export interface FileAnalysisMessageContent {
  text: string;
  tables?: Array<{
    title?: string;
    columns?: string[];
    headers?: string[];
    rows: Array<Array<string | number | null>>;
  }>;
  charts?: Array<{
    title?: string;
    type: "line" | "bar" | "pie" | "area" | "scatter" | "unknown";
    labels?: string[];
    series?: Array<{ name: string; data: Array<number | null> }>;
  }>;
  notes?: string;
  clarification?: {
    question: string;
    options: string[];
  };
}

export interface FileCitation {
  id: string;
  file_id: string;
  file_name: string;
  chunk_id?: string | null;
  page_number?: number | null;
  row_start?: number | null;
  row_end?: number | null;
  excerpt?: string | null;
  is_attached?: boolean;
}

export interface FileAnalysisMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: FileAnalysisMessageContent;
  created_at: string;
  citations?: FileCitation[];
  actions?: Array<{
    type: "save_block" | "save_comment";
    label: string;
    fileIds?: string[];
  }>;
}
