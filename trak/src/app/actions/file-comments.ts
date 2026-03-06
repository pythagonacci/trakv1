"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";

type ActionResult<T> = { data: T } | { error: string };

export async function createFileComment(input: {
  fileId: string;
  text: string;
  parentId?: string | null;
}): Promise<ActionResult<{ id: string; file_id: string; text: string; created_at: string; user_id: string | null; parent_id: string | null }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Please sign in to add a comment" };

  const fileId = String(input.fileId || "").trim();
  const text = String(input.text || "").trim();
  if (!fileId) return { error: "Missing file ID" };
  if (!text) return { error: "Comment cannot be empty" };

  const { data: file, error: fileError } = await supabase
    .from("files")
    .select("id, workspace_id")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError || !file) return { error: "File not found" };

  const membership = await checkWorkspaceMembership(file.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const insertPayload: { file_id: string; user_id: string; text: string; parent_id?: string | null } = {
    file_id: fileId,
    user_id: user.id,
    text,
  };
  if (input.parentId) insertPayload.parent_id = input.parentId;

  // Select without parent_id to support DBs where migration hasn't run yet
  const { data: row, error } = await supabase
    .from("file_comments")
    .insert(insertPayload)
    .select("id, file_id, text, created_at, user_id")
    .single();

  if (error || !row) {
    console.error("[createFileComment] insert error:", error?.message ?? error, { fileId, parentId: input.parentId });
    const msg = error?.message ?? "";
    if (msg.includes("violates row-level security") || msg.includes("RLS")) {
      return { error: "You don't have permission to add comments to this file" };
    }
    if (msg.includes("foreign key") || msg.includes("violates foreign key")) {
      return { error: "File or parent comment no longer exists" };
    }
    if (msg.includes("parent_id does not exist")) {
      return { error: "Database migration required for replies. Run: supabase db push" };
    }
    return { error: "Failed to save comment" };
  }
  return { data: { ...row, parent_id: input.parentId ?? null } };
}

