import type { Priority, DueDateRange } from "@/types/properties";

export type CardAssetKind = "image" | "video" | "file" | null;

export interface CardPriorityField {
  field_name: string;
  value: Priority | null;
}

export interface CardStatusField {
  field_name: string;
  value: "todo" | "in_progress" | "blocked" | "done" | null;
}

export interface CardAssigneeField {
  field_name: string;
  value: string[] | null;
}

export interface CardDueDateField {
  field_name: string;
  value: DueDateRange | null;
}

export type CardWidth = "half" | "full";
export type CardHeight = "compact" | "tall";

export interface CardItem {
  id: string;
  cards_block_id: string;
  workspace_id: string;
  project_id: string | null;
  tab_id: string | null;
  title: string;
  notes: string | null;
  asset_file_id: string | null;
  /** Ordered list of file IDs for slideshow. When non-empty, used instead of asset_file_id. */
  asset_file_ids?: string[];
  asset_kind: CardAssetKind;
  asset_caption: string | null;
  display_order: number;
  /** Half = 50% width, full = 100%. Defaults to 'half' when absent. */
  width?: CardWidth;
  /** Compact = shorter, tall = larger vertically. Defaults to 'tall' when absent. */
  height?: CardHeight;
  assignee_id: string | null;
  due_date: string | null;
  start_date: string | null;
  tags: string[];
  priorities: CardPriorityField[];
  statuses: CardStatusField[];
  assignees: CardAssigneeField[];
  due_dates: CardDueDateField[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardComment {
  id: string;
  card_id: string;
  author_id: string | null;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface CardsBlockContent {
  title: string;
  viewMode?: "grid" | "list";
  /** Resizable block height in pixels. */
  heightPx?: number;
}
