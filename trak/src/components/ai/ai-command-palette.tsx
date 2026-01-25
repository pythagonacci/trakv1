"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Sparkles, Loader2, Send, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { useAI } from "./ai-context";
import { cn } from "@/lib/utils";

export function AICommandPalette() {
  const {
    isOpen,
    closeCommandPalette,
    messages,
    isLoading,
    executeCommand,
    clearMessages,
  } = useAI();

  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const command = input;
    setInput("");
    await executeCommand(command);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeCommandPalette();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#2D3236]/40"
        onClick={closeCommandPalette}
      />

      {/* Command Palette */}
      <div
        className={cn(
          "relative z-10 w-full max-w-2xl mx-4",
          "bg-[var(--surface)] rounded-lg border border-[var(--border)]",
          "shadow-[0_8px_40px_rgba(0,0,0,0.12)]",
          "animate-in fade-in-0 zoom-in-95 duration-150"
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm font-medium text-[var(--foreground)]">
              AI Command
            </span>
            <span className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/50 px-1.5 py-0.5 rounded">
              {"\u2318"}K
            </span>
          </div>
          <button
            onClick={closeCommandPalette}
            className="p-1 rounded hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Area */}
        {messages.length > 0 && (
          <div className="max-h-[40vh] overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--muted)] text-[var(--foreground)]"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>

                  {/* Tool calls indicator */}
                  {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
                      <p className="text-xs opacity-70 mb-1">Actions taken:</p>
                      {message.toolCalls.map((tc, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-xs opacity-80"
                        >
                          {tc.status === "success" ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-500" />
                          )}
                          <span className="font-mono">{tc.tool}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="bg-[var(--muted)] rounded-lg px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[var(--muted-foreground)]">
                      Processing...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything or give a command..."
                disabled={isLoading}
                className={cn(
                  "w-full px-4 py-2.5 text-sm rounded-lg",
                  "bg-[var(--muted)]/50 border border-[var(--border)]",
                  "text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-all duration-150"
                )}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                "p-2.5 rounded-lg",
                "bg-[var(--primary)] text-[var(--primary-foreground)]",
                "hover:bg-[var(--primary)]/90",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-150"
              )}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Quick suggestions */}
          {messages.length === 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                "Show all high priority tasks",
                "Create a task for tomorrow",
                "Mark overdue tasks as in-progress",
                "What projects are active?",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-full",
                    "bg-[var(--muted)]/50 text-[var(--muted-foreground)]",
                    "hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
                    "border border-[var(--border)]",
                    "transition-all duration-150"
                  )}
                >
                  <ChevronRight className="w-3 h-3 inline mr-1" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Footer hint */}
        {messages.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border)] flex justify-between items-center">
            <span className="text-xs text-[var(--muted-foreground)]">
              Press <kbd className="px-1 py-0.5 rounded bg-[var(--muted)] font-mono text-[10px]">Esc</kbd> to close
            </span>
            <button
              onClick={clearMessages}
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              Clear history
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
