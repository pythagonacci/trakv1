"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";

interface AIContextValue {
  isOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  suppressInlineSidebar: boolean;
  setSuppressInlineSidebar: (suppress: boolean) => void;
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

function isEditableKeyboardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    !!target.closest('[contenteditable="true"]') ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export function AIProvider({ children }: AIProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suppressInlineSidebar, setSuppressInlineSidebar] = useState(false);
  const [contextBlock, setContextBlock] = useState<AIBlockContext | null>(null);
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);
  const pathname = usePathname();

  const routeScopeKey = useMemo(() => {
    const tabMatch = pathname?.match(/\/tabs\/([^/]+)/);
    const workflowMatch = pathname?.match(/\/dashboard\/workflow\/([^/]+)/);
    const projectMatch = pathname?.match(/\/dashboard\/projects\/([^/]+)/);

    if (tabMatch?.[1]) {
      return `tab:${tabMatch[1]}`;
    }
    if (workflowMatch?.[1]) {
      return `workflow:${workflowMatch[1]}`;
    }
    if (projectMatch?.[1]) {
      return `project:${projectMatch[1]}`;
    }
    return `route:${pathname ?? "unknown"}`;
  }, [pathname]);
  const previousRouteScopeKeyRef = useRef(routeScopeKey);

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
      if (e.defaultPrevented) return;
      // CMD+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (isEditableKeyboardTarget(e.target)) return;
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

  // Keep the command palette scoped to the active route context.
  useEffect(() => {
    if (previousRouteScopeKeyRef.current === routeScopeKey) return;
    previousRouteScopeKeyRef.current = routeScopeKey;
    setIsOpen(false);
    setContextBlock(null);
    setPendingFileIds([]);
  }, [routeScopeKey]);

  return (
    <AIContext.Provider
      value={{
        isOpen,
        openCommandPalette,
        closeCommandPalette,
        toggleCommandPalette,
        suppressInlineSidebar,
        setSuppressInlineSidebar,
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
