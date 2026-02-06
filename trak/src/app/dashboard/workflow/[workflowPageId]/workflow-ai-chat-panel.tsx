"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBlockText } from "@/lib/format-block-text";
import Toast from "@/app/dashboard/projects/toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/react-query/query-client";
import type { UndoBatch } from "@/lib/ai/undo";

type WorkflowMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: Record<string, unknown>;
  created_at: string;
  created_block_ids?: string[];
};

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

function getText(content: Record<string, unknown> | null | undefined) {
  const raw = content?.text;
  if (typeof raw === "string") return raw;
  return "";
}

export default function WorkflowAIChatPanel(props: { tabId: string; workspaceId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkflowMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string | null>(null);
  const [streamingResponse, setStreamingResponse] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [undoingMessageId, setUndoingMessageId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  const renderedMessages = useMemo(() => {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => {
        const batches = Array.isArray((m.content as Record<string, unknown>)?.undoBatches)
          ? ((m.content as Record<string, unknown>).undoBatches as UndoBatch[])
          : [];
        return {
          ...m,
          html: formatBlockText(getText(m.content)),
          undoBatches: batches,
        };
      });
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [renderedMessages, loading]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/workflow/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: props.tabId }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to load workflow session");
      }
      setSessionId(json.sessionId);
      setMessages(Array.isArray(json.messages) ? (json.messages as WorkflowMessage[]) : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load workflow chat";
      setToast({ message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tabId]);

  const sendCommand = async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: { text: trimmed },
        created_at: new Date().toISOString(),
        created_block_ids: [],
      },
    ]);

    setLoading(true);
    setStreamingStatus(null);
    setStreamingResponse(null);
    try {
      const res = await fetch("/api/workflow/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: props.tabId, command: trimmed }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to execute workflow command");
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("Streaming not supported");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let finalResponse = "";
      let responseUndoBatches: UndoBatch[] = [];
      let responseUndoSkippedTools: string[] = [];
      let responseToolCallsMade: unknown = null;
      let responseCreatedBlockIds: string[] = [];
      let responseSessionId: string | null = null;
      let didWrite = false;
      const markWrite = () => {
        if (!didWrite) {
          didWrite = true;
          // Invalidate tabBlocks cache specifically to ensure new blocks appear
          void queryClient.invalidateQueries({ queryKey: queryKeys.tabBlocks(props.tabId) });
          // Also invalidate all queries as a fallback
          void queryClient.invalidateQueries();
          // Refresh the router to ensure Next.js cache is also updated
          router.refresh();
        }
      };

      const toolCalls: Array<{ tool: string; result?: { success: boolean; error?: string }; isWrite: boolean }> = [];

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
                  const payload = event.data as {
                    toolCallsMade?: unknown;
                    undoBatches?: unknown;
                    undoSkippedTools?: unknown;
                    createdBlockIds?: unknown;
                    sessionId?: unknown;
                  };
                  responseToolCallsMade = payload.toolCallsMade ?? null;
                  if (Array.isArray(payload.undoBatches)) {
                    responseUndoBatches = payload.undoBatches as UndoBatch[];
                  }
                  if (Array.isArray(payload.undoSkippedTools)) {
                    responseUndoSkippedTools = payload.undoSkippedTools as string[];
                  }
                  if (Array.isArray(payload.createdBlockIds)) {
                    responseCreatedBlockIds = payload.createdBlockIds as string[];
                  }
                  if (typeof payload.sessionId === "string") {
                    responseSessionId = payload.sessionId;
                  }
                  if (hasSuccessfulWriteToolCall(payload.toolCallsMade)) {
                    markWrite();
                  }
                }
                break;
              case "error":
                throw new Error(event.content || "An error occurred");
              case "done":
                break;
            }
          } catch (eventError) {
            if (eventError instanceof Error) {
              throw eventError;
            }
          }
        }
      }

      setSessionId(responseSessionId || sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: {
            text: finalResponse,
            toolCallsMade: responseToolCallsMade,
            undoBatches: responseUndoBatches,
            undoSkippedTools: responseUndoSkippedTools,
          },
          created_at: new Date().toISOString(),
          created_block_ids: responseCreatedBlockIds,
        },
      ]);

      if (responseCreatedBlockIds.length > 0) {
        // Invalidate tabBlocks cache specifically to ensure new blocks appear
        void queryClient.invalidateQueries({ queryKey: queryKeys.tabBlocks(props.tabId) });
        // Also invalidate all queries as a fallback
        void queryClient.invalidateQueries();
        // Refresh the router to ensure Next.js cache is also updated
        router.refresh();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to run workflow AI";
      setToast({ message, type: "error" });
    } finally {
      setLoading(false);
      setStreamingStatus(null);
      setStreamingResponse(null);
    }
  };

  const handleUndo = async (messageId: string, batches: UndoBatch[]) => {
    if (!props.workspaceId) {
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
          workspaceId: props.workspaceId,
          batches,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.success) {
        throw new Error(json?.error || "Undo failed");
      }
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? { ...message, content: { ...message.content, undoBatches: [] } }
            : message
        )
      );
      setToast({ message: "Undid the AI changes.", type: "success" });
      // Invalidate tabBlocks cache specifically
      void queryClient.invalidateQueries({ queryKey: queryKeys.tabBlocks(props.tabId) });
      // Also invalidate all queries as a fallback
      void queryClient.invalidateQueries();
      // Refresh the router
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Undo failed";
      setToast({ message, type: "error" });
    } finally {
      setUndoingMessageId(null);
    }
  };

  const send = async () => {
    const command = input.trim();
    if (!command || loading) return;
    setInput("");
    await sendCommand(command);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `trak-workflow-autorun:${props.tabId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const parsed = JSON.parse(raw) as { command?: string };
      if (parsed?.command) {
        void sendCommand(parsed.command);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tabId]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface)] text-[var(--foreground)] border-l border-[var(--border)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <div className="text-sm font-semibold">AI</div>
        {sessionId ? (
          <div className="text-[11px] text-[var(--muted-foreground)]">Session {sessionId.slice(0, 8)}</div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 space-y-3">
        {renderedMessages.length === 0 && !loading && (
          <div className="rounded-md border border-[var(--border)] bg-[var(--secondary)]/5 p-3 text-xs text-[var(--muted-foreground)]">
            Ask a question and I’ll build this page with blocks.
          </div>
        )}

        {renderedMessages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "rounded-md border p-3 text-sm",
              m.role === "user"
                ? "border-[var(--secondary)]/30 bg-[var(--secondary)]/5"
                : "border-[var(--border)] bg-[var(--surface-muted)]/50"
            )}
          >
            <div className="text-[11px] mb-2 text-[var(--muted-foreground)]">
              {m.role === "user" ? "You" : "Assistant"}
            </div>
            <div
              className="text-[var(--foreground)]"
              dangerouslySetInnerHTML={{ __html: m.html }}
            />
            {Array.isArray(m.created_block_ids) && m.created_block_ids.length > 0 && (
              <div className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                Created {m.created_block_ids.length} block(s)
              </div>
            )}
            {m.role === "assistant" && m.undoBatches && m.undoBatches.length > 0 && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleUndo(m.id, m.undoBatches)}
                  disabled={undoingMessageId === m.id}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
                    "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-muted)]",
                    undoingMessageId === m.id && "opacity-60"
                  )}
                >
                  <RotateCcw className="h-3 w-3" />
                  Undo AI changes
                </button>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{streamingResponse || streamingStatus || "Thinking…"}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-[var(--border)] p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={2}
            placeholder="Ask the AI…"
            className={cn(
              "min-h-[44px] flex-1 resize-none rounded-md border px-3 py-2 text-sm outline-none",
              "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--secondary)]"
            )}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={cn(
              "inline-flex h-[44px] items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
              "border-[var(--secondary)] bg-[var(--secondary)] text-white hover:bg-[var(--secondary)]/90 disabled:opacity-50"
            )}
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </form>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
