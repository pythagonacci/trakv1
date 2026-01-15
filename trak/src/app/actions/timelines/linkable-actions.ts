"use server";

import { createClient } from "@/lib/supabase/server";
import { checkWorkspaceMembership, getAuthenticatedUser } from "@/lib/auth-utils";

export type LinkableType = "doc" | "table" | "task" | "file" | "block";
export type LinkableReferenceType = "doc" | "task" | "block";

export interface LinkableItem {
  id: string;
  type: LinkableType;
  name: string;
  location: string;
  referenceType: LinkableReferenceType;
  updatedAt?: string | null;
}

type ActionResult<T> = { data: T } | { error: string };

const FILE_BLOCK_TYPES = new Set(["file", "image", "video", "pdf", "embed"]);
const TITLE_BLOCK_TYPES = new Set(["section", "link", "task"]);

async function requireProjectAccess(projectId: string, workspaceId: string): Promise<{ error: string } | { supabase: any }> {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, workspace_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project) return { error: "Project not found" };
  if (project.workspace_id !== workspaceId) return { error: "Project is in a different workspace" };

  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  return { supabase };
}

function filterByQuery(items: LinkableItem[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => item.name.toLowerCase().includes(trimmed));
}

function filterByType(items: LinkableItem[], type?: LinkableType | null) {
  if (!type) return items;
  return items.filter((item) => item.type === type);
}

export async function getRecentLinkableItems(input: {
  projectId: string;
  workspaceId: string;
  limit?: number;
}): Promise<ActionResult<LinkableItem[]>> {
  const access = await requireProjectAccess(input.projectId, input.workspaceId);
  if ("error" in access) return access;

  const { supabase } = access;
  const { data: tabs } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", input.projectId)
    .limit(1000);

  const tabMap = new Map((tabs || []).map((tab: any) => [tab.id, tab.name || "Untitled tab"]));
  const tabIds = (tabs || []).map((tab: any) => tab.id);
  if (tabIds.length === 0) return { data: [] };

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, content, tab_id, updated_at")
    .in("tab_id", tabIds)
    .limit(500);

  const items = await buildLinkableItems(supabase, blocks || [], tabMap);
  const sorted = items
    .slice()
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

  return { data: sorted.slice(0, input.limit ?? 8) };
}

export async function searchLinkableItems(input: {
  projectId: string;
  workspaceId: string;
  query: string;
  type?: LinkableType | null;
  limit?: number;
}): Promise<ActionResult<LinkableItem[]>> {
  const access = await requireProjectAccess(input.projectId, input.workspaceId);
  if ("error" in access) return access;

  const trimmed = input.query.trim();
  if (!trimmed) return { data: [] };

  const { supabase } = access;
  const { data: tabs } = await supabase
    .from("tabs")
    .select("id, name")
    .eq("project_id", input.projectId)
    .limit(1000);

  const tabMap = new Map((tabs || []).map((tab: any) => [tab.id, tab.name || "Untitled tab"]));
  const tabIds = (tabs || []).map((tab: any) => tab.id);
  if (tabIds.length === 0) return { data: [] };

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, type, content, tab_id, updated_at")
    .in("tab_id", tabIds)
    .limit(500);

  const items = await buildLinkableItems(supabase, blocks || [], tabMap);
  const filtered = filterByType(filterByQuery(items, trimmed), input.type);
  return { data: filtered.slice(0, input.limit ?? 50) };
}

async function buildLinkableItems(supabase: any, blocks: any[], tabMap: Map<string, string>) {
  const tableIdMap = new Map<string, string>();
  const tableIds = blocks
    .filter((block) => block.type === "table" && block.content?.tableId)
    .map((block) => block.content.tableId);

  if (tableIds.length > 0) {
    const { data: tables } = await supabase
      .from("tables")
      .select("id, title")
      .in("id", tableIds)
      .limit(500);

    (tables || []).forEach((table: any) => {
      if (table?.id) {
        tableIdMap.set(table.id, table.title || "Table");
      }
    });
  }

  const fileBlockIds = blocks.filter((block) => FILE_BLOCK_TYPES.has(block.type)).map((block) => block.id);
  const fileNameMap = new Map<string, string>();

  if (fileBlockIds.length > 0) {
    const { data: attachments } = await supabase
      .from("file_attachments")
      .select("block_id, files(file_name)")
      .in("block_id", fileBlockIds)
      .limit(500);

    (attachments || []).forEach((attachment: any) => {
      const file = Array.isArray(attachment.files) ? attachment.files[0] : attachment.files;
      if (!file?.file_name) return;
      if (!fileNameMap.has(attachment.block_id)) {
        fileNameMap.set(attachment.block_id, file.file_name);
      }
    });
  }

  const items: LinkableItem[] = [];

  blocks.forEach((block) => {
    const location = tabMap.get(block.tab_id) || "Untitled tab";
    const content = (block.content || {}) as Record<string, any>;

    if (block.type === "doc_reference" && content.doc_id) {
      items.push({
        id: content.doc_id,
        type: "doc",
        name: content.doc_title || "Untitled doc",
        location,
        referenceType: "doc",
        updatedAt: block.updated_at,
      });
      return;
    }

    if (block.type === "table") {
      const linkedTableId = content.tableId;
      items.push({
        id: block.id,
        type: "table",
        name: (linkedTableId && tableIdMap.get(linkedTableId)) || content.title || "Table",
        location,
        referenceType: "block",
        updatedAt: block.updated_at,
      });
      return;
    }

    if (block.type === "task") {
      items.push({
        id: block.id,
        type: "task",
        name: content.title || "Task list",
        location,
        referenceType: "block",
        updatedAt: block.updated_at,
      });
      return;
    }

    if (FILE_BLOCK_TYPES.has(block.type)) {
      items.push({
        id: block.id,
        type: "file",
        name: fileNameMap.get(block.id) || "File",
        location,
        referenceType: "block",
        updatedAt: block.updated_at,
      });
      return;
    }

    if (TITLE_BLOCK_TYPES.has(block.type) && content.title) {
      items.push({
        id: block.id,
        type: "block",
        name: content.title,
        location,
        referenceType: "block",
        updatedAt: block.updated_at,
      });
    }
  });

  return items;
}
