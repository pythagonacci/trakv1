"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBlockText } from "@/lib/format-block-text";
import Toast from "@/app/dashboard/projects/toast";
import { useQueryClient } from "@tanstack/react-query";

type WorkflowMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: Record<string, unknown>;
  created_at: string;
  created_block_ids?: string[];
};

function getText(content: Record<string, unknown> | null | undefined) {
  const raw = content?.text;
  if (typeof raw === "string") return raw;
  return "";
}

export default function WorkflowAIChatPanel(props: { tabId: string }) {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WorkflowMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  const renderedMessages = useMemo(() => {
    return messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        ...m,
        html: formatBlockText(getText(m.content)),
      }));
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
    try {
      const res = await fetch("/api/workflow/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabId: props.tabId, command: trimmed }),
      });
      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to execute workflow command");
      }

      setSessionId(json.sessionId || sessionId);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: { text: json.response, toolCallsMade: json.toolCallsMade },
          created_at: new Date().toISOString(),
          created_block_ids: Array.isArray(json.createdBlockIds) ? json.createdBlockIds : [],
        },
      ]);

      if (Array.isArray(json.createdBlockIds) && json.createdBlockIds.length > 0) {
        // Blocks changed; refresh React Query caches.
        void queryClient.invalidateQueries();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to run workflow AI";
      setToast({ message, type: "error" });
    } finally {
      setLoading(false);
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
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
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
