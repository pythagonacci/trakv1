import type { Priority, DueDateRange } from "@/types/properties";

export type CardAssetKind = "image" | "video" | "file" | null;
export type CardVariant = "asset" | "text";
export type TextCardFieldType = "text" | "date" | "status" | "priority" | "person";

export type TextCardRowValue =
  | string
  | DueDateRange
  | "todo"
  | "in_progress"
  | "blocked"
  | "done"
  | Priority
  | string[]
  | null;

export interface TextCardRow {
  id: string;
  label: string;
  fieldType: TextCardFieldType;
  value: TextCardRowValue;
}

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
  text_rows?: TextCardRow[];
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
  cardVariant?: CardVariant;
  /** Resizable block height in pixels. */
  heightPx?: number;
  /** Number of columns when two or more cards are shown in a grid (1–6). */
  gridColumns?: number;
  /**
   * Shared height in pixels for the asset (image) area on every card in grid view
   * when there are multiple cards.
   */
  gridAssetHeightPx?: number;
  /**
   * Shared max width in pixels for the asset area when multiple cards are in grid view
   * (media is centered; cannot exceed the card cell). Drag the corner handle horizontally to adjust.
   */
  gridAssetWidthPx?: number;
}

export const MIN_GRID_COLUMNS = 1;
export const MAX_GRID_COLUMNS = 6;

export function clampGridColumns(raw: unknown): number {
  const n =
    typeof raw === "number" && Number.isFinite(raw)
      ? Math.round(raw)
      : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return 2;
  return Math.min(MAX_GRID_COLUMNS, Math.max(MIN_GRID_COLUMNS, n));
}

/** Min/max for shared grid media width and height (px). */
export const MIN_GRID_ASSET_MEDIA_PX = 140;
export const MAX_GRID_ASSET_MEDIA_PX = 560;

export function clampGridAssetMediaPx(raw: unknown, fallback: number): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : Number.parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_GRID_ASSET_MEDIA_PX, Math.max(MIN_GRID_ASSET_MEDIA_PX, Math.round(n)));
}
