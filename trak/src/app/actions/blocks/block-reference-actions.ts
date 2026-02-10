"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";
import type { AuthContext } from "@/lib/auth-context";

type ActionResult<T> = { data: T } | { error: string };

export type BlockReferenceType = "doc" | "table_row" | "task" | "block";

export interface BlockReference {
  id: string;
  workspace_id: string;
  block_id: string;
  reference_type: BlockReferenceType;
  reference_id: string;
  table_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

async function requireBlockAccess(blockId: string, opts?: { authContext?: AuthContext }): Promise<{ error: string } | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string; workspaceId: string }> {
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

  const workspaceId = (block.tabs as { projects?: { workspace_id: string } })?.projects?.workspace_id;
  if (!workspaceId) return { error: "Block is missing workspace" };

  const membership = await checkWorkspaceMembership(workspaceId, userId);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase, userId, workspaceId };
}

const VALID_REFERENCE_TYPES: BlockReferenceType[] = ["doc", "table_row", "task", "block"];

function validateReferenceType(type: string): type is BlockReferenceType {
  return VALID_REFERENCE_TYPES.includes(type as BlockReferenceType);
}

export async function createBlockReference(input: {
  blockId: string;
  referenceType: BlockReferenceType;
  referenceId: string;
  tableId?: string | null;
  authContext?: AuthContext;
}): Promise<ActionResult<BlockReference>> {
  const access = await requireBlockAccess(input.blockId, { authContext: input.authContext });
  if ("error" in access) return { error: access.error };

  if (!validateReferenceType(input.referenceType)) {
    return { error: "Invalid reference type" };
  }

  const { supabase, userId, workspaceId } = access;

  const { data, error } = await supabase
    .from("block_references")
    .insert({
      workspace_id: workspaceId,
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
  const supabase = opts?.authContext?.supabase ?? await createClient();
  const user = opts?.authContext?.userId ?? (await getAuthenticatedUser())?.id;
  if (!user) return { error: "Unauthorized" };

  const { data: ref, error: refError } = await supabase
    .from("block_references")
    .select("id, workspace_id")
    .eq("id", referenceId)
    .single();

  if (refError || !ref) return { error: "Reference not found" };

  const membership = await checkWorkspaceMembership(ref.workspace_id, user);
  if (!membership) return { error: "Not a member of this workspace" };

  const { error } = await supabase.from("block_references").delete().eq("id", referenceId);
  if (error) return { error: "Failed to delete reference" };
  return { data: null };
}

export async function listBlockReferences(blockId: string, opts?: { authContext?: AuthContext }): Promise<ActionResult<BlockReference[]>> {
  const access = await requireBlockAccess(blockId, opts);
  if ("error" in access) return { error: access.error };

  const { supabase } = access;

  const { data, error } = await supabase
    .from("block_references")
    .select("*")
    .eq("block_id", blockId)
    .order("created_at", { ascending: false });

  if (error || !data) return { error: "Failed to load references" };
  return { data: data as BlockReference[] };
}

export type BlockReferenceSummary = BlockReference & { title: string; type_label?: string };

async function resolveBlockReferenceSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ref: BlockReference
): Promise<{ title: string; typeLabel?: string }> {
  if (ref.reference_type === "doc") {
    const { data } = await supabase.from("docs").select("title").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.title ?? "Doc", typeLabel: "Doc" };
  }
  if (ref.reference_type === "task") {
    const { data } = await supabase.from("task_items").select("title").eq("id", ref.reference_id).maybeSingle();
    return { title: data?.title ?? "Task", typeLabel: "Task" };
  }
  if (ref.reference_type === "block") {
    const { data } = await supabase
      .from("blocks")
      .select("type, content")
      .eq("id", ref.reference_id)
      .maybeSingle();
    if (!data) return { title: "Block", typeLabel: "Block" };
    const content = (data as { content?: { title?: string; tableId?: string } })?.content ?? {};
    if (data.type === "table" && content.tableId) {
      const { data: table } = await supabase.from("tables").select("title").eq("id", content.tableId).maybeSingle();
      return { title: table?.title ?? "Table", typeLabel: "Table" };
    }
    const label = data.type ? String(data.type).replace(/_/g, " ") : "Block";
    const typeLabel = label.charAt(0).toUpperCase() + label.slice(1) + " block";
    return { title: (content as { title?: string }).title ?? typeLabel, typeLabel };
  }
  if (ref.reference_type === "table_row") {
    const { data: row } = await supabase
      .from("table_rows")
      .select("id, data, table_id")
      .eq("id", ref.reference_id)
      .maybeSingle();
    if (!row) return { title: "Row", typeLabel: "Row" };
    const { data: fields } = await supabase
      .from("table_fields")
      .select("id, type, is_primary")
      .eq("table_id", row.table_id)
      .order("order", { ascending: true });
    const rowData = (row.data ?? {}) as Record<string, unknown>;
    const primary = (fields ?? []).find((f: { is_primary?: boolean }) => f.is_primary);
    const textField = (fields ?? []).find((f: { type?: string }) => f.type === "text");
    const fallback = (fields ?? [])[0];
    const fieldId = primary?.id ?? textField?.id ?? fallback?.id;
    const value = fieldId ? rowData[fieldId] : null;
    return { title: value != null ? String(value) : `Row ${(row.id as string).slice(0, 8)}`, typeLabel: "Row" };
  }
  return { title: "Attachment" };
}

export async function listBlockReferenceSummaries(
  blockId: string,
  opts?: { authContext?: AuthContext }
): Promise<ActionResult<BlockReferenceSummary[]>> {
  const base = await listBlockReferences(blockId, opts);
  if ("error" in base) return base;
  const supabase = await createClient();
  const resolved: BlockReferenceSummary[] = [];
  for (const ref of base.data) {
    const summary = await resolveBlockReferenceSummary(supabase, ref);
    resolved.push({ ...ref, title: summary.title, type_label: summary.typeLabel });
  }
  return { data: resolved };
}
