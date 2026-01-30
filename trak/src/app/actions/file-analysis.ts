"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, checkWorkspaceMembership, getProjectMetadata, getTabMetadata } from "@/lib/auth-utils";
import { createBlock } from "@/app/actions/block";
import { getTable, updateTable } from "@/app/actions/tables/table-actions";
import { createField, deleteField, updateField } from "@/app/actions/tables/field-actions";
import { bulkInsertRows } from "@/app/actions/tables/bulk-actions";
import type { FileAnalysisMessageContent, FileCitation } from "@/lib/file-analysis/types";
import { formatMessageForBlock } from "@/lib/file-analysis/format";
import { getProjectFiles, getSessionFiles, getTabAttachedFiles } from "@/lib/file-analysis/context";
import { logger } from "@/lib/logger";

export type ActionResult<T> = { data: T } | { error: string };

export interface FileAnalysisSession {
  id: string;
  workspace_id: string;
  project_id: string | null;
  tab_id: string | null;
  user_id: string;
  scope_type: "tab" | "project" | "workspace";
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface FileAnalysisMessageRecord {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: FileAnalysisMessageContent;
  created_at: string;
  citations?: FileCitation[];
}

export async function getOrCreateFileAnalysisSession(params: {
  workspaceId: string;
  projectId?: string | null;
  tabId?: string | null;
}): Promise<ActionResult<FileAnalysisSession>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const workspaceId = params.workspaceId;
  const membership = await checkWorkspaceMembership(workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  let projectId = params.projectId || null;
  let tabId = params.tabId || null;

  if (tabId) {
    const tab = await getTabMetadata(tabId);
    if (!tab) return { error: "Tab not found" };
    projectId = tab.project_id;
  }

  if (projectId) {
    const project = await getProjectMetadata(projectId);
    if (!project) return { error: "Project not found" };
  }

  const scope_type: FileAnalysisSession["scope_type"] = tabId
    ? "tab"
    : projectId
      ? "project"
      : "workspace";

  let query = supabase
    .from("file_analysis_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId);

  if (tabId) {
    query = query.eq("tab_id", tabId);
  } else if (projectId) {
    query = query.is("tab_id", null).eq("project_id", projectId);
  } else {
    query = query.is("tab_id", null).is("project_id", null);
  }

  const { data: existing, error: existingError } = await query.maybeSingle();

  if (existingError) {
    logger.error("getOrCreateFileAnalysisSession query error:", existingError);
    return { error: "Failed to load session" };
  }

  if (existing) {
    return { data: existing as FileAnalysisSession };
  }

  const { data: session, error } = await supabase
    .from("file_analysis_sessions")
    .insert({
      workspace_id: workspaceId,
      project_id: projectId,
      tab_id: tabId,
      user_id: user.id,
      scope_type,
    })
    .select("*")
    .single();

  if (error || !session) {
    logger.error("getOrCreateFileAnalysisSession insert error:", error);
    return { error: "Failed to create session" };
  }

  return { data: session as FileAnalysisSession };
}

export async function getFileAnalysisSessionMessages(sessionId: string): Promise<ActionResult<FileAnalysisMessageRecord[]>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: messages, error } = await supabase
    .from("file_analysis_messages")
    .select(
      `id, session_id, role, content, created_at,
        file_analysis_citations (
          id, file_id, chunk_id, page_number, row_start, row_end, excerpt,
          files ( file_name )
        )`
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("getFileAnalysisSessionMessages error:", error);
    return { error: "Failed to load messages" };
  }

  const fileIds = new Set<string>();
  (messages || []).forEach((message: any) => {
    (message.file_analysis_citations || []).forEach((citation: any) => {
      if (citation.file_id) fileIds.add(citation.file_id);
    });
  });

  let attachedMap = new Map<string, boolean>();
  if (fileIds.size > 0) {
    const { data: attachments } = await supabase
      .from("file_attachments")
      .select("file_id")
      .in("file_id", Array.from(fileIds));
    attachedMap = new Map((attachments || []).map((att: any) => [att.file_id, true]));
  }

  const formatted = (messages || []).map((message: any) => {
    const citations = (message.file_analysis_citations || []).map((citation: any) => {
      const fileName = Array.isArray(citation.files)
        ? citation.files[0]?.file_name
        : citation.files?.file_name;
      return {
        id: citation.id,
        file_id: citation.file_id,
        file_name: fileName || "Unknown file",
        chunk_id: citation.chunk_id,
        page_number: citation.page_number,
        row_start: citation.row_start,
        row_end: citation.row_end,
        excerpt: citation.excerpt,
        is_attached: attachedMap.get(citation.file_id) || false,
      } as FileCitation;
    });
    return {
      id: message.id,
      session_id: message.session_id,
      role: message.role,
      content: message.content as FileAnalysisMessageContent,
      created_at: message.created_at,
      citations,
    } as FileAnalysisMessageRecord;
  });

  return { data: formatted };
}

export async function addFileToAnalysisSession(params: {
  sessionId: string;
  fileId: string;
  source?: "upload" | "mention" | "attached";
}): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("file_analysis_session_files")
    .upsert({
      session_id: params.sessionId,
      file_id: params.fileId,
      source: params.source || "upload",
    }, { onConflict: "session_id,file_id" });

  if (error) {
    logger.error("addFileToAnalysisSession error:", error);
    return { error: "Failed to add file to session" };
  }

  return { data: null };
}

export async function saveFileAnalysisAsBlock(params: {
  messageId: string;
  tabId: string;
}): Promise<ActionResult<{ blockId: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: message, error } = await supabase
    .from("file_analysis_messages")
    .select("id, content, session_id")
    .eq("id", params.messageId)
    .single();

  if (error || !message) {
    return { error: "Message not found" };
  }

  const content = message.content as FileAnalysisMessageContent;

  const createdBlockIds: string[] = [];
  const textPayload = formatMessageForBlock({ ...content, tables: undefined });
  if (textPayload.trim().length > 0) {
    const textResult = await createBlock({
      tabId: params.tabId,
      type: "text",
      content: { text: textPayload },
    });
    if ("error" in textResult) {
      return { error: textResult.error };
    }
    createdBlockIds.push(textResult.data.id);
  }

  if (content.tables && content.tables.length > 0) {
    for (const table of content.tables) {
      const tableResult = await createBlock({
        tabId: params.tabId,
        type: "table",
      });
      if ("error" in tableResult) {
        return { error: tableResult.error };
      }

      const tableId = (tableResult.data.content as { tableId?: string } | null)?.tableId;
      if (!tableId) {
        return { error: "Failed to create table for analysis output" };
      }

      if (table.title) {
        const updateResult = await updateTable(tableId, { title: table.title });
        if ("error" in updateResult) {
          return { error: updateResult.error };
        }
      }

      const tableData = await getTable(tableId);
      if ("error" in tableData) {
        return { error: tableData.error };
      }

      const existingFields = [...tableData.data.fields].sort((a, b) => (a.order || 0) - (b.order || 0));
      const columnNames = table.columns || [];

      if (columnNames.length > 0) {
        const fieldIds: string[] = [];

        for (let idx = 0; idx < columnNames.length; idx += 1) {
          const columnName = columnNames[idx] || `Column ${idx + 1}`;
          const existing = existingFields[idx];
          if (existing) {
            const updateResult = await updateField(existing.id, {
              name: columnName,
              is_primary: idx === 0,
            });
            if ("error" in updateResult) {
              return { error: updateResult.error };
            }
            fieldIds.push(existing.id);
          } else {
            const createResult = await createField({
              tableId,
              name: columnName,
              type: "text",
              isPrimary: idx === 0,
            });
            if ("error" in createResult) {
              return { error: createResult.error };
            }
            fieldIds.push(createResult.data.id);
          }
        }

        // Remove any extra default fields beyond the provided columns.
        for (let idx = columnNames.length; idx < existingFields.length; idx += 1) {
          const field = existingFields[idx];
          if (!field) continue;
          const deleteResult = await deleteField(field.id);
          if ("error" in deleteResult) {
            return { error: deleteResult.error };
          }
        }

        // Remove default rows before inserting AI output.
        const { data: existingRows, error: rowLoadError } = await supabase
          .from("table_rows")
          .select("id")
          .eq("table_id", tableId);
        if (rowLoadError) {
          return { error: "Failed to prepare table rows" };
        }
        if (existingRows && existingRows.length > 0) {
          const { error: deleteRowsError } = await supabase
            .from("table_rows")
            .delete()
            .in("id", existingRows.map((row: any) => row.id));
          if (deleteRowsError) {
            return { error: "Failed to reset table rows" };
          }
        }

        const rowsPayload = (table.rows || []).map((row) => {
          const data: Record<string, unknown> = {};
          fieldIds.forEach((fieldId, idx) => {
            data[fieldId] = row?.[idx] ?? null;
          });
          return { data };
        });

        const insertResult = await bulkInsertRows({ tableId, rows: rowsPayload });
        if ("error" in insertResult) {
          return { error: insertResult.error };
        }
      }

      createdBlockIds.push(tableResult.data.id);
    }
  }

  if (createdBlockIds.length === 0) {
    return { error: "Nothing to save" };
  }

  return { data: { blockId: createdBlockIds[0] } };
}

export async function clearFileAnalysisSession(params: {
  sessionId: string;
}): Promise<ActionResult<null>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: session, error: sessionError } = await supabase
    .from("file_analysis_sessions")
    .select("id, user_id")
    .eq("id", params.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return { error: "Session not found" };
  }

  if (session.user_id !== user.id) {
    return { error: "Not allowed to clear this session" };
  }

  const { error: messagesError } = await supabase
    .from("file_analysis_messages")
    .delete()
    .eq("session_id", params.sessionId);

  if (messagesError) {
    return { error: "Failed to clear chat messages" };
  }

  const { error: filesError } = await supabase
    .from("file_analysis_session_files")
    .delete()
    .eq("session_id", params.sessionId);

  if (filesError) {
    return { error: "Failed to clear session files" };
  }

  await supabase
    .from("file_analysis_sessions")
    .update({ last_message_at: null })
    .eq("id", params.sessionId);

  return { data: null };
}

export async function saveFileAnalysisAsComment(params: {
  messageId: string;
  fileId: string;
}): Promise<ActionResult<{ commentId: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: message, error: messageError } = await supabase
    .from("file_analysis_messages")
    .select("id, content")
    .eq("id", params.messageId)
    .single();

  if (messageError || !message) {
    return { error: "Message not found" };
  }

  // Ensure file is attached to a block (not just chat upload)
  const { data: attachment } = await supabase
    .from("file_attachments")
    .select("id")
    .eq("file_id", params.fileId)
    .limit(1)
    .maybeSingle();

  if (!attachment) {
    return { error: "File is not attached to a project or tab" };
  }

  const content = message.content as FileAnalysisMessageContent;
  const text = formatMessageForBlock(content);
  if (!text.trim()) {
    return { error: "Nothing to save as a comment" };
  }

  const { data: comment, error } = await supabase
    .from("file_comments")
    .insert({
      file_id: params.fileId,
      user_id: user.id,
      analysis_message_id: params.messageId,
      text,
    })
    .select("id")
    .single();

  if (error || !comment) {
    logger.error("saveFileAnalysisAsComment error:", error);
    return { error: "Failed to save comment" };
  }

  return { data: { commentId: comment.id } };
}

export async function getFileAnalysisContextFiles(params: {
  sessionId: string;
  workspaceId: string;
  projectId?: string | null;
  tabId?: string | null;
}): Promise<ActionResult<Array<{ id: string; file_name: string }>>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const membership = await checkWorkspaceMembership(params.workspaceId, user.id);
  if (!membership) return { error: "Not a member of this workspace" };

  const sessionFiles = await getSessionFiles(supabase, params.sessionId);
  const tabFiles = params.tabId ? await getTabAttachedFiles(supabase, [params.tabId]) : [];
  const projectFiles = params.projectId ? await getProjectFiles(supabase, params.projectId) : [];

  const unique = new Map<string, { id: string; file_name: string }>();
  [...sessionFiles, ...tabFiles, ...projectFiles].forEach((file) => {
    if (!unique.has(file.id)) {
      unique.set(file.id, { id: file.id, file_name: file.file_name });
    }
  });

  return { data: Array.from(unique.values()) };
}

export async function getFileAnalysisComments(params: {
  fileIds: string[];
}): Promise<ActionResult<Array<{ id: string; file_id: string; text: string; created_at: string; user_id: string | null }>>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const fileIds = Array.from(new Set((params.fileIds || []).filter(Boolean)));
  if (fileIds.length === 0) return { data: [] };

  const { data: files, error: filesError } = await supabase
    .from("files")
    .select("id, workspace_id")
    .in("id", fileIds);

  if (filesError) {
    return { error: "Failed to load files" };
  }

  const workspaceIds = Array.from(new Set((files || []).map((file: any) => file.workspace_id)));
  for (const workspaceId of workspaceIds) {
    const membership = await checkWorkspaceMembership(workspaceId, user.id);
    if (!membership) {
      return { error: "Not a member of this workspace" };
    }
  }

  const { data: comments, error } = await supabase
    .from("file_comments")
    .select("id, file_id, text, created_at, user_id")
    .in("file_id", fileIds)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: "Failed to load file comments" };
  }

  return { data: (comments || []) as Array<{ id: string; file_id: string; text: string; created_at: string; user_id: string | null }> };
}

export async function deleteFileAnalysisComment(params: {
  commentId: string;
}): Promise<ActionResult<{ deletedId: string }>> {
  const supabase = await createClient();
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized" };

  const { data: comment, error: commentError } = await supabase
    .from("file_comments")
    .select("id, file_id, user_id")
    .eq("id", params.commentId)
    .single();

  if (commentError || !comment) {
    return { error: "Comment not found" };
  }

  if (comment.user_id !== user.id) {
    return { error: "Not allowed to delete this comment" };
  }

  const { data: file, error: fileError } = await supabase
    .from("files")
    .select("workspace_id")
    .eq("id", comment.file_id)
    .single();

  if (fileError || !file) {
    return { error: "File not found" };
  }

  const membership = await checkWorkspaceMembership(file.workspace_id, user.id);
  if (!membership) {
    return { error: "Not a member of this workspace" };
  }

  const { error } = await supabase
    .from("file_comments")
    .delete()
    .eq("id", comment.id);

  if (error) {
    return { error: "Failed to delete comment" };
  }

  return { data: { deletedId: comment.id } };
}
