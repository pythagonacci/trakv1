"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership } from "@/lib/auth-utils";
import type { BlockComment } from "@/types/block-comment";
import { listBlockCommentRows, mapBlockCommentRow, syncBlockCommentsMirror } from "@/lib/block-comments";

type ActionResult<T> = { data: T } | { error: string };

async function requireBlockCommentAccess(blockId: string) {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" } as const;

  const { data: block, error } = await supabase
    .from("blocks")
    .select("id, tab_id, tabs!inner(project_id, projects!inner(workspace_id, id, name, public_token, client_page_enabled))")
    .eq("id", blockId)
    .single();
  if (error || !block) return { error: "Block not found" } as const;

  const tab = Array.isArray((block as any).tabs) ? (block as any).tabs[0] : (block as any).tabs;
  const project = Array.isArray(tab?.projects) ? tab.projects[0] : tab?.projects;
  const workspaceId = project?.workspace_id as string | undefined;
  if (!workspaceId) return { error: "Workspace not found" } as const;

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" } as const;

  return {
    supabase,
    user,
    workspaceId,
    projectId: tab?.project_id as string | null,
    tabId: (block as any).tab_id as string,
  } as const;
}

export async function listBlockComments(blockId: string): Promise<ActionResult<BlockComment[]>> {
  const access = await requireBlockCommentAccess(blockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  try {
    const rows = await listBlockCommentRows(access.supabase, blockId);
    return { data: rows.map(mapBlockCommentRow) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to load comments" };
  }
}

export async function createBlockComment(input: {
  blockId: string;
  text: string;
  parentId?: string | null;
}): Promise<ActionResult<BlockComment[]>> {
  const access = await requireBlockCommentAccess(input.blockId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, user, workspaceId, projectId, tabId } = access;

  const previousRows = await listBlockCommentRows(supabase, input.blockId);
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();

  const createdAt = new Date().toISOString();
  const newComment = {
    id: `comment-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    block_id: input.blockId,
    parent_id: input.parentId ?? null,
    author_user_id: user.id,
    author_external_id: null,
    author_name: profile?.name || user.email?.split("@")[0] || "User",
    author_email: profile?.email || user.email || null,
    text: input.text,
    source: "internal" as const,
    created_at: createdAt,
    updated_at: createdAt,
  };

  const { error } = await supabase.from("block_comments").insert(newComment);
  if (error) return { error: error.message || "Failed to create comment" };

  const nextRows = await listBlockCommentRows(supabase, input.blockId);
  const comments = await syncBlockCommentsMirror(supabase, input.blockId, nextRows);

  try {
    const { createBlockCommentNotifications } = await import("@/lib/notifications/service");
    await createBlockCommentNotifications({
      blockId: input.blockId,
      actorId: user.id,
      existingComments: previousRows.map(mapBlockCommentRow),
      newComments: [mapBlockCommentRow(newComment as any)],
      projectId: projectId ?? undefined,
      tabId,
      workspaceId,
    });
  } catch (notificationError) {
    console.error("Failed to create block comment notifications", notificationError);
  }

  return { data: comments };
}

export async function deleteBlockComment(commentId: string): Promise<ActionResult<BlockComment[]>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: comment, error: commentError } = await supabase
    .from("block_comments")
    .select("id, block_id, author_user_id")
    .eq("id", commentId)
    .single();
  if (commentError || !comment) return { error: "Comment not found" };

  const access = await requireBlockCommentAccess(comment.block_id);
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  if (comment.author_user_id && comment.author_user_id !== user.id) {
    return { error: "Only the author can delete this comment" };
  }

  const { error } = await supabase.from("block_comments").delete().eq("id", commentId);
  if (error) return { error: error.message || "Failed to delete comment" };

  const rows = await listBlockCommentRows(supabase, comment.block_id);
  const comments = await syncBlockCommentsMirror(supabase, comment.block_id, rows);
  return { data: comments };
}
