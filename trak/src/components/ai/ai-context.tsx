"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AIContextValue {
  isOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  contextBlock: AIBlockContext | null;
  setContextBlock: (context: AIBlockContext | null) => void;
  pendingFileIds: string[];
  queueFileIds: (fileIds: string[]) => void;
  consumeQueuedFileIds: () => string[];
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
  const [contextBlock, setContextBlock] = useState<AIBlockContext | null>(null);
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);

  const openCommandPalette = useCallback(() => setIsOpen(true), []);
  const closeCommandPalette = useCallback(() => setIsOpen(false), []);
  const toggleCommandPalette = useCallback(() => setIsOpen((prev) => !prev), []);

  const queueFileIds = useCallback((fileIds: string[]) => {
    setPendingFileIds((prev) => {
      const next = new Set(prev);
      fileIds.forEach((id) => next.add(id));
      return Array.from(next);
    });
  }, []);

  const consumeQueuedFileIds = useCallback(() => {
    const ids = [...pendingFileIds];
    if (ids.length > 0) {
      setPendingFileIds([]);
    }
    return ids;
  }, [pendingFileIds]);

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
        contextBlock,
        setContextBlock,
        pendingFileIds,
        queueFileIds,
        consumeQueuedFileIds,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}
