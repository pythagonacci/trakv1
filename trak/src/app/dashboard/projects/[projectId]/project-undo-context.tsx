"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const PROJECT_UNDO_WINDOW_MS = 30_000;

type ProjectUndoAction = {
  id: string;
  label: string;
  createdAt?: number;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
};

type StoredProjectUndoAction = ProjectUndoAction & {
  createdAt: number;
  expiresAt: number;
};

type ProjectUndoContextValue = {
  registerAction: (action: ProjectUndoAction) => void;
  undoLast: () => Promise<void>;
  redoLast: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  isApplyingUndo: boolean;
  redoLabel: string | null;
};

const ProjectUndoContext = createContext<ProjectUndoContextValue | null>(null);

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function isFresh(action: StoredProjectUndoAction, now = Date.now()) {
  return action.expiresAt > now;
}

export function ProjectUndoProvider({ children }: { children: React.ReactNode }) {
  const [undoStack, setUndoStack] = useState<StoredProjectUndoAction[]>([]);
  const [redoAction, setRedoAction] = useState<StoredProjectUndoAction | null>(null);
  const [isApplyingUndo, setIsApplyingUndo] = useState(false);

  const pruneExpired = useCallback(() => {
    const now = Date.now();
    setUndoStack((prev) => prev.filter((action) => isFresh(action, now)));
    setRedoAction((prev) => (prev && isFresh(prev, now) ? prev : null));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(pruneExpired, 1_000);
    return () => window.clearInterval(interval);
  }, [pruneExpired]);

  const registerAction = useCallback((action: ProjectUndoAction) => {
    const createdAt = action.createdAt ?? Date.now();
    const stored: StoredProjectUndoAction = {
      ...action,
      createdAt,
      expiresAt: createdAt + PROJECT_UNDO_WINDOW_MS,
    };
    setUndoStack((prev) => [...prev.filter((entry) => isFresh(entry)), stored].slice(-20));
    setRedoAction(null);
  }, []);

  const undoLast = useCallback(async () => {
    if (isApplyingUndo) return;

    const now = Date.now();
    const freshStack = undoStack.filter((action) => isFresh(action, now));
    const action = freshStack[freshStack.length - 1];
    if (!action) {
      setUndoStack([]);
      return;
    }

    setIsApplyingUndo(true);
    setUndoStack(freshStack.slice(0, -1));
    try {
      await action.undo();
      setRedoAction(isFresh(action) ? action : null);
    } catch (error) {
      console.error("Project undo failed:", error);
      setUndoStack((prev) => [...prev, action].filter((entry) => isFresh(entry)));
    } finally {
      setIsApplyingUndo(false);
    }
  }, [isApplyingUndo, undoStack]);

  const redoLast = useCallback(async () => {
    if (isApplyingUndo || !redoAction || !isFresh(redoAction)) {
      setRedoAction(null);
      return;
    }

    const action = redoAction;
    setIsApplyingUndo(true);
    setRedoAction(null);
    try {
      await action.redo();
      if (isFresh(action)) {
        setUndoStack((prev) => [...prev.filter((entry) => isFresh(entry)), action].slice(-20));
      }
    } catch (error) {
      console.error("Project redo failed:", error);
      setRedoAction(isFresh(action) ? action : null);
    } finally {
      setIsApplyingUndo(false);
    }
  }, [isApplyingUndo, redoAction]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.shiftKey || event.altKey) return;
      if (event.key.toLowerCase() !== "z") return;
      if (isTextEditingTarget(event.target)) return;

      event.preventDefault();
      void undoLast();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoLast]);

  const value = useMemo<ProjectUndoContextValue>(
    () => ({
      registerAction,
      undoLast,
      redoLast,
      canUndo: undoStack.some((action) => isFresh(action)),
      canRedo: Boolean(redoAction && isFresh(redoAction)),
      isApplyingUndo,
      redoLabel: redoAction?.label ?? null,
    }),
    [isApplyingUndo, redoAction, redoLast, registerAction, undoLast, undoStack]
  );

  return <ProjectUndoContext.Provider value={value}>{children}</ProjectUndoContext.Provider>;
}

export function useProjectUndo() {
  const context = useContext(ProjectUndoContext);
  return context ?? {
    registerAction: () => undefined,
    undoLast: async () => undefined,
    redoLast: async () => undefined,
    canUndo: false,
    canRedo: false,
    isApplyingUndo: false,
    redoLabel: null,
  };
}
