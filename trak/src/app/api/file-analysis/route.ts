import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import { getCurrentWorkspaceId } from "@/app/actions/workspace";
import { aiDebug } from "@/lib/ai/debug";
import { getOrCreateFileAnalysisSession } from "@/app/actions/file-analysis";
import {
  getSessionFiles,
  getTabAttachedFiles,
  getProjectFiles,
  getWorkspaceFiles,
} from "@/lib/file-analysis/context";
import {
  ensureFileArtifact,
  ensureFileChunks,
  shouldUseRag,
  type FileRecord,
} from "@/lib/file-analysis/service";
import {
  MAX_HISTORY_MESSAGES,
  MAX_INLINE_FILE_BYTES,
  MAX_INLINE_PAGES,
  MAX_INLINE_ROWS,
} from "@/lib/file-analysis/constants";
import type { FileAnalysisMessageContent, FileCitation } from "@/lib/file-analysis/types";
import { buildScopeHints, selectFilesForQuery } from "@/lib/file-analysis/selection";
import { logger } from "@/lib/logger";
import { IndexingQueue } from "@/lib/search/job-queue";
import { executeAICommand, type AIMessage, type ExecutionResult } from "@/lib/ai/executor";

interface FileAnalysisRequest {
  sessionId?: string;
  message?: string;
  tabId?: string | null;
  projectId?: string | null;
  mode?: "message" | "upload_summary";
  fileIds?: string[];
}

function buildClarification(options: string[], question: string): FileAnalysisMessageContent {
  return {
    text: question,
    clarification: {
      question,
      options,
    },
  };
}

function sanitizePromptText(input: string) {
  return input.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function formatUploadSummary(fileName: string, details: {
  rowCount?: number | null;
  columnCount?: number | null;
  pageCount?: number | null;
  tokenEstimate?: number | null;
  isImage?: boolean;
  isLarge?: boolean;
}) {
  const sizeNote = details.isLarge ? " This is a large file and may take a moment to process." : "";
  if (details.isImage) {
    return `I received ${fileName}. Image extraction (OCR) isn't available yet, but I can still answer questions if you describe what you need.${sizeNote}`;
  }
  if (details.rowCount) {
    return `I received ${fileName}. It has ${details.rowCount} rows and ${details.columnCount || 0} columns.${sizeNote}`;
  }
  if (details.pageCount) {
    return `I received ${fileName}. It has ${details.pageCount} pages.${sizeNote}`;
  }
  return `I received ${fileName}. It contains ${details.tokenEstimate || 0} tokens of text.${sizeNote}`;
}

function safeTextFromContent(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    const obj = content as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function mentionsTasks(text: string) {
  return /\b(task|tasks|overdue|todo|to-do|backlog)\b/i.test(text);
}

function hasMutationVerb(text: string) {
  return /\b(update|edit|change|set|mark|complete|close|reopen|assign|unassign|delete|remove|move|rename|archive|unarchive|duplicate|reschedule|postpone|defer|snooze|prioritiz|deprioritiz|reorder|reassign|convert|merge|split|done)\b/i.test(
    text
  );
}

function isTaskMutationCommand(command: string, historyText: string) {
  const cmd = command.toLowerCase();
  if (/\b(create|add|new)\s+task\b/.test(cmd)) return true;
  if (hasMutationVerb(cmd) && mentionsTasks(cmd)) return true;
  if (hasMutationVerb(cmd) && /\b(them|those|these|all)\b/i.test(cmd) && mentionsTasks(historyText)) {
    return true;
  }
  return false;
}

function isExplicitEntityMutationCommand(command: string) {
  const cmd = command.toLowerCase();
  const verb = /\b(create|update|delete|archive|unarchive|rename|move|copy|duplicate)\b/;
  const entity = /\b(table|project|client|tab|document|doc|file|folder|workspace)\b/;
  return verb.test(cmd) && entity.test(cmd);
}

function buildFileModeSystemPrompt(params: {
  tabId: string | null;
  projectId: string | null;
  projectName: string | null;
  projectTabs: Array<{ id: string; name: string | null }>;
  selectedFiles: Array<{
    id: string;
    file_name: string;
    file_size: number;
    file_type: string | null;
    is_attached?: boolean;
  }>;
  fileSummaries: Array<{
    fileId: string;
    tokenEstimate: number | null;
    rowCount: number | null;
    pageCount: number | null;
    columnCount: number | null;
    useRag: boolean;
    artifactReady: boolean;
    artifactError?: string;
  }>;
}) {
  const scope = params.tabId ? "tab" : params.projectId ? "project" : "workspace";
  const summaryByFileId = new Map(params.fileSummaries.map((summary) => [summary.fileId, summary]));
  const fileLines = params.selectedFiles.map((file) => {
    const summary = summaryByFileId.get(file.id);
    const artifactNote = summary
      ? summary.artifactReady
        ? `tokens=${summary.tokenEstimate ?? "?"}, rows=${summary.rowCount ?? "?"}, pages=${summary.pageCount ?? "?"}, cols=${summary.columnCount ?? "?"}, retrieval=${summary.useRag ? "rag" : "inline"}`
        : `artifact=unavailable (${summary.artifactError || "unknown"})`
      : "artifact=not-loaded";
    const attached = file.is_attached ? "attached" : "not-attached";
    return `- ${sanitizePromptText(file.file_name)} [id=${file.id}] (${sanitizePromptText(file.file_type || "unknown")}, ${Math.round(file.file_size / 1024)} KB, ${attached}, ${artifactNote})`;
  });
  const projectTabsList = params.projectTabs
    .map((tab) => sanitizePromptText(tab.name || "Untitled tab"))
    .filter(Boolean);

  return [
    "You are in FILE ANALYSIS MODE with full AI assistant/workflow capabilities and full tool access.",
    "Use all normal assistant tools when needed (tasks, tables, blocks, docs, projects, timeline, search).",
    "When the user asks about file contents, ALWAYS call fileAnalysisQuery first using the selected file IDs listed below before giving factual file-specific answers.",
    "If the user asks to compare, aggregate, or combine files, call fileAnalysisQuery with all relevant selected file IDs.",
    "If needed files are missing, use searchFiles first, then call fileAnalysisQuery with resolved IDs.",
    "Do not invent file facts. If fileAnalysisQuery returns insufficient data, state that clearly and ask a focused follow-up.",
    "Never include internal UUIDs in user-facing prose.",
    `Current scope: ${scope}`,
    params.projectId ? `Current project: ${sanitizePromptText(params.projectName || "Unknown project")}` : "",
    params.tabId ? `Current tab id: ${params.tabId}` : "",
    projectTabsList.length > 0 ? `Project tabs: ${projectTabsList.join(", ")}` : "",
    "Selected files for this turn:",
    ...fileLines,
  ].filter(Boolean).join("\n");
}

function buildCitationsFromToolCalls(params: {
  toolCallsMade: ExecutionResult["toolCallsMade"];
  selectedFiles: Array<{ id: string; file_name: string; is_attached?: boolean }>;
}) {
  const selectedById = new Map(params.selectedFiles.map((file) => [file.id, file]));
  const citations = new Map<string, FileCitation>();
  const inserts = new Map<string, { file_id: string; chunk_id?: string }>();

  const addCitation = (fileId: string, fileName: string, chunkId?: string, excerpt?: string) => {
    const key = `${fileId}:${chunkId || "none"}`;
    if (citations.has(key)) return;
    const selected = selectedById.get(fileId);
    citations.set(key, {
      id: "",
      file_id: fileId,
      file_name: fileName,
      chunk_id: chunkId || undefined,
      excerpt: excerpt || undefined,
      is_attached: selected?.is_attached || false,
    });
    inserts.set(key, chunkId ? { file_id: fileId, chunk_id: chunkId } : { file_id: fileId });
  };

  for (const call of params.toolCallsMade || []) {
    if (call.tool !== "fileAnalysisQuery") continue;
    if (!call.result?.success) continue;

    const payload = call.result.data as { results?: Array<Record<string, unknown>> } | undefined;
    const results = Array.isArray(payload?.results) ? payload.results : [];

    for (const result of results) {
      const fileObj = (result.file || null) as { id?: string; file_name?: string } | null;
      const fileId = typeof fileObj?.id === "string" ? fileObj.id : "";
      if (!fileId) continue;
      const fallbackName = selectedById.get(fileId)?.file_name || "Unknown file";
      const fileName = typeof fileObj?.file_name === "string" ? fileObj.file_name : fallbackName;
      const chunks = Array.isArray(result.chunks) ? (result.chunks as Array<Record<string, unknown>>) : [];
      if (chunks.length === 0) {
        addCitation(fileId, fileName);
        continue;
      }

      for (const chunk of chunks) {
        const chunkId = typeof chunk.id === "string" ? chunk.id : undefined;
        const excerpt = typeof chunk.content === "string" ? chunk.content.slice(0, 180) : undefined;
        addCitation(fileId, fileName, chunkId, excerpt);
      }
    }
  }

  if (citations.size === 0) {
    for (const file of params.selectedFiles) {
      addCitation(file.id, file.file_name);
    }
  }

  return {
    citations: Array.from(citations.values()),
    inserts: Array.from(inserts.values()),
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const workspaceId = await getCurrentWorkspaceId();
    if (!workspaceId) {
      return NextResponse.json({ success: false, error: "No workspace selected" }, { status: 400 });
    }

    const body = (await request.json()) as FileAnalysisRequest;
    const message = body.message?.trim() || "";
    const tabId = body.tabId || null;
    const projectId = body.projectId || null;

    const sessionResult = await getOrCreateFileAnalysisSession({
      workspaceId,
      projectId: projectId || undefined,
      tabId: tabId || undefined,
    });

    if ("error" in sessionResult) {
      return NextResponse.json({ success: false, error: sessionResult.error }, { status: 400 });
    }

    const session = sessionResult.data;
    const supabase = await createClient();

    if (body.mode === "upload_summary") {
      const fileIds = body.fileIds || [];
      if (fileIds.length === 0) {
        return NextResponse.json({ success: false, error: "Missing fileIds" }, { status: 400 });
      }

      const { data: files, error: filesError } = await supabase
        .from("files")
        .select("id, file_name, file_size, file_type, storage_path, workspace_id, project_id")
        .in("id", fileIds);

      if (filesError) {
        return NextResponse.json({ success: false, error: "Failed to load files" }, { status: 500 });
      }

      const summaries: string[] = [];
      const citationsPayload: Array<{ file_id: string }> = [];

      // Initialize Indexing Queue
      const queue = new IndexingQueue(supabase);

      for (const file of files || []) {
        const artifact = await ensureFileArtifact(supabase, file as FileRecord);
        const isImage = (file.file_type || "").startsWith("image/");
        const isLarge =
          file.file_size > MAX_INLINE_FILE_BYTES ||
          (artifact.row_count || 0) > MAX_INLINE_ROWS ||
          (artifact.page_count || 0) > MAX_INLINE_PAGES;
        summaries.push(
          formatUploadSummary(file.file_name, {
            rowCount: artifact.row_count,
            columnCount: artifact.column_count,
            pageCount: artifact.page_count,
            tokenEstimate: artifact.token_estimate,
            isImage,
            isLarge,
          })
        );
        citationsPayload.push({ file_id: file.id });

        // Trigger Async Indexing for Search
        try {
          // Enqueue job but don't block response
          await queue.enqueue({
            workspaceId: file.workspace_id,
            resourceType: "file",
            resourceId: file.id,
          });
        } catch (err) {
          logger.error("Failed to enqueue indexing job for file", { fileId: file.id, error: err });
        }
      }

      const summaryText = summaries.join("\n");
      const content: FileAnalysisMessageContent = {
        text: `${summaryText}\n\nWhat would you like to know?`,
      };

      const { data: assistantMessage, error: insertError } = await supabase
        .from("file_analysis_messages")
        .insert({
          session_id: session.id,
          role: "assistant",
          content,
        })
        .select("*")
        .single();

      if (insertError || !assistantMessage) {
        return NextResponse.json({ success: false, error: "Failed to save message" }, { status: 500 });
      }

      if (citationsPayload.length > 0) {
        await supabase.from("file_analysis_citations").insert(
          citationsPayload.map((citation) => ({
            message_id: assistantMessage.id,
            file_id: citation.file_id,
          }))
        );
      }

      return NextResponse.json({
        success: true,
        message: assistantMessage,
        citations: citationsPayload,
      });
    }

    if (!message) {
      return NextResponse.json({ success: false, error: "Missing message" }, { status: 400 });
    }

    const { data: userMessage, error: userError } = await supabase
      .from("file_analysis_messages")
      .insert({
        session_id: session.id,
        role: "user",
        content: { text: message },
      })
      .select("*")
      .single();

    if (userError || !userMessage) {
      return NextResponse.json({ success: false, error: "Failed to save message" }, { status: 500 });
    }

    const scopeHints = buildScopeHints(message);

    let projectName: string | null = null;
    let projectTabs: Array<{ id: string; name: string | null }> = [];
    if (projectId) {
      const { data: project } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();
      projectName = project?.name ?? null;

      const { data: tabs } = await supabase
        .from("tabs")
        .select("id, name")
        .eq("project_id", projectId);
      projectTabs = (tabs || []).map((tab) => ({ id: tab.id, name: tab.name ?? null }));
    }

    const sessionFiles = await getSessionFiles(supabase, session.id);

    let tabFiles: typeof sessionFiles = [];
    if (tabId && projectId) {
      // Include current tab and any mentioned tabs
      const mentionedTabIds = projectTabs
        .filter((tab) => {
          const name = (tab.name || "").toLowerCase();
          return name && message.toLowerCase().includes(name);
        })
        .map((tab) => tab.id);

      const tabIds = Array.from(new Set([tabId, ...mentionedTabIds]));
      tabFiles = await getTabAttachedFiles(supabase, tabIds);
    }

    const projectFiles = projectId ? await getProjectFiles(supabase, projectId) : [];
    const workspaceFiles = scopeHints.isWorkspace ? await getWorkspaceFiles(supabase, workspaceId) : [];

    const selection = selectFilesForQuery({
      message,
      sessionFiles,
      tabFiles,
      projectFiles,
      workspaceFiles,
    });

    if (selection.clarification) {
      const content = buildClarification(
        selection.clarification.options,
        selection.clarification.question
      );
      const { data: assistantMessage } = await supabase
        .from("file_analysis_messages")
        .insert({ session_id: session.id, role: "assistant", content })
        .select("*")
        .single();
      return NextResponse.json({
        success: true,
        message: assistantMessage,
        citations: [],
        actions: [],
      });
    }

    const selectedFiles = selection.selectedFiles;

    if (selectedFiles.length === 0) {
      const content: FileAnalysisMessageContent = {
        text: "I couldn't find any files in this context. Upload a file or mention one by name, and I'll analyze it.",
      };
      const { data: assistantMessage } = await supabase
        .from("file_analysis_messages")
        .insert({ session_id: session.id, role: "assistant", content })
        .select("*")
        .single();
      return NextResponse.json({ success: true, message: assistantMessage, citations: [], actions: [] });
    }

    // Ensure artifacts/chunks so fileAnalysisQuery is warm and file metadata is available in prompt context.
    const fileRecords: FileRecord[] = selectedFiles.map((file) => ({
      id: file.id,
      file_name: file.file_name,
      file_size: file.file_size,
      file_type: file.file_type,
      storage_path: file.storage_path,
      workspace_id: file.workspace_id,
      project_id: file.project_id,
    }));

    const fileSummaries: Array<{
      fileId: string;
      tokenEstimate: number | null;
      rowCount: number | null;
      pageCount: number | null;
      columnCount: number | null;
      useRag: boolean;
      artifactReady: boolean;
      artifactError?: string;
    }> = [];

    for (const file of fileRecords) {
      try {
        const artifact = await ensureFileArtifact(supabase, file);
        const useRag = shouldUseRag({
          fileSize: file.file_size,
          tokenEstimate: artifact.token_estimate || 0,
          rowCount: artifact.row_count,
          pageCount: artifact.page_count,
        });
        if (useRag) {
          await ensureFileChunks(supabase, file, artifact);
        }
        fileSummaries.push({
          fileId: file.id,
          tokenEstimate: artifact.token_estimate || null,
          rowCount: artifact.row_count || null,
          pageCount: artifact.page_count || null,
          columnCount: artifact.column_count || null,
          useRag,
          artifactReady: true,
        });
      } catch (err) {
        fileSummaries.push({
          fileId: file.id,
          tokenEstimate: null,
          rowCount: null,
          pageCount: null,
          columnCount: null,
          useRag: true,
          artifactReady: false,
          artifactError: err instanceof Error ? err.message : "Failed to prepare file artifact",
        });
      }
    }

    // Load recent history
    const { data: history } = await supabase
      .from("file_analysis_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);

    const historyRows = (history || []) as Array<{ role: string; content: unknown }>;
    const historyMessages: AIMessage[] = historyRows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m): AIMessage => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: sanitizePromptText(safeTextFromContent(m.content)),
      }))
      .filter((m): m is AIMessage => Boolean(m.content));

    const trimmedHistory = historyMessages.slice(0, -1);
    const recentHistoryText = trimmedHistory.slice(-6).map((m) => m.content ?? "").join(" ");

    const [workspaceResult, profileResult] = await Promise.all([
      supabase.from("workspaces").select("id, name").eq("id", workspaceId).maybeSingle(),
      supabase.from("profiles").select("name, email").eq("id", user.id).maybeSingle(),
    ]);

    const systemPrefix: AIMessage[] = [
      {
        role: "system",
        content: buildFileModeSystemPrompt({
          tabId,
          projectId,
          projectName,
          projectTabs,
          selectedFiles: selectedFiles.map((file) => ({
            id: file.id,
            file_name: file.file_name,
            file_size: file.file_size,
            file_type: file.file_type,
            is_attached: file.is_attached,
          })),
          fileSummaries,
        }),
      },
    ];

    const allowTaskMutations = isTaskMutationCommand(message, recentHistoryText);
    const allowEntityMutations = isExplicitEntityMutationCommand(message);
    const allowedWriteTools = [
      "createBlock",
      "updateBlock",
      "updateTableFull",
      "updateTableRowsByFieldNames",
      "bulkInsertRows",
      "bulkUpdateRows",
      "bulkUpdateRowsByFieldNames",
      "createSpecChartBlock",
      "createTableFull",
      "deleteTable",
    ];

    const aiResult = await executeAICommand(
      message,
      {
        workspaceId,
        workspaceName: workspaceResult.data?.name || undefined,
        userId: user.id,
        userName: profileResult.data?.name || profileResult.data?.email || undefined,
        currentProjectId: projectId || undefined,
        currentTabId: tabId || undefined,
      },
      [...systemPrefix, ...trimmedHistory],
      {
        readOnly: !(allowTaskMutations || allowEntityMutations),
        allowedWriteTools,
        enforceBatchUpdateCompletion: allowTaskMutations,
        forcedToolGroups: [
          "core",
          "task",
          "project",
          "table",
          "timeline",
          "block",
          "tab",
          "doc",
          "file",
          "client",
          "property",
          "comment",
          "workspace",
        ],
        disableDeterministic: true,
        disableOptimisticEarlyExit: true,
      }
    );

    const { citations, inserts: citationInserts } = buildCitationsFromToolCalls({
      toolCallsMade: aiResult.toolCallsMade,
      selectedFiles: selectedFiles.map((file) => ({
        id: file.id,
        file_name: file.file_name,
        is_attached: file.is_attached,
      })),
    });

    const parsed: FileAnalysisMessageContent = {
      text: aiResult.response || aiResult.error || "I couldn't generate a response.",
    };

    const { data: assistantMessage, error: assistantError } = await supabase
      .from("file_analysis_messages")
      .insert({
        session_id: session.id,
        role: "assistant",
        content: parsed,
      })
      .select("*")
      .single();

    if (assistantError || !assistantMessage) {
      return NextResponse.json({ success: false, error: "Failed to save response" }, { status: 500 });
    }

    if (citationInserts.length > 0) {
      await supabase.from("file_analysis_citations").insert(
        citationInserts.map((citation) => ({
          message_id: assistantMessage.id,
          ...citation,
        }))
      );
    }

    const actions: Array<{ type: string; label: string; fileIds?: string[] }> = [];
    if (tabId) {
      actions.push({ type: "save_block", label: "Save as Block" });
    }
    const attachedFiles = selectedFiles.filter((file) => file.is_attached);
    if (attachedFiles.length === 1) {
      actions.push({
        type: "save_comment",
        label: `Save as Comment on ${attachedFiles[0].file_name}`,
        fileIds: [attachedFiles[0].id],
      });
    } else if (attachedFiles.length > 1) {
      attachedFiles.forEach((file) => {
        actions.push({
          type: "save_comment",
          label: `Save as Comment on ${file.file_name}`,
          fileIds: [file.id],
        });
      });
    }

    aiDebug("file-analysis:response", {
      sessionId: session.id,
      usedFiles: selectedFiles.map((f) => f.file_name),
      citations: citations.length,
      aiSuccess: aiResult.success,
      toolCalls: aiResult.toolCallsMade.length,
    });

    return NextResponse.json({
      success: true,
      message: { ...assistantMessage, citations, actions },
      citations,
      actions,
    });
  } catch (error) {
    logger.error("file-analysis api error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
