"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTaskItemAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import type { TaskReference, TaskReferenceType } from "@/types/task";

type ActionResult<T> = { data: T } | { error: string };

export async function createTaskReference(input: {
  taskId: string;
  referenceType: TaskReferenceType;
  referenceId: string;
  tableId?: string | null;
  authContext?: AuthContext;
}): Promise<ActionResult<TaskReference>> {
  const access = await requireTaskItemAccess(input.taskId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, task } = access;

  const { data, error } = await supabase
    .from("task_references")
    .insert({
      workspace_id: task.workspace_id,
      task_id: input.taskId,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      table_id: input.tableId ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create task reference" };
  return { data: data as TaskReference };
}

export async function deleteTaskReference(referenceId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let userId: string;
  if (opts?.authContext) {
    supabase = opts.authContext.supabase;
    userId = opts.authContext.userId;
  } else {
    supabase = await createClient();
    const user = await getAuthenticatedUser();
    if (!user) return { error: "Unauthorized" };
    userId = user.id;
  }

  const { data: ref, error: refError } = await supabase
    .from("task_references")
    .select("id, workspace_id")
    .eq("id", referenceId)
    .single();

  if (refError || !ref) return { error: "Reference not found" };

  const membership = await checkWorkspaceMembership(ref.workspace_id, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("task_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete task reference" };
  return { data: null };
}

export async function listTaskReferences(taskId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<TaskReference[]>> {
  const access = await requireTaskItemAccess(taskId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("task_references")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: "Failed to load task references" };
  return { data: data as TaskReference[] };
}

export async function listTaskReferenceSummaries(
  taskId: string
): Promise<ActionResult<Array<TaskReference & { title: string; type_label?: string }>>> {
  const base = await listTaskReferences(taskId);
  if ("error" in base) return base;

  const supabase = await createClient();
  const resolved: Array<TaskReference & { title: string; type_label?: string }> = [];

  for (const ref of base.data) {
    const summary = await resolveReferenceSummary(supabase, ref);
    resolved.push({ ...ref, title: summary.title, type_label: summary.typeLabel });
  }

  return { data: resolved };
}

async function resolveReferenceSummary(
  supabase: any,
  ref: TaskReference
): Promise<{ title: string; typeLabel?: string }> {
  if (ref.reference_type === "doc") {
    const { data } = await supabase.from("docs").select("title").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.title || "Doc" };
  }

  if (ref.reference_type === "task") {
    const { data: taskItem } = await supabase.from("task_items").select("title").eq("id", ref.reference_id).maybeSingle();
    return { title: taskItem?.title || "Task" };
  }

  if (ref.reference_type === "tab") {
    const { data } = await supabase.from("tabs").select("name").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.name || "Tab", typeLabel: "Tab" };
  }

  if (ref.reference_type === "block") {
    const { data } = await supabase
      .from("blocks")
      .select("type, content")
      .eq("id", ref.reference_id)
      .maybeSingle();

    if (!data) return { title: "Block", typeLabel: "Block" };

    const content = (data as any).content || {};
    if (data.type === "table" && content.tableId) {
      const { data: table } = await supabase
        .from("tables")
        .select("title")
        .eq("id", content.tableId)
        .maybeSingle();
      return { title: table?.title || "Table", typeLabel: "Table" };
    }

    const blockTypeLabel = data.type ? data.type.replace(/_/g, " ") : "Block";
    const normalizedLabel = blockTypeLabel.charAt(0).toUpperCase() + blockTypeLabel.slice(1);
    const typeLabel = `${normalizedLabel} block`;
    if (content.title) return { title: content.title, typeLabel };
    return { title: normalizedLabel, typeLabel };
  }

  if (ref.reference_type === "table_row") {
    const { data: row } = await supabase
      .from("table_rows")
      .select("id, data, table_id")
      .eq("id", ref.reference_id)
      .maybeSingle();
    if (!row) return { title: "Row" };

    const { data: fields } = await supabase
      .from("table_fields")
      .select("id, type, is_primary")
      .eq("table_id", row.table_id)
      .order("order", { ascending: true });

    const data = (row.data || {}) as Record<string, unknown>;
    const primary = fields?.find((f: any) => f.is_primary);
    const textField = fields?.find((f: any) => f.type === "text");
    const fallbackField = fields?.[0];
    const fieldId = primary?.id || textField?.id || fallbackField?.id;
    const value = fieldId ? data[fieldId] : null;

    return { title: value ? String(value) : `Row ${row.id.slice(0, 6)}` };
  }

  return { title: "Attachment" };
}
