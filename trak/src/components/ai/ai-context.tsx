"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: Array<{
    tool: string;
    status: "pending" | "success" | "error";
  }>;
}

interface AIContextValue {
  isOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  messages: AIMessage[];
  isLoading: boolean;
  executeCommand: (command: string) => Promise<void>;
  clearMessages: () => void;
  contextBlock: AIBlockContext | null;
  setContextBlock: (context: AIBlockContext | null) => void;
}

const AIContext = createContext<AIContextValue | null>(null);

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}

interface AIProviderProps {
  children: React.ReactNode;
}

export interface AIBlockContext {
  blockId: string;
  type: string;
  label: string;
}

export function AIProvider({ children }: AIProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [contextBlock, setContextBlock] = useState<AIBlockContext | null>(null);

  const openCommandPalette = useCallback(() => setIsOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsOpen((prev) => !prev), []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    // Add user message
    const userMessage: AIMessage = {
      role: "user",
      content: command,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, contextBlockId: contextBlock?.blockId || null }),
      });

      const result = await response.json();

      // Add assistant message
      const assistantMessage: AIMessage = {
        role: "assistant",
        content: result.response || "I couldn't process that command.",
        timestamp: new Date(),
        toolCalls: result.toolCallsMade?.map((tc: any) => ({
          tool: tc.tool,
          status: tc.result.success ? "success" : "error",
        })),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: AIMessage = {
        role: "assistant",
        content: "An error occurred while processing your command. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [contextBlock]);

  // Global keyboard shortcut for CMD+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommandPalette();
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        closeCommandPalette();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, toggleCommandPalette, closeCommandPalette]);

  return (
    <AIContext.Provider
      value={{
        isOpen,
        openCommandPalette,
        closeCommandPalette,
        toggleCommandPalette,
        messages,
        isLoading,
        executeCommand,
        clearMessages,
        contextBlock,
        setContextBlock,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}
