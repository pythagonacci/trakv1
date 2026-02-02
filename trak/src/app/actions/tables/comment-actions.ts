"use server";

// Table refactor baseline (Sept 2024):
// - Comments are new for table_rows; existing product has no table-specific comments outside generic blocks.
// - RLS exists on table_comments via add_tables_schema.sql; membership is enforced again here.

import { requireTableAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TableComment } from "@/types/table";

type ActionResult<T> = { data: T } | { error: string };

interface CreateCommentInput {
  rowId: string;
  content: string;
  parentId?: string | null;
  authContext?: AuthContext;
}

export async function createComment(input: CreateCommentInput): Promise<ActionResult<TableComment>> {
  const access = await getRowAccess(input.rowId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, tableId } = access;

  const { data, error } = await supabase
    .from("table_comments")
    .insert({
      row_id: input.rowId,
      user_id: userId,
      content: input.content,
      parent_id: input.parentId ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to create comment" };
  }
  return { data };
}

export async function updateComment(commentId: string, content: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TableComment>> {
  const access = await getCommentAccess(commentId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, comment } = access;

  if (comment.user_id !== userId) {
    return { error: "Only the author can edit this comment" };
  }

  const { data, error } = await supabase
    .from("table_comments")
    .update({ content })
    .eq("id", commentId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update comment" };
  }
  return { data };
}

export async function deleteComment(commentId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await getCommentAccess(commentId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, comment } = access;

  if (comment.user_id !== userId) {
    return { error: "Only the author can delete this comment" };
  }

  const { error } = await supabase.from("table_comments").delete().eq("id", commentId);
  if (error) {
    return { error: "Failed to delete comment" };
  }
  return { data: null };
}

export async function resolveComment(commentId: string, resolved: boolean): Promise<ActionResult<TableComment>> {
  const access = await getCommentAccess(commentId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_comments")
    .update({ resolved })
    .eq("id", commentId)
    .select("*")
    .single();

  if (error || !data) {
    return { error: "Failed to update comment status" };
  }
  return { data };
}

export async function getRowComments(rowId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TableComment[]>> {
  const access = await getRowAccess(rowId, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("table_comments")
    .select("*")
    .eq("row_id", rowId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { error: "Failed to load comments" };
  }
  return { data };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRowAccess(rowId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await import("@/lib/supabase/server").then((m) => m.createClient());
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const { data: row, error } = await supabase
    .from("table_rows")
    .select("id, table_id")
    .eq("id", rowId)
    .maybeSingle();

  if (error || !row) return { error: "Row not found" };

  const access = await requireTableAccess(row.table_id, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  return { supabase: access.supabase, userId, tableId: row.table_id };
}

async function getCommentAccess(commentId: string, opts?: { authContext?: AuthContext }) {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const client = await import("@/lib/supabase/server").then((m) => m.createClient());
    const { data: { user } } = await client.auth.getUser();
    if (!user) return { error: "Unauthorized" };
    supabase = client;
    userId = user.id;
  }

  const { data: comment, error } = await supabase
    .from("table_comments")
    .select("id, row_id, user_id")
    .eq("id", commentId)
    .maybeSingle();

  if (error || !comment) return { error: "Comment not found" };

  const access = await getRowAccess(comment.row_id, opts);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  return { supabase: access.supabase, userId, comment };
}
