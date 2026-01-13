"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTimelineAccess } from "./context";
import { validateReferenceType } from "./validators";
import type { ReferenceType, TimelineReference } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function createTimelineReference(input: {
  timelineBlockId: string;
  eventId: string;
  referenceType: ReferenceType;
  referenceId: string;
  tableId?: string | null;
}): Promise<ActionResult<TimelineReference>> {
  const access = await requireTimelineAccess(input.timelineBlockId);
  if ("error" in access) return access;

  if (!validateReferenceType(input.referenceType)) {
    return { error: "Invalid reference type" };
  }

  const { supabase, userId, block } = access;
  const event = await requireEventInBlock({
    supabase,
    eventId: input.eventId,
    timelineBlockId: input.timelineBlockId,
    workspaceId: block.workspace_id,
  });
  if ("error" in event) return event;

  const resolved = await resolveReferenceAccess({
    supabase,
    workspaceId: block.workspace_id,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    tableId: input.tableId ?? null,
  });

  if ("error" in resolved) return resolved;

  const { data, error } = await supabase
    .from("timeline_references")
    .insert({
      workspace_id: block.workspace_id,
      event_id: event.data.id,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      table_id: resolved.tableId,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create timeline reference" };

  return { data: data as TimelineReference };
}

export async function updateTimelineReference(
  referenceId: string,
  updates: Partial<{ tableId: string | null }>
): Promise<ActionResult<TimelineReference>> {
  const access = await getReferenceContext(referenceId);
  if ("error" in access) return access;

  const { supabase } = access;

  const payload: Record<string, unknown> = {};
  if (updates.tableId !== undefined) payload.table_id = updates.tableId;

  const { data, error } = await supabase
    .from("timeline_references")
    .update(payload)
    .eq("id", referenceId)
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to update timeline reference" };

  return { data: data as TimelineReference };
}

export async function deleteTimelineReference(referenceId: string): Promise<ActionResult<null>> {
  const access = await getReferenceContext(referenceId);
  if ("error" in access) return access;

  const { supabase } = access;
  const { error } = await supabase.from("timeline_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete timeline reference" };
  return { data: null };
}

export async function listTimelineReferences(eventId: string): Promise<ActionResult<TimelineReference[]>> {
  const access = await getReferenceContextByEvent(eventId);
  if ("error" in access) return access;

  const { supabase, event } = access;
  const { data, error } = await supabase
    .from("timeline_references")
    .select("*")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  if (error || !data) return { error: "Failed to load references" };
  return { data: data as TimelineReference[] };
}

export async function listTimelineReferenceSummaries(eventId: string): Promise<ActionResult<Array<TimelineReference & { title: string }>>> {
  const base = await listTimelineReferences(eventId);
  if ("error" in base) return base;

  const supabase = await createClient();
  const resolved: Array<TimelineReference & { title: string }> = [];

  for (const ref of base.data) {
    const title = await resolveReferenceTitle(supabase, ref);
    resolved.push({ ...ref, title });
  }

  return { data: resolved };
}

export async function bulkImportTableRows(input: {
  timelineBlockId: string;
  eventId: string;
  tableId: string;
  rowIds: string[];
}): Promise<ActionResult<null>> {
  const access = await requireTimelineAccess(input.timelineBlockId);
  if ("error" in access) return access;

  if (input.rowIds.length === 0) return { data: null };

  const { supabase, userId, block } = access;
  const event = await requireEventInBlock({
    supabase,
    eventId: input.eventId,
    timelineBlockId: input.timelineBlockId,
    workspaceId: block.workspace_id,
  });
  if ("error" in event) return event;

  const { data: rows } = await supabase
    .from("table_rows")
    .select("id, table_id")
    .eq("table_id", input.tableId)
    .in("id", input.rowIds);

  if (!rows || rows.length === 0) return { data: null };

  const payload = rows.map((row, idx) => ({
    workspace_id: block.workspace_id,
    event_id: event.data.id,
    reference_type: "table_row",
    reference_id: row.id,
    table_id: row.table_id,
    created_by: userId,
  }));

  const { error } = await supabase.from("timeline_references").insert(payload);
  if (error) return { error: "Failed to import table rows" };

  return { data: null };
}

async function resolveReferenceAccess(input: {
  supabase: any;
  workspaceId: string;
  referenceType: ReferenceType;
  referenceId: string;
  tableId: string | null;
}): Promise<{ error: string } | { tableId: string | null }> {
  const { supabase, workspaceId, referenceType, referenceId } = input;

  if (referenceType === "table_row") {
    const { data: row } = await supabase
      .from("table_rows")
      .select("id, table_id, tables!inner(workspace_id)")
      .eq("id", referenceId)
      .single();

    if (!row) return { error: "Table row not found" };
    const rowWorkspace = (row.tables as any)?.workspace_id;
    if (rowWorkspace !== workspaceId) return { error: "Table row is in a different workspace" };
    return { tableId: row.table_id };
  }

  if (referenceType === "doc") {
    const { data: doc } = await supabase
      .from("docs")
      .select("id, workspace_id")
      .eq("id", referenceId)
      .single();

    if (!doc) return { error: "Document not found" };
    if (doc.workspace_id !== workspaceId) return { error: "Document is in a different workspace" };
    return { tableId: null };
  }

  if (referenceType === "task") {
    const { data: task } = await supabase
      .from("standalone_tasks")
      .select("id, workspace_id")
      .eq("id", referenceId)
      .single();

    if (!task) return { error: "Task not found" };
    if (task.workspace_id !== workspaceId) return { error: "Task is in a different workspace" };
    return { tableId: null };
  }

  if (referenceType === "block") {
    const { data: block } = await supabase
      .from("blocks")
      .select("id, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
      .eq("id", referenceId)
      .single();

    if (!block) return { error: "Block not found" };
    const blockWorkspace = (block.tabs as any)?.projects?.workspace_id;
    if (blockWorkspace !== workspaceId) return { error: "Block is in a different workspace" };
    return { tableId: null };
  }

  return { error: "Unsupported reference type" };
}

async function getReferenceContext(referenceId: string): Promise<{ error: string } | { supabase: any; reference: TimelineReference }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: reference } = await supabase
    .from("timeline_references")
    .select("*")
    .eq("id", referenceId)
    .single();

  if (!reference) return { error: "Timeline reference not found" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", (reference as any).workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, reference: reference as TimelineReference };
}

async function getReferenceContextByEvent(eventId: string): Promise<{ error: string } | { supabase: any; event: { id: string; workspace_id: string } }> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: event } = await supabase
    .from("timeline_events")
    .select("id, workspace_id")
    .eq("id", eventId)
    .single();

  if (!event) return { error: "Event not found" };

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", (event as any).workspace_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, event: event as { id: string; workspace_id: string } };
}

async function resolveReferenceTitle(supabase: any, ref: TimelineReference): Promise<string> {
  if (ref.reference_type === "doc") {
    const { data } = await supabase.from("docs").select("title").eq("id", ref.reference_id).maybeSingle();
    return data?.title || "Doc";
  }

  if (ref.reference_type === "task") {
    const { data } = await supabase.from("standalone_tasks").select("text").eq("id", ref.reference_id).maybeSingle();
    return data?.text || "Task";
  }

  if (ref.reference_type === "block") {
    const { data } = await supabase.from("blocks").select("type").eq("id", ref.reference_id).maybeSingle();
    return data?.type ? `${data.type} block` : "Block";
  }

  if (ref.reference_type === "table_row") {
    const { data: row } = await supabase
      .from("table_rows")
      .select("id, data, table_id")
      .eq("id", ref.reference_id)
      .maybeSingle();
    if (!row) return "Row";

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

    return value ? String(value) : `Row ${row.id.slice(0, 6)}`;
  }

  return "Attachment";
}

async function requireEventInBlock(input: {
  supabase: any;
  eventId: string;
  timelineBlockId: string;
  workspaceId: string;
}): Promise<{ error: string } | { data: { id: string } }> {
  const { data: event } = await input.supabase
    .from("timeline_events")
    .select("id, timeline_block_id, workspace_id")
    .eq("id", input.eventId)
    .single();

  if (!event) return { error: "Event not found" };
  if (event.timeline_block_id !== input.timelineBlockId) {
    return { error: "Event does not belong to this timeline" };
  }
  if (event.workspace_id !== input.workspaceId) {
    return { error: "Event is in a different workspace" };
  }
  return { data: { id: event.id } };
}
