"use server";

import { requireTaskItemAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskTag } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function setTaskTags(taskId: string, tagNames: string[], opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  const access = await requireTaskItemAccess(taskId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, task } = access;

  const normalized = Array.from(new Set(tagNames.map((t) => t.trim()).filter(Boolean)));

  const { data: existingLinks } = await supabase
    .from("task_tag_links")
    .select("tag_id")
    .eq("task_id", taskId);

  const existingTagIds = new Set((existingLinks || []).map((l: any) => l.tag_id));

  const { data: existingTags } = await supabase
    .from("task_tags")
    .select("id, name")
    .eq("workspace_id", task.workspace_id);

  const tagMap = new Map<string, string>();
  (existingTags || []).forEach((tag: any) => tagMap.set(tag.name, tag.id));

  for (const name of normalized) {
    if (!tagMap.has(name)) {
      const { data: newTag, error: tagError } = await supabase
        .from("task_tags")
        .insert({ workspace_id: task.workspace_id, name })
        .select("id, name")
        .single();
      if (tagError || !newTag) {
        return { error: "Failed to create tag" };
      }
      tagMap.set(newTag.name, newTag.id);
    }
  }

  const desiredTagIds = new Set(normalized.map((name) => tagMap.get(name)!).filter(Boolean));

  const toInsert = Array.from(desiredTagIds).filter((id) => !existingTagIds.has(id));
  const toDelete = Array.from(existingTagIds).filter((id) => !desiredTagIds.has(id));

  if (toInsert.length > 0) {
    const payload = toInsert.map((tagId) => ({ task_id: taskId, tag_id: tagId }));
    const { error } = await supabase.from("task_tag_links").insert(payload);
    if (error) return { error: "Failed to attach tags" };
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("task_tag_links")
      .delete()
      .eq("task_id", taskId)
      .in("tag_id", toDelete);
    if (error) return { error: "Failed to detach tags" };
  }

  return { data: null };
}

export async function listWorkspaceTaskTags(workspaceId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TaskTag[]>> {
  let supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    const { createClient } = await import("@/lib/supabase/server");
    const { getAuthenticatedUser, checkWorkspaceMembership } = await import("@/lib/auth-utils");
    supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    userId = user.id;
  }
  const { checkWorkspaceMembership } = await import("@/lib/auth-utils");
  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  const { data, error } = await supabase
    .from("task_tags")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name", { ascending: true });

  if (error || !data) return { error: "Failed to load tags" };
  return { data: data as TaskTag[] };
}
