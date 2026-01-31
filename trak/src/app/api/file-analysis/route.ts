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
  retrieveRelevantChunks,
  shouldUseRag,
  type FileRecord,
} from "@/lib/file-analysis/service";
import {
  DEFAULT_DEEPSEEK_MODEL,
  MAX_HISTORY_MESSAGES,
  RETRIEVAL_TOP_K,
  DEEPSEEK_API_URL,
  MAX_INLINE_FILE_BYTES,
  MAX_INLINE_PAGES,
  MAX_INLINE_ROWS,
  FILE_ANALYSIS_MAX_TOKENS,
} from "@/lib/file-analysis/constants";
import type { FileAnalysisMessageContent, FileCitation } from "@/lib/file-analysis/types";
import { buildScopeHints, selectFilesForQuery } from "@/lib/file-analysis/selection";
import { logger } from "@/lib/logger";

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

async function callDeepSeek(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_DEEPSEEK_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: FILE_ANALYSIS_MAX_TOKENS,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek error: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content?.trim();
  return content || "";
}

function parseModelOutput(raw: string): FileAnalysisMessageContent {
  if (!raw) {
    return { text: "I couldn't generate a response." };
  }

  const stripCodeFences = (input: string) => {
    const match = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return match ? match[1].trim() : input;
  };

  const repairJson = (input: string) => {
    let result = "";
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (escaped) {
        result += char;
        escaped = false;
        continue;
      }
      if (char === "\\") {
        result += char;
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = !inString;
        result += char;
        continue;
      }
      if (inString && (char === "\n" || char === "\r")) {
        result += "\\n";
        if (char === "\r" && input[i + 1] === "\n") {
          i += 1;
        }
        continue;
      }
      result += char;
    }

    return result;
  };

  const normalizedRaw = repairJson(stripCodeFences(raw));

  try {
    const jsonStart = normalizedRaw.indexOf("{");
    const jsonEnd = normalizedRaw.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const sliced = normalizedRaw.slice(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(sliced);
      if (parsed && typeof parsed === "object") {
        const normalizedTables = Array.isArray(parsed.tables)
          ? parsed.tables.map((table: any) => {
              const columns =
                Array.isArray(table?.columns) && table.columns.length > 0
                  ? table.columns
                  : Array.isArray(table?.headers)
                    ? table.headers
                    : [];
              return {
                ...table,
                columns,
              };
            })
          : undefined;

        return {
          text: String(parsed.text || parsed.answer || "").trim(),
          tables: normalizedTables,
          charts: parsed.charts || undefined,
          notes: parsed.notes || undefined,
        };
      }
    }
  } catch {
    // fall through
  }

  const textMatch = normalizedRaw.match(/"text"\s*:\s*"(.*?)"\s*(?:,\s*"(tables|charts|notes|clarification)"|}$)/s);
  if (textMatch?.[1]) {
    try {
      return { text: JSON.parse(`"${textMatch[1]}"`) };
    } catch {
      return { text: textMatch[1] };
    }
  }

  return { text: normalizedRaw };
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
    const safeMessage = sanitizePromptText(message);

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

    const allCandidates = [
      ...sessionFiles,
      ...tabFiles,
      ...projectFiles,
      ...workspaceFiles,
    ];

    const uniqueCandidates = new Map<string, typeof allCandidates[0]>();
    allCandidates.forEach((file) => {
      if (!uniqueCandidates.has(file.id)) {
        uniqueCandidates.set(file.id, file);
      }
    });

    const candidates = Array.from(uniqueCandidates.values());

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

    let selectedFiles = selection.selectedFiles;

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

    // Ensure artifacts and chunks
    const fileRecords: FileRecord[] = selectedFiles.map((file) => ({
      id: file.id,
      file_name: file.file_name,
      file_size: file.file_size,
      file_type: file.file_type,
      storage_path: file.storage_path,
      workspace_id: file.workspace_id,
      project_id: file.project_id,
    }));

    const artifacts = new Map<string, any>();
    for (const file of fileRecords) {
      const artifact = await ensureFileArtifact(supabase, file);
      artifacts.set(file.id, artifact);
      const useRag = shouldUseRag({
        fileSize: file.file_size,
        tokenEstimate: artifact.token_estimate || 0,
        rowCount: artifact.row_count,
        pageCount: artifact.page_count,
      });
      if (useRag) {
        await ensureFileChunks(supabase, file, artifact);
      }
    }

    const ragFileIds = fileRecords.filter((file) => {
      const artifact = artifacts.get(file.id);
      return shouldUseRag({
        fileSize: file.file_size,
        tokenEstimate: artifact?.token_estimate || 0,
        rowCount: artifact?.row_count,
        pageCount: artifact?.page_count,
      });
    }).map((file) => file.id);

    const retrievedChunks = ragFileIds.length > 0
      ? await retrieveRelevantChunks(supabase, ragFileIds, message)
      : [];

    const contextLines: string[] = [];
    contextLines.push("You are a file analysis assistant for Trak.");
    contextLines.push("Use the provided file data to answer. If insufficient, say so.");
    contextLines.push("Return JSON with keys: text, tables (optional), charts (optional), notes (optional).");
    contextLines.push(`Current location scope: ${tabId ? "tab" : projectId ? "project" : "workspace"}`);
    if (projectId) {
      const safeProjectName = projectName ? sanitizePromptText(projectName) : "Unknown project";
      contextLines.push(`Current project: ${safeProjectName} (${projectId})`);
    }
    if (tabId) {
      const currentTabName = projectTabs.find((tab) => tab.id === tabId)?.name || "Unknown tab";
      contextLines.push(`Current tab: ${sanitizePromptText(currentTabName)} (${tabId})`);
    }
    if (projectTabs.length > 0) {
      const tabNames = projectTabs
        .map((tab) => sanitizePromptText(tab.name || "Untitled tab"))
        .filter(Boolean);
      contextLines.push(`Project tabs: ${tabNames.join(", ")}`);
    }

    contextLines.push("Available files:");
    fileRecords.forEach((file) => {
      const safeFileName = sanitizePromptText(file.file_name || "unknown");
      const safeFileType = sanitizePromptText(file.file_type || "unknown");
      contextLines.push(`- ${safeFileName} (${safeFileType}, ${Math.round(file.file_size / 1024)} KB)`);
    });

    contextLines.push("\nFile data:");
    for (const file of fileRecords) {
      const artifact = artifacts.get(file.id);
      if (!artifact) continue;
      const useRag = shouldUseRag({
        fileSize: file.file_size,
        tokenEstimate: artifact.token_estimate || 0,
        rowCount: artifact.row_count,
        pageCount: artifact.page_count,
      });
      if (useRag) {
        const fileChunks = retrievedChunks.filter((chunk) => chunk.file_id === file.id).slice(0, RETRIEVAL_TOP_K);
        const safeFileName = sanitizePromptText(file.file_name || "unknown");
        contextLines.push(`\n[FILE ${file.id}] ${safeFileName} (retrieved chunks):`);
        fileChunks.forEach((chunk) => {
          contextLines.push(`- ${sanitizePromptText(chunk.content)}`);
        });
      } else {
        const safeFileName = sanitizePromptText(file.file_name || "unknown");
        contextLines.push(`\n[FILE ${file.id}] ${safeFileName} (full extract):`);
        contextLines.push(sanitizePromptText(artifact.extracted_text || "(no text extracted)"));
        if (artifact.extracted_tables?.length) {
          contextLines.push("Tables:");
          artifact.extracted_tables.forEach((table: any) => {
            const safeTableName = sanitizePromptText(String(table.name || "Table"));
            const safeHeaders = (table.headers || []).map((header: any) =>
              sanitizePromptText(String(header ?? ""))
            );
            const safeRows = (table.rows || []).map((row: any[]) =>
              (row || []).map((cell: any) => sanitizePromptText(String(cell ?? "")))
            );
            contextLines.push(`Table: ${safeTableName}`);
            contextLines.push([safeHeaders.join("\t"), ...safeRows.map((row: string[]) => row.join("\t"))].join("\n"));
          });
        }
      }
    }

    // Load recent history
    const { data: history } = await supabase
      .from("file_analysis_messages")
      .select("role, content")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .limit(MAX_HISTORY_MESSAGES);

    const historyMessages = (history || [])
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: sanitizePromptText((m.content?.text as string) || ""),
      }))
      .filter((m) => m.content);

    const trimmedHistory = historyMessages.slice(0, -1);

    const messages = [
      { role: "system", content: contextLines.join("\n") },
      ...trimmedHistory,
      { role: "user", content: safeMessage },
    ];

    const rawResponse = await callDeepSeek(messages);
    const parsed = parseModelOutput(rawResponse);

    const citations: FileCitation[] = [];
    const citationInserts: Array<Record<string, any>> = [];
    if (retrievedChunks.length > 0) {
      retrievedChunks.forEach((chunk) => {
        const file = fileRecords.find((f) => f.id === chunk.file_id);
        const selected = selectedFiles.find((f) => f.id === chunk.file_id);
        if (!file) return;
        citations.push({
          id: "",
          file_id: file.id,
          file_name: file.file_name,
          chunk_id: chunk.id,
          excerpt: chunk.content.slice(0, 180),
          is_attached: selected?.is_attached || false,
        });
        citationInserts.push({
          file_id: file.id,
          chunk_id: chunk.id,
        });
      });
    } else {
      fileRecords.forEach((file) => {
        const selected = selectedFiles.find((f) => f.id === file.id);
        citations.push({
          id: "",
          file_id: file.id,
          file_name: file.file_name,
          is_attached: selected?.is_attached || false,
        });
        citationInserts.push({ file_id: file.id });
      });
    }

    if (citations.length === 0) {
      parsed.text = parsed.text ? `${parsed.text}\n\nNo files used.` : "No files used.";
    }

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
