"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";
import type { AuthContext } from "@/lib/auth-context";
import type { BlockReference, BlockReferenceSummary, BlockReferenceType } from "@/types/block-reference";

type ActionResult<T> = { data: T } | { error: string };

const VALID_REFERENCE_TYPES: BlockReferenceType[] = ["doc", "table_row", "task", "block", "tab"];

function validateReferenceType(referenceType: string): referenceType is BlockReferenceType {
  return VALID_REFERENCE_TYPES.includes(referenceType as BlockReferenceType);
}

async function requireBlockAccess(
  blockId: string,
  opts?: { authContext?: AuthContext }
): Promise<{ error: string } | { supabase: any; userId: string; block: { id: string; tab_id: string; workspace_id: string; project_id: string | null } }> {
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

  const { data: block, error: blockError } = await supabase
    .from("blocks")
    .select("id, tab_id, tabs!inner(id, project_id, projects!inner(id, workspace_id))")
    .eq("id", blockId)
    .maybeSingle();

  if (blockError || !block) return { error: "Block not found" };

  const workspaceId = (block.tabs as { projects?: { workspace_id?: string; id?: string } })?.projects?.workspace_id as string | undefined;
  const projectId = (block.tabs as { projects?: { id?: string } })?.projects?.id as string | undefined;

  if (!workspaceId) return { error: "Block is missing workspace" };

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  return {
    supabase,
    userId,
    block: {
      id: block.id,
      tab_id: block.tab_id,
      workspace_id: workspaceId,
      project_id: projectId ?? null,
    },
  };
}

export async function createBlockReference(input: {
  blockId: string;
  referenceType: BlockReferenceType;
  referenceId: string;
  tableId?: string | null;
  authContext?: AuthContext;
}): Promise<ActionResult<BlockReference>> {
  const access = await requireBlockAccess(input.blockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase, userId, block } = access;

  if (!validateReferenceType(input.referenceType)) {
    return { error: "Invalid reference type" };
  }

  const { data, error } = await supabase
    .from("block_references")
    .insert({
      workspace_id: block.workspace_id,
      block_id: input.blockId,
      reference_type: input.referenceType,
      reference_id: input.referenceId,
      table_id: input.tableId ?? null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (error || !data) return { error: "Failed to create block reference" };
  return { data: data as BlockReference };
}

export async function deleteBlockReference(referenceId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<null>> {
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
    .from("block_references")
    .select("id, workspace_id")
    .eq("id", referenceId)
    .single();

  if (refError || !ref) return { error: "Reference not found" };

  const membership = await checkWorkspaceMembership(ref.workspace_id, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("block_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete block reference" };
  return { data: null };
}

export async function listBlockReferences(blockId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<BlockReference[]>> {
  const access = await requireBlockAccess(blockId, { authContext: opts?.authContext });
  if ("error" in access) return { error: access.error ?? "Unknown error" };
  const { supabase } = access;

  const { data, error } = await supabase
    .from("block_references")
    .select("*")
    .eq("block_id", blockId)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: "Failed to load block references" };
  return { data: data as BlockReference[] };
}

export async function listBlockReferenceSummaries(blockId: string): Promise<ActionResult<BlockReferenceSummary[]>> {
  const base = await listBlockReferences(blockId);
  if ("error" in base) return base;

  const supabase = await createClient();
  const resolved: BlockReferenceSummary[] = [];

  for (const ref of base.data) {
    const summary = await resolveReferenceSummary(supabase, ref);
    resolved.push({
      ...ref,
      title: summary.title,
      type_label: summary.typeLabel,
      tab_id: summary.tabId,
      project_id: summary.projectId,
      is_workflow: summary.isWorkflow,
    });
  }

  return { data: resolved };
}

async function resolveReferenceSummary(
  supabase: any,
  ref: BlockReference
): Promise<{ title: string; typeLabel?: string; tabId?: string | null; projectId?: string | null; isWorkflow?: boolean }> {
  if (ref.reference_type === "doc") {
    const { data } = await supabase.from("docs").select("title").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.title || "Doc", typeLabel: "Doc" };
  }

  if (ref.reference_type === "task") {
    const { data } = await supabase
      .from("task_items")
      .select("title, tab_id, project_id")
      .eq("id", ref.reference_id)
      .maybeSingle();
    return {
      title: data?.title || "Task",
      typeLabel: "Task",
      tabId: data?.tab_id ?? null,
      projectId: data?.project_id ?? null,
      isWorkflow: !data?.project_id,
    };
  }

  if (ref.reference_type === "block") {
    const { data } = await supabase
      .from("blocks")
      .select("type, content, tab_id, tabs!inner(id, project_id)")
      .eq("id", ref.reference_id)
      .maybeSingle();

    if (!data) return { title: "Block", typeLabel: "Block" };

    const content = (data as any).content || {};
    const tabId = (data as any).tab_id ?? null;
    const projectId = (data as any).tabs?.project_id ?? null;
    const isWorkflow = !projectId;

    if (data.type === "table" && content.tableId) {
      const { data: table } = await supabase
        .from("tables")
        .select("title")
        .eq("id", content.tableId)
        .maybeSingle();
      return {
        title: table?.title || "Table",
        typeLabel: "Table",
        tabId,
        projectId,
        isWorkflow,
      };
    }

    const blockTypeLabel = data.type ? data.type.replace(/_/g, " ") : "Block";
    const normalizedLabel = blockTypeLabel.charAt(0).toUpperCase() + blockTypeLabel.slice(1);
    const typeLabel = `${normalizedLabel} block`;
    if (content.title) {
      return {
        title: content.title,
        typeLabel,
        tabId,
        projectId,
        isWorkflow,
      };
    }

    return {
      title: normalizedLabel,
      typeLabel,
      tabId,
      projectId,
      isWorkflow,
    };
  }

  if (ref.reference_type === "table_row") {
    const { data: row } = await supabase
      .from("table_rows")
      .select("id, data, table_id")
      .eq("id", ref.reference_id)
      .maybeSingle();
    if (!row) return { title: "Row", typeLabel: "Table row" };

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

    return { title: value ? String(value) : `Row ${row.id.slice(0, 6)}`, typeLabel: "Table row" };
  }

  if (ref.reference_type === "tab") {
    const { data } = await supabase.from("tabs").select("name").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.name || "Tab", typeLabel: "Tab" };
  }

  return { title: "Attachment" };
}
