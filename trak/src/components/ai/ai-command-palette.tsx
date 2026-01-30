"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Loader2, Send, Paperclip, ChevronDown, Trash2 } from "lucide-react";
import { useAI } from "./ai-context";
import { useWorkspace } from "@/app/dashboard/workspace-context";
import { usePathname } from "next/navigation";
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
import { createFileRecord } from "@/app/actions/file";
import { getOrCreateFilesSpace } from "@/app/actions/project";
import type { FileAnalysisMessage } from "@/lib/file-analysis/types";
import type { AIMessage } from "@/lib/ai";

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "success" | "error";
  error?: string;
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

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FileAnalysisMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"assistant" | "file">("assistant");
  const [assistantMessages, setAssistantMessages] = useState<Array<{ id: string; role: "user" | "assistant"; content: string; toolCalls?: Array<{ tool: string; result?: { success: boolean; error?: string } }> }>>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [contextFiles, setContextFiles] = useState<Array<{ id: string; file_name: string }>>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedModeRef = useRef(false);

  const pathMatch = useMemo(() => {
    const match = pathname.match(/\/dashboard\/projects\/([^/]+)\/tabs\/([^/]+)/);
    return match ? { projectId: match[1], tabId: match[2] } : { projectId: null, tabId: null };
  }, [pathname]);

  const workspaceId = currentWorkspace?.id || null;

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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, isSyncing, assistantMessages, assistantLoading]);

  useEffect(() => {
    if (mode === "file") return;
    setShowMentions(false);
    setMentionQuery("");
    setMentionIndex(null);
    setIsDragging(false);
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
    } catch (error) {
      setToast({ message: "Failed to summarize uploaded file", type: "error" });
    } finally {
      setIsLoading(false);
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
      } catch (error) {
        setToast({ message: "Failed to send message", type: "error" });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (assistantLoading) return;
    const messageText = input.trim();
    setInput("");
    const userMessage = { id: crypto.randomUUID(), role: "user" as const, content: messageText };
    setAssistantMessages((prev) => [...prev, userMessage]);
    setAssistantLoading(true);

    try {
      const history: AIMessage[] = [
        ...assistantMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        { role: "user", content: messageText },
      ];
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: messageText,
          conversationHistory: history,
          contextBlockId: contextBlock?.blockId || null,
        }),
      });
      const result = await response.json();
      if (!result?.success) {
        setToast({ message: result?.error || "Failed to run AI command", type: "error" });
        return;
      }
      setAssistantMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.response || "",
          toolCalls: result.toolCallsMade || [],
        },
      ]);
    } catch (error) {
      setToast({ message: "Failed to send message", type: "error" });
    } finally {
      setAssistantLoading(false);
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
        setToast({ message: filesSpace.error, type: "error" });
        return;
      }
      targetProjectId = filesSpace.data.id;
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
      } catch (error) {
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
    if (mode !== "file") {
      setAssistantMessages([]);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/20" onClick={closeCommandPalette} />

      {/* Sidebar */}
      <div
        className={cn(
          "relative h-full w-full max-w-[480px] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col",
          isDragging && "ring-2 ring-[var(--primary)]/40"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-[var(--primary)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--foreground)]">
                {mode === "file" ? "File Analysis" : "AI Assistant"}
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                {mode === "file" ? "Ask questions about your files" : "Prompt to actions and answers"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border border-[var(--border)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMode("assistant")}
                className={cn(
                  "rounded-full px-2 py-0.5 transition-colors",
                  mode === "assistant"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                Ask AI
              </button>
              <button
                type="button"
                onClick={() => setMode("file")}
                className={cn(
                  "rounded-full px-2 py-0.5 transition-colors",
                  mode === "file"
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                )}
              >
                File Analysis
              </button>
            </div>
            <button
              onClick={handleClearChat}
              className="p-2 rounded hover:bg-[var(--surface-hover)] transition-colors"
              title={mode === "file" ? "Clear chat" : "Clear conversation"}
              disabled={(mode === "file" && (isClearing || isSyncing)) || assistantLoading}
            >
              <Trash2 className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
            <button
              onClick={closeCommandPalette}
              className="p-2 rounded hover:bg-[var(--surface-hover)] transition-colors"
              title="Close"
            >
              <X className="h-4 w-4 text-[var(--muted-foreground)]" />
            </button>
          </div>
        </div>

        {/* Context bar */}
        <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--muted-foreground)] flex items-center justify-between">
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
          ) : (
            <span className="truncate">
              {contextBlock ? `Context: ${contextBlock.label}` : "No block context selected"}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {mode === "file" ? (
            messages.map((message) => {
              const isUser = message.role === "user";
              const actions = resolveActions(message);
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg px-3 py-2 text-sm space-y-2",
                      isUser
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[var(--muted)] text-[var(--foreground)]"
                    )}
                  >
                    {message.content?.text && (
                      <p className="whitespace-pre-wrap">{message.content.text}</p>
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

                    {message.content?.tables?.map((table, idx) => (
                      <div key={idx} className="overflow-x-auto">
                        {table.title && <div className="text-xs font-semibold mb-1">{table.title}</div>}
                        <table className="min-w-full text-xs border border-[var(--border)]">
                          <thead>
                            <tr>
                              {table.columns.map((col) => (
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
                      </div>
                    ))}

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
          ) : (
            assistantMessages.map((message) => {
              const isUser = message.role === "user";
              return (
                <div key={message.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[90%] rounded-lg px-3 py-2 text-sm space-y-2",
                      isUser
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                        : "bg-[var(--muted)] text-[var(--foreground)]"
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
                      <div className="text-[11px] text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)] space-y-1">
                        {message.toolCalls.map((call, index) => (
                          <div key={`${message.id}-tool-${index}`}>
                            {call.tool}: {call.result?.success ? "Done" : call.result?.error || "Failed"}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
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
                <span className="text-[var(--muted-foreground)]">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-[var(--border)] p-4 space-y-2">
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
              <textarea
                ref={inputRef}
                rows={2}
                value={input}
                onChange={(e) => handleMentionInput(e.target.value)}
                placeholder={mode === "file" ? "Ask about your files..." : "Ask anything or give a command..."}
                className={cn(
                  "w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--muted)]/40 px-3 py-2 text-sm",
                  "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                )}
              />
            </div>
            <button
              type="submit"
              disabled={
                !input.trim() ||
                (mode === "file" ? isLoading || !sessionId : assistantLoading)
              }
              className={cn(
                "rounded-md bg-[var(--primary)] px-3 py-2 text-xs text-[var(--primary-foreground)]",
                "disabled:opacity-50"
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

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
      </div>
    </div>
  );
}
