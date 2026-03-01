"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Loader2, Send, Paperclip, ChevronDown, FileText, RotateCcw, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useQueryClient } from "@tanstack/react-query";
import { useAI } from "./ai-context";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import Toast from "@/app/dashboard/projects/toast";
import {
  addFileToAnalysisSession,
  clearFileAnalysisSession,
  getFileAnalysisSessionMessages,
  getOrCreateFileAnalysisSession,
  saveFileAnalysisAsBlock,
  saveFileAnalysisAsComment,
  getFileAnalysisContextFiles,
} from "@/app/actions/file-analysis";
import { convertFileAnalysisToWorkflowPage } from "@/app/actions/workflow-page";
import { createFileRecord } from "@/app/actions/file";
import { getOrCreateFilesSpace } from "@/app/actions/project";
import type { FileAnalysisMessage } from "@/lib/file-analysis/types";
import { formatBlockText } from "@/lib/format-block-text";
import type { UndoBatch } from "@/lib/ai/undo";
import type { WriteConfirmationApproval, WriteConfirmationRequest } from "@/lib/ai/write-confirmation";

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
}

interface SearchSource {
  source_id: string;
  chunk_content?: string;
  similarity?: number;
}

interface SearchResultItem {
  parentId: string;
  sourceId: string;
  sourceType: string;
  summary: string;
  chunks: Array<{ content: string; score: number }>;
  score: number;
}

interface SearchEntry {
  id: string;
  query: string;
  mode: "answer" | "search";
  status: "loading" | "done" | "error";
  answer?: string;
  sources?: SearchSource[];
  results?: SearchResultItem[];
  error?: string;
}

interface PendingWriteConfirmation extends WriteConfirmationRequest {
  originalCommand: string;
}

const isSearchLikeToolName = (name: string) =>
  name.startsWith("search") ||
  name.startsWith("get") ||
  name.startsWith("resolve") ||
  name === "requestToolGroups" ||
  name === "unstructuredSearchWorkspace" ||
  name === "fileAnalysisQuery" ||
  name === "reindexWorkspaceContent";

const hasSuccessfulWriteToolCall = (toolCallsMade: unknown) => {
  if (!Array.isArray(toolCallsMade)) return false;
  return toolCallsMade.some((call) => {
    if (!call || typeof call !== "object") return false;
    const typed = call as { tool?: string; result?: { success?: boolean } };
    if (!typed.tool || isSearchLikeToolName(typed.tool)) return false;
    return Boolean(typed.result?.success);
  });
};

function extractRoutingTags(raw: string): { mode: "default" | "chart" | "shopify"; cleaned: string; hadTag: boolean } {
  const hasChart = /(^|\s)@chart\b/i.test(raw);
  const hasShopify = /(^|\s)@shopify\b/i.test(raw);
  const cleaned = raw.replace(/(^|\s)@(chart|shopify)\b/gi, " ").replace(/\s+/g, " ").trimStart();
  if (hasChart) return { mode: "chart", cleaned, hadTag: true };
  if (hasShopify) return { mode: "shopify", cleaned, hadTag: true };
  return { mode: "default", cleaned: raw, hadTag: false };
}


export function AICommandPalette() {
  const {
    isOpen,
    closeCommandPalette,
    consumeQueuedFileIds,
    pendingFileIds,
    contextBlock,
  } = useAI();
  const { currentWorkspace } = useWorkspace();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FileAnalysisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"assistant" | "file" | "search">("assistant");
  const [assistantMessages, setAssistantMessages] = useState<Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    toolCalls?: Array<{ tool: string; result?: { success: boolean; error?: string } }>;
    undoBatches?: UndoBatch[];
  }>>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [undoingMessageId, setUndoingMessageId] = useState<string | null>(null);
  const [pendingWriteConfirmation, setPendingWriteConfirmation] = useState<PendingWriteConfirmation | null>(null);
  const [writeClarificationInput, setWriteClarificationInput] = useState("");
  const [contextFiles, setContextFiles] = useState<Array<{ id: string; file_name: string }>>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [searchMode, setSearchMode] = useState<"answer" | "search">("answer");
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [assistantRoutingMode, setAssistantRoutingMode] = useState<"default" | "chart" | "shopify">("default");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedModeRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);

  const pathMatch = useMemo(() => {
    // Match project ID anywhere after /dashboard/projects/
    const projectMatch = pathname.match(/\/dashboard\/projects\/([^/]+)/);

    // Match tab ID anywhere after /tabs/
    const tabMatch = pathname.match(/\/tabs\/([^/]+)/);
    // Workflow pages use /dashboard/workflow/[workflowPageId]
    const workflowMatch = pathname.match(/\/dashboard\/workflow\/([^/]+)/);

    return {
      projectId: projectMatch ? projectMatch[1] : null,
      tabId: tabMatch ? tabMatch[1] : workflowMatch ? workflowMatch[1] : null,
    };
  }, [pathname]);

  const workspaceId = currentWorkspace?.id || null;
  const routeScopeKey = useMemo(
    () =>
      `${workspaceId ?? "no-workspace"}:${pathMatch.projectId ?? "no-project"}:${pathMatch.tabId ?? "no-tab"}`,
    [workspaceId, pathMatch.projectId, pathMatch.tabId]
  );
  const activeRouteScopeKeyRef = useRef(routeScopeKey);
  const abortReasonRef = useRef<"user" | "scope-change" | null>(null);

  const loadSession = async () => {
    if (!workspaceId) return;
    setIsSyncing(true);
    const sessionResult = await getOrCreateFileAnalysisSession({
      workspaceId,
      projectId: pathMatch.projectId || undefined,
      tabId: pathMatch.tabId || undefined,
    });

    if ("error" in sessionResult) {
      setToast({ message: sessionResult.error, type: "error" });
      setIsSyncing(false);
      return;
    }

    setSessionId(sessionResult.data.id);

    const messagesResult = await getFileAnalysisSessionMessages(sessionResult.data.id);
    if ("data" in messagesResult) {
      setMessages(messagesResult.data as FileAnalysisMessage[]);
    }

    const filesResult = await getFileAnalysisContextFiles({
      sessionId: sessionResult.data.id,
      projectId: pathMatch.projectId || undefined,
      tabId: pathMatch.tabId || undefined,
      workspaceId,
    });

    if ("data" in filesResult) {
      setContextFiles(filesResult.data.map((file) => ({ id: file.id, file_name: file.file_name })));
    }

    const queued = consumeQueuedFileIds();
    if (queued.length > 0) {
      setMode("file");
      await Promise.all(
        queued.map((fileId) => addFileToAnalysisSession({
          sessionId: sessionResult.data.id,
          fileId,
          source: "attached",
        }))
      );
      await triggerUploadSummary(sessionResult.data.id, queued);
      const refreshed = await getFileAnalysisContextFiles({
        sessionId: sessionResult.data.id,
        projectId: pathMatch.projectId || undefined,
        tabId: pathMatch.tabId || undefined,
        workspaceId,
      });
      if ("data" in refreshed) {
        setContextFiles(refreshed.data.map((file) => ({ id: file.id, file_name: file.file_name })));
      }
    }

    setIsSyncing(false);
  };

  const refreshMessages = async (sessionId: string) => {
    const messagesResult = await getFileAnalysisSessionMessages(sessionId);
    if ("data" in messagesResult) {
      setMessages(messagesResult.data as FileAnalysisMessage[]);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      initializedModeRef.current = false;
      setPendingWriteConfirmation(null);
      setWriteClarificationInput("");
      return;
    }
    if (initializedModeRef.current) return;
    setMode(pendingFileIds.length > 0 ? "file" : "assistant");
    initializedModeRef.current = true;
  }, [isOpen, pendingFileIds.length]);

  useEffect(() => {
    if (!isOpen || mode !== "file") return;
    loadSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, workspaceId, pathMatch.projectId, pathMatch.tabId]);

  useEffect(() => {
    if (activeRouteScopeKeyRef.current === routeScopeKey) return;
    activeRouteScopeKeyRef.current = routeScopeKey;

    if (streamAbortRef.current) {
      abortReasonRef.current = "scope-change";
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }

    setSessionId(null);
    setMessages([]);
    setInput("");
    setAssistantMessages([]);
    setSearchEntries([]);
    setStreamingStatus(null);
    setStreamingResponse(null);
    setIsLoading(false);
    setAssistantLoading(false);
    setSearchLoading(false);
    setIsSyncing(false);
    setIsClearing(false);
    setPendingWriteConfirmation(null);
    setWriteClarificationInput("");
    setContextFiles([]);
    setShowMentions(false);
    setMentionQuery("");
    setMentionIndex(null);
    setIsDragging(false);
    setMode("assistant");
    closeCommandPalette();
  }, [routeScopeKey, closeCommandPalette]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading, isSyncing, assistantMessages, assistantLoading, searchEntries, searchLoading]);

  useEffect(() => {
    if (mode !== "file") {
      setShowMentions(false);
      setMentionQuery("");
      setMentionIndex(null);
      setIsDragging(false);
    }
    if (mode !== "assistant") {
      setAssistantRoutingMode("default");
      setPendingWriteConfirmation(null);
      setWriteClarificationInput("");
    }
  }, [mode]);

  const triggerUploadSummary = async (sessionId: string, fileIds: string[]) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      await fetch("/api/file-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          mode: "upload_summary",
          fileIds,
          tabId: pathMatch.tabId,
          projectId: pathMatch.projectId,
        }),
      });
      await refreshMessages(sessionId);
    } catch {
      setToast({ message: "Failed to summarize uploaded file", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const runAssistantCommand = async (params: {
    command: string;
    appendUserMessage?: boolean;
    confirmation?: WriteConfirmationApproval | null;
    routingMode?: "default" | "chart" | "shopify";
  }) => {
    const { command, appendUserMessage = true, confirmation, routingMode = "default" } = params;
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    abortReasonRef.current = null;

    const outboundHistory = assistantMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
    if (appendUserMessage) {
      const userMessage = { id: crypto.randomUUID(), role: "user" as const, content: trimmedCommand };
      setAssistantMessages((prev) => [...prev, userMessage]);
      outboundHistory.push({ role: "user", content: trimmedCommand });
    }

    setAssistantLoading(true);
    setStreamingStatus(null);
    setStreamingResponse(null);

    const controller = new AbortController();
    streamAbortRef.current = controller;
    try {
      const response = await fetch("/api/ai/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          command: trimmedCommand,
          routingMode,
          projectId: pathMatch.projectId,
          tabId: pathMatch.tabId,
          contextBlockId: contextBlock?.blockId,
          messages: outboundHistory.slice(-10).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          confirmation,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        setToast({ message: errorText || "Failed to run AI command", type: "error" });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setToast({ message: "Streaming not supported", type: "error" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResponse = "";
      let receivedConfirmation: PendingWriteConfirmation | null = null;
      const toolCalls: Array<{ tool: string; result?: { success: boolean; error?: string }; isWrite: boolean }> = [];
      let responseUndoBatches: UndoBatch[] = [];
      let didWrite = false;
      const markWrite = () => {
        didWrite = true;
        // Invalidate on every successful write so multi-step writes (e.g. createTableFull
        // then bulkInsertRows) each trigger a refetch and the UI shows the latest data.
        void queryClient.invalidateQueries();
        router.refresh();
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as {
              type:
                | "thinking"
                | "tool_call"
                | "tool_result"
                | "response_delta"
                | "response"
                | "confirmation_required"
                | "error"
                | "done";
              content?: string;
              data?: unknown;
            };

            switch (event.type) {
              case "thinking":
                setStreamingStatus(event.content || "Analyzing...");
                setStreamingResponse(null);
                break;
              case "tool_call":
                setStreamingStatus(event.content || "Working on it...");
                setStreamingResponse(null);
                if (event.data && typeof event.data === "object" && "tool" in event.data) {
                  const toolName = (event.data as { tool: string }).tool;
                  toolCalls.push({ tool: toolName, isWrite: !isSearchLikeToolName(toolName) });
                }
                break;
              case "tool_result":
                if (event.data && typeof event.data === "object" && "success" in event.data) {
                  const result = event.data as { success: boolean; error?: string };
                  if (toolCalls.length > 0) {
                    const lastCall = toolCalls[toolCalls.length - 1];
                    lastCall.result = result;
                    if (result.success && lastCall.isWrite) {
                      markWrite();
                    }
                  }
                }
                setStreamingStatus(null);
                break;
              case "response_delta":
                setStreamingStatus(null);
                setStreamingResponse((prev) => `${prev ?? ""}${event.content ?? ""}`);
                break;
              case "response":
                finalResponse = event.content || "";
                setStreamingStatus(null);
                setStreamingResponse(null);
                if (event.data && typeof event.data === "object") {
                  const payload = event.data as { toolCallsMade?: unknown; undoBatches?: unknown };
                  if (Array.isArray(payload.undoBatches)) {
                    responseUndoBatches = payload.undoBatches as UndoBatch[];
                  }
                  if ("toolCallsMade" in payload) {
                    const toolCallsMade = payload.toolCallsMade;
                    if (hasSuccessfulWriteToolCall(toolCallsMade)) {
                      markWrite();
                    }
                  }
                }
                break;
              case "confirmation_required":
                if (event.data && typeof event.data === "object") {
                  const payload = event.data as WriteConfirmationRequest;
                  if (typeof payload.tool === "string" && typeof payload.question === "string") {
                    receivedConfirmation = {
                      ...payload,
                      arguments: payload.arguments as Record<string, unknown>,
                      originalCommand: trimmedCommand,
                    };
                  }
                }
                setStreamingStatus(null);
                setStreamingResponse(null);
                break;
              case "error":
                setToast({ message: event.content || "An error occurred", type: "error" });
                setStreamingStatus(null);
                setStreamingResponse(null);
                return;
              case "done":
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (receivedConfirmation) {
        setPendingWriteConfirmation(receivedConfirmation);
        return;
      }

      setAssistantMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: finalResponse,
          toolCalls: toolCalls.length > 0
            ? toolCalls.map(({ tool, result }) => ({ tool, result }))
            : undefined,
          undoBatches: responseUndoBatches,
        },
      ]);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        if (abortReasonRef.current === "user") {
          setAssistantMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Stopped.",
            },
          ]);
        }
      } else {
        setToast({ message: "Failed to send message", type: "error" });
      }
    } finally {
      streamAbortRef.current = null;
      abortReasonRef.current = null;
      setAssistantLoading(false);
      setStreamingStatus(null);
      setStreamingResponse(null);
    }
  };

  const stopStreaming = () => {
    if (streamAbortRef.current) {
      abortReasonRef.current = "user";
      streamAbortRef.current.abort();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    if (mode === "file") {
      if (isLoading || !sessionId) return;
      const messageText = input.trim();
      setInput("");
      setIsLoading(true);

      try {
        await fetch("/api/file-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: messageText,
            tabId: pathMatch.tabId,
            projectId: pathMatch.projectId,
          }),
        });
        await refreshMessages(sessionId);
      } catch {
        setToast({ message: "Failed to send message", type: "error" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (mode === "search") {
      if (searchLoading) return;
      const messageText = input.trim();
      const entryId = crypto.randomUUID();
      setInput("");
      setSearchEntries((prev) => [
        ...prev,
        {
          id: entryId,
          query: messageText,
          mode: searchMode,
          status: "loading",
        },
      ]);

      if (!currentWorkspace?.id) {
        setSearchEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? { ...entry, status: "error", error: "No workspace selected. Please select a workspace first." }
              : entry
          )
        );
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch("/api/ai/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: messageText,
            mode: searchMode,
            workspaceId: currentWorkspace.id,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || "Search failed");
        }

        const data = await response.json();
        setSearchEntries((prev) =>
          prev.map((entry) => {
            if (entry.id !== entryId) return entry;
            if (searchMode === "answer") {
              return {
                ...entry,
                status: "done",
                answer: typeof data.answer === "string" ? data.answer : "",
                sources: Array.isArray(data.sources) ? data.sources : [],
              };
            }
            return {
              ...entry,
              status: "done",
              results: Array.isArray(data.results) ? data.results : [],
            };
          })
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search failed";
        setSearchEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId ? { ...entry, status: "error", error: message } : entry
          )
        );
      } finally {
        setSearchLoading(false);
      }
      return;
    }

    if (assistantLoading) return;
    const messageText = input.trim();
    const routingMode = assistantRoutingMode;

    setInput("");
    setAssistantRoutingMode("default");
    setPendingWriteConfirmation(null);
    setWriteClarificationInput("");
    await runAssistantCommand({
      command: messageText,
      appendUserMessage: true,
      confirmation: null,
      routingMode,
    });
  };

  const handleApprovePendingWrite = async () => {
    if (!pendingWriteConfirmation || assistantLoading) return;
    const pending = pendingWriteConfirmation;
    setPendingWriteConfirmation(null);
    setWriteClarificationInput("");

    const approval: WriteConfirmationApproval = {
      decision: "approve",
      request: {
        tool: pending.tool,
        arguments: pending.arguments,
      },
    };

    await runAssistantCommand({
      command: pending.originalCommand,
      appendUserMessage: false,
      confirmation: approval,
    });
  };

  const handleDenyPendingWrite = () => {
    if (!pendingWriteConfirmation || assistantLoading) return;
    setPendingWriteConfirmation(null);
    setWriteClarificationInput("");
    setAssistantMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Okay, I cancelled that update.",
      },
    ]);
  };

  const handleClarifyPendingWrite = async () => {
    if (!pendingWriteConfirmation || assistantLoading) return;
    const clarification = writeClarificationInput.trim();
    if (!clarification) {
      setToast({ message: "Add a clarification first.", type: "error" });
      return;
    }

    const pending = pendingWriteConfirmation;
    setPendingWriteConfirmation(null);
    setWriteClarificationInput("");

    await runAssistantCommand({
      command: `For my previous request "${pending.originalCommand}", use this clarification before any changes: ${clarification}`,
      appendUserMessage: true,
      confirmation: null,
    });
  };

  const handleConvertToWorkflowPage = async (messageId: string) => {
    if (!sessionId) return;
    setIsLoading(true);
    try {
      const result = await convertFileAnalysisToWorkflowPage({
        fileAnalysisSessionId: sessionId,
        messageId,
        title: "Workflow Page",
      });

      if ("error" in result) {
        setToast({ message: result.error, type: "error" });
        return;
      }

      closeCommandPalette();
      router.push(`/dashboard/workflow/${result.data.tabId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to convert to workflow page";
      setToast({ message, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList || !workspaceId) return;
    if (!sessionId) {
      setToast({ message: "Open the chat before uploading files", type: "error" });
      return;
    }

    const files = Array.from(fileList);
    const supabase = createClient();

    let targetProjectId = pathMatch.projectId;
    if (!targetProjectId) {
      const filesSpace = await getOrCreateFilesSpace(workspaceId);
      if ("error" in filesSpace) {
        setToast({ message: filesSpace.error ?? "Failed to get files space", type: "error" });
        return;
      }
      targetProjectId = filesSpace.data.id;
    }

    if (!targetProjectId) {
      setToast({ message: "No project ID available", type: "error" });
      return;
    }

    const uploads: UploadingFile[] = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      progress: 0,
      status: "uploading",
    }));
    setUploadingFiles((prev) => [...prev, ...uploads]);

    const uploadedIds: string[] = [];

    for (let i = 0; i < uploads.length; i += 1) {
      const file = files[i];
      const fileId = uploads[i].id;
      const fileExtension = file.name.split(".").pop() || "";
      const storagePath = `${workspaceId}/${targetProjectId}/${fileId}.${fileExtension}`;

      try {
        await supabase.storage.from("files").upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

        const createResult = await createFileRecord({
          fileId,
          workspaceId,
          projectId: targetProjectId,
          blockId: "",
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          storagePath,
        });

        if ("error" in createResult) {
          throw new Error(createResult.error);
        }

        await addFileToAnalysisSession({
          sessionId,
          fileId,
          source: "upload",
        });

        uploadedIds.push(fileId);
        setContextFiles((prev) => [...prev, { id: fileId, file_name: file.name }]);
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId ? { ...item, progress: 100, status: "success" } : item
          )
        );
      } catch {
        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === fileId ? { ...item, status: "error", error: "Upload failed" } : item
          )
        );
      }
    }

    if (uploadedIds.length > 0) {
      await triggerUploadSummary(sessionId, uploadedIds);
    }

    setUploadingFiles((prev) => prev.filter((file) => file.status === "uploading"));
  };

  const handleDragOver = (event: React.DragEvent) => {
    if (mode !== "file") return;
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    if (mode !== "file") return;
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    if (mode !== "file") return;
    event.preventDefault();
    setIsDragging(false);
    if (event.dataTransfer?.files?.length) {
      handleFileUpload(event.dataTransfer.files);
    }
  };

  const handleMentionInput = (value: string) => {
    if (mode === "assistant") {
      const parsed = extractRoutingTags(value);
      if (parsed.hadTag) {
        setAssistantRoutingMode(parsed.mode);
      }
      setInput(parsed.cleaned);
      return;
    }
    if (mode !== "file") {
      setInput(value);
      return;
    }
    setInput(value);
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0) {
      const isValidTrigger = lastAt === 0 || /\s/.test(value[lastAt - 1]);
      if (!isValidTrigger) {
        setShowMentions(false);
        setMentionQuery("");
        setMentionIndex(null);
        return;
      }
      const query = value.slice(lastAt + 1).split(/\s/)[0];
      if (query.length >= 0) {
        setMentionIndex(lastAt);
        setMentionQuery(query);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery("");
    setMentionIndex(null);
  };

  const mentionSuggestions = useMemo(() => {
    if (!showMentions) return [];
    return contextFiles
      .filter((file) => file.file_name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .slice(0, 6);
  }, [showMentions, contextFiles, mentionQuery]);

  const handleSelectMention = async (fileId: string, fileName: string) => {
    if (mode !== "file") return;
    if (mentionIndex === null) return;
    const prefix = input.slice(0, mentionIndex + 1);
    const suffix = input.slice(mentionIndex + 1 + mentionQuery.length);
    const nextValue = `${prefix}${fileName} ${suffix}`;
    setInput(nextValue);
    setShowMentions(false);
    setMentionQuery("");
    setMentionIndex(null);

    if (sessionId) {
      await addFileToAnalysisSession({ sessionId, fileId, source: "mention" });
      await refreshMessages(sessionId);
    }
  };

  const resolveActions = (message: FileAnalysisMessage) => {
    if (message.actions && message.actions.length > 0) return message.actions;
    if (message.role !== "assistant") return [];
    const actions: Array<{ type: "save_block" | "save_comment"; label: string; fileIds?: string[] }> = [];
    if (pathMatch.tabId) {
      actions.push({ type: "save_block", label: "Save as Block" });
    }
    const attached = (message.citations || []).filter((citation) => citation.is_attached);
    const uniqueAttached = new Map<string, string>();
    attached.forEach((citation) => {
      if (!uniqueAttached.has(citation.file_id)) {
        uniqueAttached.set(citation.file_id, citation.file_name);
      }
    });
    uniqueAttached.forEach((fileName, fileId) => {
      actions.push({
        type: "save_comment",
        label: `Save as Comment on ${fileName}`,
        fileIds: [fileId],
      });
    });
    return actions;
  };

  const handleAction = async (action: { type: string; fileIds?: string[] }, messageId: string) => {
    if (!sessionId) return;
    if (action.type === "save_block" && pathMatch.tabId) {
      const result = await saveFileAnalysisAsBlock({ messageId, tabId: pathMatch.tabId });
      if ("error" in result) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      setToast({ message: "Saved to page", type: "success" });
      return;
    }

    if (action.type === "save_comment" && action.fileIds?.[0]) {
      const result = await saveFileAnalysisAsComment({ messageId, fileId: action.fileIds[0] });
      if ("error" in result) {
        setToast({ message: result.error, type: "error" });
        return;
      }
      window.dispatchEvent(
        new CustomEvent("file-analysis-comment-saved", {
          detail: { fileId: action.fileIds[0] },
        })
      );
      setToast({ message: "Comment saved on file", type: "success" });
    }
  };

  const handleClarificationSelect = async (option: string) => {
    setInput(option);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleClearChat = async () => {
    if (mode === "assistant") {
      setAssistantMessages([]);
      setInput("");
      return;
    }
    if (mode === "search") {
      setSearchEntries([]);
      setInput("");
      return;
    }
    if (!sessionId || isClearing) return;
    const confirmed = window.confirm("Clear this chat? This cannot be undone.");
    if (!confirmed) return;
    setIsClearing(true);
    const result = await clearFileAnalysisSession({ sessionId });
    if ("error" in result) {
      setToast({ message: result.error, type: "error" });
      setIsClearing(false);
      return;
    }
    setMessages([]);
    setInput("");
    if (!workspaceId) {
      setIsClearing(false);
      return;
    }
    const refreshed = await getFileAnalysisContextFiles({
      sessionId,
      projectId: pathMatch.projectId || undefined,
      tabId: pathMatch.tabId || undefined,
      workspaceId,
    });
    if ("data" in refreshed) {
      setContextFiles(refreshed.data.map((file) => ({ id: file.id, file_name: file.file_name })));
    }
    setIsClearing(false);
  };

  const handleUndo = async (messageId: string, batches: UndoBatch[]) => {
    if (!currentWorkspace?.id) {
      setToast({ message: "No workspace selected.", type: "error" });
      return;
    }
    if (!Array.isArray(batches) || batches.length === 0) {
      setToast({ message: "Nothing to undo.", type: "error" });
      return;
    }
    if (undoingMessageId) return;
    setUndoingMessageId(messageId);
    try {
      const response = await fetch("/api/ai/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: currentWorkspace.id,
          batches,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Undo failed");
      }
      setAssistantMessages((prev) =>
        prev.map((message) =>
          message.id === messageId ? { ...message, undoBatches: [] } : message
        )
      );
      setToast({ message: "Undid the AI changes.", type: "success" });
      void queryClient.invalidateQueries();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Undo failed";
      setToast({ message, type: "error" });
    } finally {
      setUndoingMessageId(null);
    }
  };

  const modePillClass = (active: boolean, compact = false) =>
    cn(
      compact ? "rounded-md px-2 py-0.5 text-[11px] transition-colors" : "rounded-md px-2.5 py-1 text-xs transition-colors",
      active
        ? "border border-[var(--border)] bg-[var(--surface-hover)] text-[var(--foreground)] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
        : "border border-transparent text-[var(--muted-foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
    );
  const isClearChatDisabled =
    (mode === "file" && (isClearing || isSyncing)) ||
    (mode === "assistant" && assistantLoading) ||
    (mode === "search" && searchLoading);

  if (!isOpen) return null;

  return (
    <aside
      className={cn(
        "relative z-40 h-full w-full max-w-[480px] min-w-[360px] border-l border-[var(--border)] bg-[var(--background)]/95 shadow-[0_6px_24px_rgba(0,0,0,0.08)] backdrop-blur-sm flex flex-col",
        isDragging && "ring-2 ring-[var(--primary)]/40"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/95">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">
                {mode === "file" ? "File Analysis" : mode === "search" ? "Workspace Search" : "AI Assistant"}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {mode === "file"
                  ? "Ask questions about your files"
                  : mode === "search"
                    ? "Unstructured RAG across your workspace"
                    : "Prompt to actions and answers"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("assistant")}
                className={modePillClass(mode === "assistant")}
              >
                AI Assistant
              </button>
              <button
                type="button"
                onClick={() => setMode("file")}
                className={modePillClass(mode === "file")}
              >
                File Analysis
              </button>
              <button
                type="button"
                onClick={() => setMode("search")}
                className={modePillClass(mode === "search")}
              >
                Search
              </button>
            </div>
            <button
              onClick={closeCommandPalette}
              className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--tertiary-foreground)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Context bar */}
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--muted-foreground)] flex items-center justify-between">
          {mode === "file" ? (
            <>
              <span>
                {pathMatch.tabId ? "Tab context" : pathMatch.projectId ? "Project context" : "Workspace context"}
              </span>
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {contextFiles.length} files
              </span>
            </>
          ) : mode === "search" ? (
            <>
              <span className="truncate">
                {currentWorkspace?.name ? `${currentWorkspace.name} workspace` : "Workspace search"}
              </span>
              <span className="flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSearchMode("answer")}
                  className={modePillClass(searchMode === "answer", true)}
                >
                  Answer
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("search")}
                  className={modePillClass(searchMode === "search", true)}
                >
                  Search
                </button>
              </span>
            </>
          ) : (
            <span className="truncate">
              {contextBlock ? `Context: ${contextBlock.label}` : "No block context selected"}
            </span>
          )}
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-[var(--background)]/40 px-4 py-4 space-y-4">
          {mode === "file" ? (
            messages.map((message) => {
              const isUser = message.role === "user";
              const actions = resolveActions(message);
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg border px-3 py-2 text-sm space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                      isUser
                        ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                    )}
                  >
                    {message.content?.text && (
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: formatBlockText(message.content.text) }}
                      />
                    )}

                    {message.content?.clarification && (
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--muted-foreground)]">{message.content.clarification.question}</p>
                        <div className="flex flex-wrap gap-2">
                          {message.content.clarification.options.map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleClarificationSelect(option)}
                              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.content?.tables?.map((table, idx) => {
                      const columns =
                        (table.columns && table.columns.length > 0)
                          ? table.columns
                          : (table.headers && table.headers.length > 0)
                            ? table.headers
                            : [];
                      return (
                        <div key={idx} className="overflow-x-auto">
                          {table.title && <div className="text-xs font-semibold mb-1">{table.title}</div>}
                          {columns.length > 0 && (
                            <table className="min-w-full text-xs border border-[var(--border)]">
                              <thead>
                                <tr>
                                  {columns.map((col) => (
                                    <th key={col} className="px-2 py-1 border-b border-[var(--border)] text-left">
                                      {col}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row, rowIndex) => (
                                  <tr key={rowIndex}>
                                    {row.map((cell, cellIndex) => (
                                      <td key={cellIndex} className="px-2 py-1 border-b border-[var(--border)]">
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )
                    })}

                    {message.content?.notes && (
                      <div
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ __html: formatBlockText(message.content.notes) }}
                      />
                    )}

                    {message.content?.charts?.map((chart, idx) => (
                      <div key={idx} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs">
                        <div className="font-semibold mb-1">{chart.title || "Chart"}</div>
                        <div className="text-[var(--muted-foreground)] mb-1">Type: {chart.type}</div>
                        {chart.series?.map((series) => (
                          <div key={series.name} className="text-[var(--foreground)]">
                            {series.name}: {series.data.join(", ")}
                          </div>
                        ))}
                      </div>
                    ))}

                    {message.role === "assistant" && (
                      <div className="text-[11px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
                        Used: {message.citations && message.citations.length > 0
                          ? message.citations.map((citation) => citation.file_name).join(", ")
                          : "No files used"}
                      </div>
                    )}

                    {message.role === "assistant" && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleConvertToWorkflowPage(message.id)}
                          className="text-[11px] text-[var(--primary)] hover:underline"
                        >
                          Continue in a workflow page
                        </button>
                      </div>
                    )}

                    {message.role === "assistant" && actions.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {actions.map((action, actionIndex) => (
                          <button
                            key={`${message.id}-${action.type}-${action.fileIds?.join("-") || "none"}-${actionIndex}`}
                            type="button"
                            onClick={() => handleAction(action, message.id)}
                            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : mode === "assistant" ? (
            assistantMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg border px-3 py-2 text-sm space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                      isUser
                        ? "border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                    )}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <div className="prose prose-sm max-w-none text-[var(--foreground)]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                    {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="text-[11px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)] space-y-1">
                        {message.toolCalls.map((call, index) => (
                          <div key={`${message.id}-tool-${index}`}>
                            {call.tool}: {call.result?.success ? "Done" : call.result?.error || "Failed"}
                          </div>
                        ))}
                      </div>
                    )}
                    {message.role === "assistant" && message.undoBatches && message.undoBatches.length > 0 && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => handleUndo(message.id, message.undoBatches || [])}
                          disabled={undoingMessageId === message.id}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                            "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)]",
                            undoingMessageId === message.id && "opacity-60"
                          )}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Undo AI changes
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            searchEntries.map((entry) => {
              const formatPreview = (text?: string) => {
                if (!text || !text.trim()) return "";
                return formatBlockText(text, { preset: "compact" });
              };
              return (
                <React.Fragment key={entry.id}>
                  <div className="flex justify-end">
                    <div className="max-w-[90%] rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-3 py-2 text-sm text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                      <p className="whitespace-pre-wrap">{entry.query}</p>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-3">
                      {entry.status === "loading" && (
                        <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>{entry.mode === "answer" ? "Searching for an answer..." : "Searching workspace..."}</span>
                        </div>
                      )}

                      {entry.status === "error" && (
                        <div className="text-[var(--error)] text-sm">{entry.error || "Search failed"}</div>
                      )}

                      {entry.status === "done" && entry.mode === "answer" && (
                        <>
                          {entry.answer ? (
                            <div className="prose prose-sm max-w-none text-[var(--foreground)]">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {entry.answer}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="text-[var(--muted-foreground)]">No answer returned.</div>
                          )}

                          {entry.sources && entry.sources.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                                Sources
                              </div>
                              {entry.sources.map((source, index) => {
                                const previewHtml = formatPreview(source.chunk_content);
                                return (
                                  <div key={`${entry.id}-source-${index}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-medium text-[var(--foreground)] flex items-center gap-2">
                                        <FileText className="h-3 w-3 text-[var(--muted-foreground)]" />
                                        {source.source_id}
                                      </div>
                                      {typeof source.similarity === "number" && (
                                        <div className="text-[10px] text-[var(--muted-foreground)]">
                                          Score: {Math.round(source.similarity * 100)}%
                                        </div>
                                      )}
                                    </div>
                                    {previewHtml && (
                                      <div
                                        className="mt-1 text-[var(--muted-foreground)] line-clamp-3"
                                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {entry.status === "done" && entry.mode === "search" && (
                        <div className="space-y-2">
                          {entry.results && entry.results.length > 0 ? (
                            entry.results.map((result, index) => {
                              const previewHtml = formatPreview(result.chunks?.[0]?.content || result.summary);
                              return (
                                <div key={`${entry.id}-result-${index}`} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium text-[var(--foreground)]">
                                      {result.sourceType} · {result.sourceId}
                                    </div>
                                    <div className="text-[10px] text-[var(--muted-foreground)]">
                                      Score: {Math.round(result.score * 100)}%
                                    </div>
                                  </div>
                                  {previewHtml && (
                                    <div
                                      className="mt-1 text-[var(--muted-foreground)] line-clamp-3"
                                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                                    />
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-[var(--muted-foreground)]">No results found.</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}

          {mode === "assistant" && pendingWriteConfirmation && !assistantLoading && (
            <div className="flex justify-start">
              <div className="max-w-[90%] rounded-lg px-3 py-3 text-sm space-y-3 bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)]">
                <p className="whitespace-pre-wrap">{pendingWriteConfirmation.question}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleApprovePendingWrite}
                    className="rounded-md border border-[var(--secondary)] bg-[var(--secondary)] px-3 py-1 text-xs text-white hover:bg-[var(--secondary)]/90"
                  >
                    Yes, continue
                  </button>
                  <button
                    type="button"
                    onClick={handleDenyPendingWrite}
                    className="rounded-md border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--surface-hover)]"
                  >
                    No, cancel
                  </button>
                </div>
                <div className="space-y-2 border-t border-[var(--border)] pt-2">
                  <label className="block text-[11px] text-[var(--muted-foreground)]">
                    Clarify before I update
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={writeClarificationInput}
                      onChange={(event) => setWriteClarificationInput(event.target.value)}
                      placeholder="Type clarification..."
                      className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-xs outline-none focus:border-[var(--secondary)]"
                    />
                    <button
                      type="button"
                      onClick={handleClarifyPendingWrite}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:bg-[var(--surface-hover)]"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "file" && isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[var(--muted-foreground)]">Thinking...</span>
              </div>
            </div>
          )}

          {mode === "file" && isSyncing && (
            <div className="text-xs text-[var(--muted-foreground)]">Loading session...</div>
          )}

          {mode === "assistant" && assistantLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-[var(--muted)] px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[var(--muted-foreground)]">
                  {streamingResponse || streamingStatus || "Thinking..."}
                </span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-[var(--border)] bg-[var(--surface)]/95 p-4 space-y-2">
          <div className="flex items-center gap-2">
            {mode === "file" && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-[var(--border)] px-2 py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Upload files"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            )}
            <div className="flex-1">
              {mode === "assistant" && assistantRoutingMode !== "default" && (
                <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--foreground)]">
                  <span>{assistantRoutingMode === "chart" ? "@chart" : "@shopify"}</span>
                  <button
                    type="button"
                    onClick={() => setAssistantRoutingMode("default")}
                    className="rounded-full p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                    aria-label={`Remove @${assistantRoutingMode} tag`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => handleMentionInput(e.target.value)}
                placeholder={
                  mode === "file"
                    ? "Ask about your files..."
                    : mode === "search"
                      ? "Search your workspace..."
                      : "Ask anything or give a command..."
                }
                className={cn(
                  "w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                  "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                )}
              />
            </div>
            {mode === "assistant" && assistantLoading ? (
              <button
                type="button"
                onClick={stopStreaming}
                className={cn(
                  "rounded-md border border-[var(--destructive)]/60 bg-[var(--destructive)]/10 px-3 py-2 text-xs text-[var(--destructive)]",
                  "hover:bg-[var(--destructive)]/20"
                )}
                title="Stop"
              >
                <Square className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  !input.trim() ||
                  (mode === "file"
                    ? isLoading || !sessionId
                    : mode === "assistant"
                      ? assistantLoading
                      : searchLoading)
                }
                className={cn(
                  "rounded-md bg-[var(--primary)] px-3 py-2 text-xs text-[var(--primary-foreground)]",
                  "disabled:opacity-50"
                )}
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleClearChat}
            disabled={isClearChatDisabled}
            className={cn(
              "text-[11px] underline underline-offset-2 text-[var(--muted-foreground)] transition-colors",
              "hover:text-[var(--foreground)] disabled:opacity-50 disabled:no-underline"
            )}
          >
            Clear Chat
          </button>

          {mode === "file" && showMentions && mentionSuggestions.length > 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs shadow-lg">
              {mentionSuggestions.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => handleSelectMention(file.id, file.file_name)}
                  className="flex w-full items-center justify-between px-3 py-2 hover:bg-[var(--surface-hover)]"
                >
                  <span>@{file.file_name}</span>
                  <ChevronDown className="h-3 w-3 text-[var(--muted-foreground)]" />
                </button>
              ))}
            </div>
          )}

          {mode === "file" && uploadingFiles.length > 0 && (
            <div className="space-y-1 text-xs text-[var(--muted-foreground)]">
              {uploadingFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between">
                  <span className="truncate">{file.name}</span>
                  <span>{file.status === "error" ? "Error" : "Uploading"}</span>
                </div>
              ))}
            </div>
          )}
        </form>

        {mode === "file" && (
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
        )}

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </aside>
  );
}
