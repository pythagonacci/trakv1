"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";

type ActionResult<T> = { data: T } | { error: string };

export async function createFileComment(input: {
  fileId: string;
  text: string;
}): Promise<ActionResult<{ id: string; file_id: string; text: string; created_at: string; user_id: string | null }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

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

  const { data, error } = await supabase
    .from("file_comments")
    .insert({
      file_id: fileId,
      user_id: user.id,
      text,
    })
    .select("id, file_id, text, created_at, user_id")
    .single();

  if (error || !data) return { error: "Failed to create comment" };
  return { data };
}

