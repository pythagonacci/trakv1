import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisFile } from "./types";

function normalizeFile(record: any, source: AnalysisFile["source"], attachmentMap?: Map<string, { tabIds: string[] }>): AnalysisFile {
  const fileId = record.id;
  const attachment = attachmentMap?.get(fileId);
  return {
    id: record.id,
    file_name: record.file_name,
    file_size: record.file_size,
    file_type: record.file_type,
    storage_path: record.storage_path,
    workspace_id: record.workspace_id,
    project_id: record.project_id,
    created_at: record.created_at,
    source,
    is_attached: attachment ? attachment.tabIds.length > 0 : false,
    attached_tab_ids: attachment?.tabIds,
  };
}

export async function getAttachmentMap(
  supabase: SupabaseClient,
  fileIds: string[]
) {
  if (fileIds.length === 0) return new Map<string, { tabIds: string[] }>();

  const { data: attachments } = await supabase
    .from("file_attachments")
    .select("file_id, blocks!inner(tab_id)")
    .in("file_id", fileIds);

  const map = new Map<string, { tabIds: string[] }>();
  (attachments || []).forEach((attachment: any) => {
    const fileId = attachment.file_id;
    const block = Array.isArray(attachment.blocks) ? attachment.blocks[0] : attachment.blocks;
    if (!fileId || !block?.tab_id) return;
    const entry = map.get(fileId) || { tabIds: [] };
    entry.tabIds.push(block.tab_id);
    map.set(fileId, entry);
  });
  return map;
}

export async function getSessionFiles(
  supabase: SupabaseClient,
  sessionId: string
): Promise<AnalysisFile[]> {
  const { data } = await supabase
    .from("file_analysis_session_files")
    .select("file:files(id, file_name, file_size, file_type, storage_path, workspace_id, project_id, created_at)")
    .eq("session_id", sessionId);

  const files = (data || []).map((row: any) => Array.isArray(row.file) ? row.file[0] : row.file).filter(Boolean);
  const attachmentMap = await getAttachmentMap(supabase, files.map((file: any) => file.id));

  return files.map((file: any) => normalizeFile(file, "session", attachmentMap));
}

export async function getTabAttachedFiles(
  supabase: SupabaseClient,
  tabIds: string[]
): Promise<AnalysisFile[]> {
  if (tabIds.length === 0) return [];

  const { data } = await supabase
    .from("file_attachments")
    .select(
      "file_id, files!inner(id, file_name, file_size, file_type, storage_path, workspace_id, project_id, created_at), blocks!inner(tab_id)"
    )
    .in("blocks.tab_id", tabIds);

  const files = (data || []).map((row: any) => Array.isArray(row.files) ? row.files[0] : row.files).filter(Boolean);
  const attachmentMap = await getAttachmentMap(supabase, files.map((file: any) => file.id));

  return files.map((file: any) => normalizeFile(file, "tab", attachmentMap));
}

export async function getProjectFiles(
  supabase: SupabaseClient,
  projectId: string
): Promise<AnalysisFile[]> {
  const { data } = await supabase
    .from("files")
    .select("id, file_name, file_size, file_type, storage_path, workspace_id, project_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(200);

  const files = data || [];
  const attachmentMap = await getAttachmentMap(supabase, files.map((file: any) => file.id));
  return files.map((file: any) => normalizeFile(file, "project", attachmentMap));
}

export async function getWorkspaceFiles(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<AnalysisFile[]> {
  const { data } = await supabase
    .from("files")
    .select("id, file_name, file_size, file_type, storage_path, workspace_id, project_id, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(300);

  const files = data || [];
  const attachmentMap = await getAttachmentMap(supabase, files.map((file: any) => file.id));
  return files.map((file: any) => normalizeFile(file, "workspace", attachmentMap));
}
