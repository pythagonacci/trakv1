"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { requireTimelineAccess } from "./context";
import type { AuthContext } from "@/lib/auth-context";
import { validateReferenceType } from "./validators";
import type { ReferenceType, TimelineReference } from "@/types/timeline";

type ActionResult<T> = { data: T } | { error: string };

export async function createTimelineReference(input: {
  timelineBlockId: string;
  eventId: string;
  referenceType: ReferenceType;
  referenceId: string;
  tableId?: string | null;
  authContext?: AuthContext;
}): Promise<ActionResult<TimelineReference>> {
  const access = await requireTimelineAccess(input.timelineBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

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

  const resolvedReferenceId = await resolveReferenceIdByName({
    supabase,
    workspaceId: block.workspace_id,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    tableId: input.tableId ?? null,
  });

  if ("error" in resolvedReferenceId) return resolvedReferenceId;

  const resolved = await resolveReferenceAccess({
    supabase,
    workspaceId: block.workspace_id,
    referenceType: input.referenceType,
    referenceId: resolvedReferenceId.referenceId,
    tableId: input.tableId ?? null,
  });

  if ("error" in resolved) return resolved;

  const { data, error } = await supabase
    .from("timeline_references")
    .insert({
      workspace_id: block.workspace_id,
      event_id: event.data.id,
      reference_type: input.referenceType,
      reference_id: resolvedReferenceId.referenceId,
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
  if ("error" in access) return { error: access.error ?? "Unknown error" };

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
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase } = access;
  const { error } = await supabase.from("timeline_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete timeline reference" };
  return { data: null };
}

export async function listTimelineReferences(eventId: string): Promise<ActionResult<TimelineReference[]>> {
  const access = await getReferenceContextByEvent(eventId);
  if ("error" in access) return { error: access.error ?? "Unknown error" };

  const { supabase, event } = access;
  const { data, error } = await supabase
    .from("timeline_references")
    .select("*")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  if (error || !data) return { error: "Failed to load references" };
  return { data: data as TimelineReference[] };
}

export async function listTimelineReferenceSummaries(eventId: string): Promise<ActionResult<Array<TimelineReference & { title: string; type_label?: string; tab_id?: string; project_id?: string; is_workflow?: boolean }>>> {
  const base = await listTimelineReferences(eventId);
  if ("error" in base) return base;

  const supabase = await createClient();
  const resolved: Array<TimelineReference & { title: string; type_label?: string; tab_id?: string; project_id?: string; is_workflow?: boolean }> = [];

  for (const ref of base.data) {
    const summary = await resolveReferenceSummary(supabase, ref);
    resolved.push({
      ...ref,
      title: summary.title,
      type_label: summary.typeLabel,
      tab_id: summary.tabId,
      project_id: summary.projectId,
      is_workflow: summary.isWorkflow
    });
  }

  return { data: resolved };
}

export async function bulkImportTableRows(input: {
  timelineBlockId: string;
  eventId: string;
  tableId: string;
  rowIds: string[];
  authContext?: AuthContext;
}): Promise<ActionResult<null>> {
  const access = await requireTimelineAccess(input.timelineBlockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };

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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

async function resolveReferenceIdByName(input: {
  supabase: any;
  workspaceId: string;
  referenceType: ReferenceType;
  referenceId: string;
  tableId: string | null;
}): Promise<{ error: string } | { referenceId: string }> {
  const referenceId = input.referenceId.trim();
  if (isUuid(referenceId)) return { referenceId };

  if (input.referenceType === "doc") {
    const { data } = await input.supabase
      .from("docs")
      .select("id, title")
      .eq("workspace_id", input.workspaceId)
      .ilike("title", referenceId)
      .limit(5);

    if (!data || data.length === 0) return { error: "No document found with that title." };
    if (data.length > 1) return { error: "Multiple documents matched that title. Please use the ID instead." };
    return { referenceId: data[0].id };
  }

  if (input.referenceType === "table_row") {
    if (!input.tableId) return { error: "Table ID is required to resolve a row by name." };

    const { data: fields } = await input.supabase
      .from("table_fields")
      .select("id, type, is_primary")
      .eq("table_id", input.tableId)
      .order("order", { ascending: true });

    const primary = fields?.find((f: any) => f.is_primary);
    const textField = fields?.find((f: any) => f.type === "text");
    const fallbackField = fields?.[0];
    const fieldId = primary?.id || textField?.id || fallbackField?.id;
    if (!fieldId) return { error: "Table has no searchable fields." };

    const { data: rows } = await input.supabase
      .from("table_rows")
      .select("id, data")
      .eq("table_id", input.tableId)
      .limit(200);

    if (!rows || rows.length === 0) return { error: "No rows found in that table." };

    const matches = rows.filter((row: any) => {
      const value = (row.data || {})[fieldId];
      if (value === null || value === undefined) return false;
      return String(value).trim().toLowerCase() === referenceId.toLowerCase();
    });

    if (matches.length === 0) return { error: "No table row found with that name." };
    if (matches.length > 1) return { error: "Multiple rows matched that name. Please use the row ID instead." };
    return { referenceId: matches[0].id };
  }

  return { error: "Block references require an ID for now." };
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

async function resolveReferenceSummary(
  supabase: any,
  ref: TimelineReference
): Promise<{ title: string; typeLabel?: string; tabId?: string; projectId?: string; isWorkflow?: boolean }> {
  if (ref.reference_type === "doc") {
    const { data } = await supabase.from("docs").select("title").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.title || "Doc" };
  }

  if (ref.reference_type === "block") {
    const { data } = await supabase
      .from("blocks")
      .select("type, content, tab_id, tabs!inner(id, project_id, projects(id))")
      .eq("id", ref.reference_id)
      .maybeSingle();

    if (!data) return { title: "Block", typeLabel: "Block" };

    const content = (data as any).content || {};
    const tabData = (data as any).tabs;
    const tabId = tabData?.id;
    const projectId = tabData?.projects?.id || tabData?.project_id;
    const isWorkflow = !projectId; // If there's no project, it's a workflow tab

    if (data.type === "table" && content.tableId) {
      const { data: table } = await supabase
        .from("tables")
        .select("title")
        .eq("id", content.tableId)
        .maybeSingle();
      return { title: table?.title || "Table", typeLabel: "Table", tabId, projectId, isWorkflow };
    }

    const blockTypeLabel = data.type ? data.type.replace(/_/g, " ") : "Block";
    const normalizedLabel = blockTypeLabel.charAt(0).toUpperCase() + blockTypeLabel.slice(1);
    const typeLabel = `${normalizedLabel} block`;
    if (content.title) return { title: content.title, typeLabel, tabId, projectId, isWorkflow };
    return { title: normalizedLabel, typeLabel, tabId, projectId, isWorkflow };
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
