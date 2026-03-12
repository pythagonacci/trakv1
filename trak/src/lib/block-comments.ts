import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlockComment } from "@/types/block-comment";

export interface BlockCommentRow {
  id: string;
  block_id: string;
  parent_id: string | null;
  author_user_id: string | null;
  author_external_id: string | null;
  author_name: string | null;
  author_email: string | null;
  text: string;
  source: "internal" | "external";
  created_at: string;
  updated_at: string;
}

function toCommentAuthorId(row: BlockCommentRow): string {
  return row.source === "external"
    ? row.author_external_id || row.author_user_id || "client:unknown"
    : row.author_user_id || row.author_external_id || "unknown";
}

export function mapBlockCommentRow(row: BlockCommentRow): BlockComment {
  return {
    id: row.id,
    parent_id: row.parent_id,
    author_id: toCommentAuthorId(row),
    author_name: row.author_name || undefined,
    author_email: row.author_email || undefined,
    text: row.text,
    timestamp: row.created_at,
    source: row.source,
  };
}

export async function listBlockCommentRows(
  supabase: SupabaseClient,
  blockId: string
): Promise<BlockCommentRow[]> {
  const { data, error } = await supabase
    .from("block_comments")
    .select("id, block_id, parent_id, author_user_id, author_external_id, author_name, author_email, text, source, created_at, updated_at")
    .eq("block_id", blockId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message || "Failed to load block comments");
  return (data ?? []) as BlockCommentRow[];
}

export async function syncBlockCommentsMirror(
  supabase: SupabaseClient,
  blockId: string,
  rows?: BlockCommentRow[]
): Promise<BlockComment[]> {
  const commentRows = rows ?? (await listBlockCommentRows(supabase, blockId));
  const comments = commentRows.map(mapBlockCommentRow);

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("content")
    .eq("id", blockId)
    .single();
  if (blockError || !block) throw new Error(blockError?.message || "Block not found");

  const content = (block as { content?: Record<string, unknown> }).content || {};
  const { error: updateError } = await supabase
    .from("blocks")
    .update({ content: { ...content, _blockComments: comments } })
    .eq("id", blockId);
  if (updateError) throw new Error(updateError.message || "Failed to sync block comments mirror");

  return comments;
}
