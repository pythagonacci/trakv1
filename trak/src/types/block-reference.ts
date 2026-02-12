export type BlockReferenceType = "doc" | "table_row" | "task" | "block" | "tab";

export interface BlockReference {
  id: string;
  workspace_id: string;
  block_id: string;
  reference_type: BlockReferenceType;
  reference_id: string;
  table_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlockReferenceSummary extends BlockReference {
  title: string;
  type_label?: string;
  tab_id?: string | null;
  project_id?: string | null;
  is_workflow?: boolean;
}
